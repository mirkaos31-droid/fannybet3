-- Migration: Admin Manual FB Lega Pick Override
-- Description: Adds an RPC for administrators to manually insert or update picks for users to bypass deadlines.

CREATE OR REPLACE FUNCTION public.admin_manual_submit_fb_league_picks(
    p_league_id BIGINT, 
    p_user_id UUID,
    p_matchday_id BIGINT, 
    p_predictions TEXT[]
)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- 1. Admin check
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'message', 'Azione riservata agli amministratori');
    END IF;

    -- 2. Consistency check: user must be a participant
    IF NOT EXISTS (SELECT 1 FROM public.fb_league_participants WHERE league_id = p_league_id AND user_id = p_user_id) THEN
        RETURN json_build_object('success', false, 'message', 'L''utente non è iscritto a questa lega');
    END IF;

    -- 3. Upsert picks (Bypassing deadline check)
    INSERT INTO public.fb_league_picks (league_id, user_id, matchday_id, predictions)
    VALUES (p_league_id, p_user_id, p_matchday_id, p_predictions)
    ON CONFLICT (league_id, user_id, matchday_id)
    DO UPDATE SET predictions = EXCLUDED.predictions, created_at = now();

    RETURN json_build_object('success', true, 'message', 'Pronostici inseriti manualmente con successo!');
END;
$$;
