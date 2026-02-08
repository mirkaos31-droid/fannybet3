-- Migration: Refine Duel Arena logic for live scoring, balance checks, and cleaner resets.

-- 1. Create a function to sync duel scores when matchday results are updated
CREATE OR REPLACE FUNCTION public.tr_sync_duels_scores()
RETURNS TRIGGER AS $$
DECLARE
    v_duel RECORD;
    v_challenger_score JSONB;
    v_opponent_score JSONB;
BEGIN
    -- Only trigger if results have actually changed
    IF (OLD.results IS DISTINCT FROM NEW.results) THEN
        -- Loop through all ACCEPTED duels for this matchday
        FOR v_duel IN 
            SELECT id, challenger_id, opponent_id 
            FROM public.duels 
            WHERE matchday_id = NEW.id 
            AND status = 'ACCEPTED'
        LOOP
            -- Calculate fresh scores
            v_challenger_score := public.calculate_user_matchday_score(v_duel.challenger_id, NEW.id);
            v_opponent_score := public.calculate_user_matchday_score(v_duel.opponent_id, NEW.id);
            
            -- Update the duel record
            UPDATE public.duels
            SET scores = jsonb_build_object(
                'challenger_score', (v_challenger_score->>'score')::INTEGER,
                'opponent_score', (v_opponent_score->>'score')::INTEGER
            ),
            updated_at = now()
            WHERE id = v_duel.id;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach the trigger to matchdays table
DROP TRIGGER IF EXISTS trigger_sync_duels_scores ON public.matchdays;
CREATE TRIGGER trigger_sync_duels_scores
AFTER UPDATE OF results ON public.matchdays
FOR EACH ROW
EXECUTE FUNCTION public.tr_sync_duels_scores();

-- 3. Update admin_create_matchday to clear ALL duels (ensuring a fresh start)
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

  -- 4. Create Matchday
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

  -- 5. Cleanup: Clear the entire Arena to ensure a fresh start
  -- First resolve duels of the last archived day to pay out winners if not already done
  IF v_last_archived_id IS NOT NULL THEN
    PERFORM public.resolve_matchday_duels(v_last_archived_id);
  END IF;

  -- Delete ALL duels (or just those associated with matchdays that are no longer OPEN)
  -- Deleting all ensures no stale PENDING or ACCEPTED duels clutter the UI.
  DELETE FROM public.duels;

  RETURN json_build_object('success', true, 'message', 'Nuova giornata creata! Arena resettata.', 'id', new_id);
END;
$$;
