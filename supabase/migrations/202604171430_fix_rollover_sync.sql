-- Migration: Fix 1x2 Rollover Synchronization
-- Description: This migration ensures that the rollover from the previous matchday 
-- is correctly initialized in both current_pot AND rollover_pot, 
-- preventing it from being lost during subsequent ricalculations.

-- 1. Redefine the function to fix future matchday creations
CREATE OR REPLACE FUNCTION public.admin_create_matchday()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_id BIGINT;
  v_rollover NUMERIC := 0;
  v_deadline TIMESTAMPTZ;
  v_last_archived_id BIGINT;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized: Admin only');
  END IF;

  -- 1. Check if OPEN matchday exists
  IF EXISTS (SELECT 1 FROM matchdays WHERE status = 'OPEN') THEN
      RETURN json_build_object('success', false, 'message', 'Esiste già una giornata aperta!');
  END IF;

  -- 2. Get rollover and last archived id
  SELECT id, rollover_pot INTO v_last_archived_id, v_rollover 
  FROM matchdays 
  WHERE status = 'ARCHIVED' 
  ORDER BY id DESC LIMIT 1;

  v_rollover := COALESCE(v_rollover, 0);

  -- 3. Set deadline (Default tomorrow)
  v_deadline := now() + interval '1 day';

  -- 4. Create Matchday with DEFAULT empty matches
  INSERT INTO matchdays (
      matches, 
      results, 
      status, 
      current_pot, 
      rollover_pot, 
      deadline,
      super_jackpot
  ) VALUES (
      (SELECT jsonb_agg(jsonb_build_object(
          'id', i, 
          'home', '', 
          'away', '', 
          'league', CASE WHEN i <= 10 THEN 'SERIE A' ELSE 'CUSTOM' END
       )) FROM generate_series(1, 12) i),
      ARRAY(SELECT NULL::text FROM generate_series(1, 12)),
      'OPEN',
      v_rollover, -- Initial pot includes rollover
      v_rollover, -- FIXED: store rollover specifically for recalculations
      v_deadline,
      0
  ) RETURNING id INTO new_id;

  -- 5. Cleanup: if there is a last archived matchday, ensure duels are resolved and then delete them
  IF v_last_archived_id IS NOT NULL THEN
    PERFORM public.resolve_matchday_duels(v_last_archived_id);
    DELETE FROM public.duels WHERE matchday_id = v_last_archived_id;
  END IF;

  RETURN json_build_object('success', true, 'message', 'Nuova giornata creata!', 'id', new_id);
END;
$$;

-- 2. REPAIR CURRENT OPEN MATCHDAY
DO $$
DECLARE
    v_rollover_actual NUMERIC;
    v_open_id BIGINT;
BEGIN
    -- Get rollover from last archived
    SELECT rollover_pot INTO v_rollover_actual 
    FROM public.matchdays 
    WHERE status = 'ARCHIVED' 
    ORDER BY id DESC LIMIT 1;

    -- Get currently OPEN matchday
    SELECT id INTO v_open_id 
    FROM public.matchdays 
    WHERE status = 'OPEN' 
    LIMIT 1;

    -- If there's an open matchday and it has 0 rollover (incorrect state), fix it
    IF v_open_id IS NOT NULL AND v_rollover_actual > 0 THEN
        UPDATE public.matchdays 
        SET rollover_pot = v_rollover_actual,
            updated_at = now()
        WHERE id = v_open_id;
        
        -- Force immediate recalculation of current_pot using the new rollover
        PERFORM public.admin_recalculate_current_pot();
    END IF;
END $$;
