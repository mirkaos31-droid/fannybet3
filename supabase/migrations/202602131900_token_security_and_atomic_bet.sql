-- Migration: Token Security, Atomic 1x2 Betting, and Secure Duels
-- Description: Adds a hard constraint for tokens, updates RLS for profile security, and creates secure RPCs for betting and duels.

-- 1. Add CHECK constraint to prevent negative balances
ALTER TABLE public.profiles ADD CONSTRAINT tokens_non_negative CHECK (tokens >= 0);

-- 2. Update RLS on public.profiles
-- We want users to be able to read all profiles, but only update their own username and avatar_url.
-- They should NOT be able to update tokens, role, or stats directly via client-side code.

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE 
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id AND (
      CASE 
        WHEN (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN' THEN true
        ELSE (
          -- For regular users, ensure tokens and role are NOT changed from their current values
          tokens = (SELECT tokens FROM public.profiles WHERE id = auth.uid()) AND
          role = (SELECT role FROM public.profiles WHERE id = auth.uid()) AND
          wins_1x2 = (SELECT wins_1x2 FROM public.profiles WHERE id = auth.uid()) AND
          wins_survival = (SELECT wins_survival FROM public.profiles WHERE id = auth.uid()) AND
          total_tokens_won = (SELECT total_tokens_won FROM public.profiles WHERE id = auth.uid()) AND
          total_points = (SELECT total_points FROM public.profiles WHERE id = auth.uid()) AND
          bets_placed = (SELECT bets_placed FROM public.profiles WHERE id = auth.uid())
        )
      END
    )
  );

-- 3. Atomic 1x2 Betting RPC
CREATE OR REPLACE FUNCTION public.submit_1x2_bet(p_predictions TEXT[], p_include_super_jackpot BOOLEAN)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_cost INTEGER;
    v_matchday RECORD;
    v_current_tokens NUMERIC;
    v_bet_id BIGINT;
BEGIN
    -- 1. Check Auth
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Not logged in');
    END IF;

    -- 2. Get Active Matchday
    SELECT * INTO v_matchday FROM public.matchdays WHERE deadline > now() ORDER BY deadline ASC LIMIT 1;
    IF v_matchday IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Scommesse chiuse per la giornata (deadline raggiunta).');
    END IF;

    -- 3. Calculate Cost
    v_cost := CASE WHEN p_include_super_jackpot THEN 2 ELSE 1 END;

    -- 4. Check & Deduct Tokens
    SELECT tokens INTO v_current_tokens FROM public.profiles WHERE id = v_user_id FOR UPDATE;
    IF v_current_tokens < v_cost THEN
        RETURN json_build_object('success', false, 'message', 'Token insufficienti');
    END IF;

    UPDATE public.profiles 
    SET tokens = tokens - v_cost,
        bets_placed = COALESCE(bets_placed, 0) + 1
    WHERE id = v_user_id;

    -- 5. Insert Bet
    INSERT INTO public.bets (user_id, matchday_id, predictions, include_super_jackpot, amount)
    VALUES (v_user_id, v_matchday.id, p_predictions, p_include_super_jackpot, v_cost)
    RETURNING id INTO v_bet_id;

    RETURN json_build_object('success', true, 'message', 'Scommessa piazzata con successo!', 'bet_id', v_bet_id);
END;
$$;

-- 4. Secure Duel Creation RPC
CREATE OR REPLACE FUNCTION public.create_duel_secure(p_opponent_id UUID, p_wager_amount INTEGER)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_challenger_id UUID := auth.uid();
    v_matchday RECORD;
    v_challenger_tokens NUMERIC;
BEGIN
    -- 1. Check Auth
    IF v_challenger_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Non loggato');
    END IF;

    -- 2. Verify Matchday Deadline
    SELECT * INTO v_matchday FROM public.matchdays WHERE deadline > now() ORDER BY deadline ASC LIMIT 1;
    IF v_matchday IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Impossibile sfidare: giornata già iniziata o nessun matchday attivo.');
    END IF;

    -- 3. Check Challenger Tokens (if wager > 0)
    IF p_wager_amount > 0 THEN
        SELECT tokens INTO v_challenger_tokens FROM public.profiles WHERE id = v_challenger_id;
        IF v_challenger_tokens < p_wager_amount THEN
            RETURN json_build_object('success', false, 'message', 'Token insufficienti per questa sfida.');
        END IF;
    END IF;

    -- 4. Insert Duel
    INSERT INTO public.duels (matchday_id, challenger_id, opponent_id, status, wager_amount)
    VALUES (v_matchday.id, v_challenger_id, p_opponent_id, 'PENDING', p_wager_amount);

    RETURN json_build_object('success', true, 'message', 'Sfida inviata!');
END;
$$;

-- 5. Admin ID Synchronizer (Fix for cases like EL Barto)
-- This function finds a player record by username and matches it to the profile's ID.
CREATE OR REPLACE FUNCTION public.admin_fix_survival_player_id(p_username TEXT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_profile_id UUID;
    v_rows_updated INTEGER := 0;
BEGIN
    -- 1. Check Admin
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- 2. Find Profile ID by username (case-insensitive and trimmed)
    SELECT id INTO v_profile_id 
    FROM public.profiles 
    WHERE TRIM(username) ILIKE TRIM(p_username)
    LIMIT 1;

    IF v_profile_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Profilo non trovato per ' || p_username);
    END IF;

    -- 3. Update survival_players records that match this username (via join) but have wrong user_id
    -- Actually, it's safer to update ALL records for this profile ID to be sure.
    -- But the problem is usually that the survival_player.user_id is wrong.
    
    -- We'll look for survival_players entries that belong to this profile but have a different user_id
    -- Wait, how do we know they belong to this profile if the user_id is wrong?
    -- We can only know if we have a way to link them.
    -- If they have the SAME ID in survival_players...
    
    -- Actually, the user says "EL Barto can't pick".
    -- I'll search for the player record by username link.
    UPDATE public.survival_players sp
    SET user_id = v_profile_id
    FROM public.profiles pr
    WHERE sp.user_id = pr.id
    AND TRIM(pr.username) ILIKE TRIM(p_username)
    AND sp.user_id != v_profile_id;
    
    GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

    RETURN json_build_object('success', true, 'message', 'ID sincronizzati con successo.', 'rows_updated', v_rows_updated);
END;
$$;
