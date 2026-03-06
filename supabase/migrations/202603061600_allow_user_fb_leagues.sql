-- Migration: Allow Users to Create FB Leagues
-- Description: Removes the is_admin() restriction from create_fb_league so any authenticated user can create a league.

CREATE OR REPLACE FUNCTION public.create_fb_league(
    p_name TEXT, 
    p_entry_fee INTEGER, 
    p_duration INTEGER, 
    p_scoring_rules JSONB, 
    p_prize_dist JSONB
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_matchday_id BIGINT;
    v_league_id BIGINT;
BEGIN
    -- REMOVED: IF NOT public.is_admin() THEN ...

    -- Get the next OPEN matchday to start the league
    SELECT id INTO v_matchday_id FROM public.matchdays WHERE status = 'OPEN' ORDER BY deadline ASC LIMIT 1;
    
    IF v_matchday_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Nessuna giornata aperta per iniziare la lega');
    END IF;

    INSERT INTO public.fb_leagues (
        name, admin_id, entry_fee, duration_matchdays, start_matchday_id, scoring_rules, prize_distribution, status
    ) VALUES (
        p_name, auth.uid(), p_entry_fee, p_duration, v_matchday_id, p_scoring_rules, p_prize_dist, 'OPEN'
    ) RETURNING id INTO v_league_id;

    RETURN json_build_object('success', true, 'message', 'Lega creata!', 'id', v_league_id);
END;
$$;
