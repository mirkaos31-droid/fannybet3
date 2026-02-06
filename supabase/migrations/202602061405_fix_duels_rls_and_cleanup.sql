
-- 1. Update RLS Policies for Duels
-- Remove old restrictive policy
DROP POLICY IF EXISTS "Users can view duels they are part of" ON public.duels;

-- New Policies:
-- A. Admins can see EVERYTHING
CREATE POLICY "Admins can view all duels" 
  ON public.duels FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN'));

-- B. Users can see duels they are part of (any matchday)
CREATE POLICY "Users can view own duels" 
  ON public.duels FOR SELECT
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- C. Everyone can see duels for the CURRENT OPEN matchday (for Global view)
CREATE POLICY "Everyone can view current matchday duels" 
  ON public.duels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.matchdays m 
      WHERE m.id = public.duels.matchday_id 
      AND m.status = 'OPEN'
    )
  );


-- 2. Improve admin_create_matchday Cleanup Logic
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
      v_rollover,
      0,
      v_deadline,
      0
  ) RETURNING id INTO new_id;

  -- 5. Enhanced Cleanup:
  -- Resolve any ACCEPTED duels from previous matchdays that were somehow missed
  -- (Note: resolve_matchday_duels only handles ACCEPTED)
  IF v_last_archived_id IS NOT NULL THEN
    PERFORM public.resolve_matchday_duels(v_last_archived_id);
  END IF;

  -- DELETE ALL non-OPEN matchday duels (PENDING or otherwise) to ensure a clean start
  DELETE FROM public.duels 
  WHERE matchday_id NOT IN (SELECT id FROM matchdays WHERE status = 'OPEN');

  RETURN json_build_object('success', true, 'message', 'Nuova giornata creata!', 'id', new_id);
END;
$$;


-- 3. Immediate / Manual Cleanup
-- Clean up all duels from non-OPEN matchdays right now
DELETE FROM public.duels 
WHERE matchday_id NOT IN (SELECT id FROM matchdays WHERE status = 'OPEN');
