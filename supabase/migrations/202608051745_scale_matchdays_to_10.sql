-- Migration: Scale Matchdays to 10 Serie A Matches & Simplify Archiving
-- Description: Removes 1x2 betting logic from matchday management.
--   - admin_create_matchday now generates 10 Serie A matches (representing all 20 teams)
--   - admin_archive_matchday_simple replaces admin_archive_1x2_matchday
--     It only closes the matchday without computing 1x2 winners or jackpots.
--     Survival and FB Lega rounds are resolved separately by their own RPCs.

-- ===========================================================
-- 1. Redefine admin_create_matchday — 10 Serie A matches
-- ===========================================================
CREATE OR REPLACE FUNCTION public.admin_create_matchday()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_id BIGINT;
  v_deadline TIMESTAMPTZ;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized: Admin only');
  END IF;

  -- Check if OPEN matchday already exists
  IF EXISTS (SELECT 1 FROM matchdays WHERE status = 'OPEN') THEN
      RETURN json_build_object('success', false, 'message', 'Esiste già una giornata aperta!');
  END IF;

  -- Default deadline: tomorrow
  v_deadline := now() + interval '1 day';

  -- Create Matchday with 10 Serie A matches
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
          'league', 'SERIE A'
       )) FROM generate_series(1, 10) i),
      ARRAY(SELECT NULL::text FROM generate_series(1, 10)),
      'OPEN',
      0,
      0,
      v_deadline,
      0
  ) RETURNING id INTO new_id;

  RETURN json_build_object('success', true, 'message', 'Nuova giornata creata (10 match Serie A)', 'id', new_id);
END;
$$;

-- ===========================================================
-- 2. Create admin_archive_matchday_simple
--    Closes the matchday without any 1x2 prize distribution.
--    Survival and Lega are processed by their own RPCs.
-- ===========================================================
CREATE OR REPLACE FUNCTION public.admin_archive_matchday_simple(
  p_matchday_id BIGINT
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_md RECORD;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized: Admin only');
  END IF;

  -- Fetch matchday
  SELECT id, status INTO v_md
  FROM matchdays
  WHERE id = p_matchday_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Giornata non trovata');
  END IF;

  IF v_md.status = 'ARCHIVED' THEN
    RETURN json_build_object('success', false, 'message', 'Giornata già archiviata');
  END IF;

  -- Archive the matchday
  UPDATE matchdays
  SET status = 'ARCHIVED',
      bets_locked = true
  WHERE id = p_matchday_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Giornata ' || p_matchday_id || ' archiviata. Elabora ora Survival e Leghe.'
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.admin_create_matchday() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_archive_matchday_simple(BIGINT) TO authenticated;
