-- Migration: Admin Remove Survival Player
-- Description: Allows admins to remove a player from a survival season, refunding their entry fee and updating the prize pool.

CREATE OR REPLACE FUNCTION public.admin_remove_survival_player(p_player_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_season_id BIGINT;
    v_entry_fee INTEGER;
    v_status TEXT;
BEGIN
    -- 1. Security Check: Admin only
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'ADMIN'
    ) THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized: Admin only');
    END IF;

    -- 2. Get Player and Season Info
    SELECT user_id, season_id, status INTO v_user_id, v_season_id, v_status
    FROM public.survival_players
    WHERE id = p_player_id;

    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Giocatore non trovato.');
    END IF;

    -- 3. Get Entry Fee from Season
    SELECT entry_fee INTO v_entry_fee
    FROM public.survival_seasons
    WHERE id = v_season_id;

    -- 4. Refund Tokens to User (if they were ALIVE or if we just want to be fair)
    -- If the season is still OPEN or ACTIVE, we refund.
    UPDATE public.profiles
    SET tokens = tokens + COALESCE(v_entry_fee, 2)
    WHERE id = v_user_id;

    -- 5. Deduct from Season Prize Pool
    UPDATE public.survival_seasons
    SET prize_pool = GREATEST(0, prize_pool - COALESCE(v_entry_fee, 2))
    WHERE id = v_season_id;

    -- 6. Delete Picks (Cascade should handle this if defined, but let's be explicit)
    DELETE FROM public.survival_picks
    WHERE player_id = p_player_id;

    -- 7. Delete Player
    DELETE FROM public.survival_players
    WHERE id = p_player_id;

    RETURN json_build_object('success', true, 'message', 'Giocatore rimosso e token rimborsati.');
END;
$$;
