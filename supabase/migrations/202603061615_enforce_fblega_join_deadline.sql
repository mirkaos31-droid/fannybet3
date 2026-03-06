-- Migration: Enforce FB Lega Join Deadline
-- Description: Updates join_fb_league to check if the first matchday's deadline has passed. If it has, joining is blocked.

CREATE OR REPLACE FUNCTION public.join_fb_league(p_league_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_entry_fee INTEGER;
    v_user_tokens NUMERIC;
    v_league_status TEXT;
    v_start_matchday_id BIGINT;
    v_deadline TIMESTAMPTZ;
BEGIN
    -- Check if league exists and get start matchday
    SELECT entry_fee, status, start_matchday_id 
    INTO v_entry_fee, v_league_status, v_start_matchday_id
    FROM public.fb_leagues WHERE id = p_league_id;

    IF v_league_status IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Lega non trovata');
    END IF;

    IF v_league_status != 'OPEN' THEN
        RETURN json_build_object('success', false, 'message', 'Iscrizioni chiuse per questa lega');
    END IF;

    -- NEW: Check if the start matchday deadline has passed
    IF v_start_matchday_id IS NOT NULL THEN
        SELECT deadline INTO v_deadline FROM public.matchdays WHERE id = v_start_matchday_id;
        IF v_deadline IS NOT NULL AND NOW() > v_deadline THEN
            RETURN json_build_object('success', false, 'message', 'Iscrizioni chiuse: il primo match è già iniziato.');
        END IF;
    END IF;

    -- Check if already joined
    IF EXISTS (SELECT 1 FROM public.fb_league_participants WHERE league_id = p_league_id AND user_id = auth.uid()) THEN
        RETURN json_build_object('success', false, 'message', 'Sei già iscritto a questa lega');
    END IF;

    -- Check tokens with FOR UPDATE for atomicity
    SELECT tokens INTO v_user_tokens FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
    IF v_user_tokens < v_entry_fee THEN
        RETURN json_build_object('success', false, 'message', 'Token insufficienti');
    END IF;

    -- Deduct tokens and increment bets_placed (joining a league counts as a participation/bet)
    UPDATE public.profiles 
    SET tokens = tokens - v_entry_fee,
        bets_placed = COALESCE(bets_placed, 0) + 1
    WHERE id = auth.uid();

    -- Add to prize pool
    UPDATE public.fb_leagues SET prize_pool = prize_pool + v_entry_fee WHERE id = p_league_id;

    -- Add participant
    INSERT INTO public.fb_league_participants (league_id, user_id)
    VALUES (p_league_id, auth.uid());

    -- Update level
    PERFORM public.update_user_level(auth.uid());

    RETURN json_build_object('success', true, 'message', 'Iscrizione effettuata con successo!');
END;
$$;
