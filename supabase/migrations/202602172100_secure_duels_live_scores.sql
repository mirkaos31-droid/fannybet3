-- Migration: Secure Duel Token Handling & Live Scoring
-- Date: 2026-02-17
-- Description: Reserves tokens upfront for duels, handles refunds, and allows live score viewing.

-- 1. Secure Duel Creation (Challenger reserves tokens)
CREATE OR REPLACE FUNCTION public.create_duel_secure(p_opponent_id UUID, p_wager_amount INTEGER)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_challenger_id UUID := auth.uid();
    v_matchday RECORD;
    v_challenger_tokens NUMERIC;
BEGIN
    -- Check Auth
    IF v_challenger_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Non loggato');
    END IF;

    -- Verify Matchday Deadline
    SELECT * INTO v_matchday FROM public.matchdays WHERE deadline > now() ORDER BY deadline ASC LIMIT 1;
    IF v_matchday IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Impossibile sfidare: giornata già iniziata o nessun matchday attivo.');
    END IF;

    -- Check & Deduct Challenger Tokens (if wager > 0)
    IF p_wager_amount > 0 THEN
        SELECT tokens INTO v_challenger_tokens FROM public.profiles WHERE id = v_challenger_id FOR UPDATE;
        IF v_challenger_tokens < p_wager_amount THEN
            RETURN json_build_object('success', false, 'message', 'Token insufficienti per questa sfida.');
        END IF;

        UPDATE public.profiles SET tokens = tokens - p_wager_amount WHERE id = v_challenger_id;
    END IF;

    -- Insert Duel
    INSERT INTO public.duels (matchday_id, challenger_id, opponent_id, status, wager_amount)
    VALUES (v_matchday.id, v_challenger_id, p_opponent_id, 'PENDING', p_wager_amount);

    RETURN json_build_object('success', true, 'message', 'Sfida inviata! Token riservati.');
END;
$$;

-- 2. Secure Duel Acceptance (Opponent reserves tokens)
CREATE OR REPLACE FUNCTION public.accept_duel_secure(p_duel_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_duel RECORD;
    v_opponent_tokens NUMERIC;
BEGIN
    -- Check Auth
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Non loggato');
    END IF;

    -- Get Duel and Lock
    SELECT * INTO v_duel FROM public.duels WHERE id = p_duel_id FOR UPDATE;
    
    IF v_duel IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Sfida non trovata');
    END IF;

    IF v_duel.opponent_id != v_user_id THEN
        RETURN json_build_object('success', false, 'message', 'Solo il destinatario può accettare la sfida');
    END IF;

    IF v_duel.status != 'PENDING' THEN
        RETURN json_build_object('success', false, 'message', 'Sfida non più in attesa');
    END IF;

    -- Check & Deduct Opponent Tokens (if wager > 0)
    IF v_duel.wager_amount > 0 THEN
        SELECT tokens INTO v_opponent_tokens FROM public.profiles WHERE id = v_user_id FOR UPDATE;
        IF v_opponent_tokens < v_duel.wager_amount THEN
            RETURN json_build_object('success', false, 'message', 'Token insufficienti per accettare la sfida.');
        END IF;

        UPDATE public.profiles SET tokens = tokens - v_duel.wager_amount WHERE id = v_user_id;
    END IF;

    -- Set status to ACCEPTED
    UPDATE public.duels SET status = 'ACCEPTED' WHERE id = p_duel_id;

    RETURN json_build_object('success', true, 'message', 'Sfida accettata! Token riservati.');
END;
$$;

-- 3. Refund tokens if Declined
CREATE OR REPLACE FUNCTION public.decline_duel_secure(p_duel_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_duel RECORD;
BEGIN
    -- Check Auth
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Non loggato');
    END IF;

    -- Get Duel and Lock
    SELECT * INTO v_duel FROM public.duels WHERE id = p_duel_id FOR UPDATE;
    
    IF v_duel IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Sfida non trovata');
    END IF;

    IF v_duel.opponent_id != v_user_id THEN
        RETURN json_build_object('success', false, 'message', 'Solo il destinatario può rifiutare la sfida');
    END IF;

    IF v_duel.status != 'PENDING' THEN
        RETURN json_build_object('success', false, 'message', 'Sfida non più in attesa');
    END IF;

    -- Refund Challenger
    IF v_duel.wager_amount > 0 THEN
        UPDATE public.profiles SET tokens = tokens + v_duel.wager_amount WHERE id = v_duel.challenger_id;
    END IF;

    -- Set status to DECLINED
    UPDATE public.duels SET status = 'DECLINED' WHERE id = p_duel_id;

    RETURN json_build_object('success', true, 'message', 'Sfida rifiutata e token rimborsati.');
END;
$$;

-- 4. Computed Column for Live Duel Scores
CREATE OR REPLACE FUNCTION public.live_scores(p_duel public.duels)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_challenger_score JSONB;
    v_opponent_score JSONB;
BEGIN
    v_challenger_score := public.calculate_user_matchday_score(p_duel.challenger_id, p_duel.matchday_id);
    v_opponent_score := public.calculate_user_matchday_score(p_duel.opponent_id, p_duel.matchday_id);

    RETURN jsonb_build_object(
        'challenger_score', (v_challenger_score->>'score')::INTEGER,
        'opponent_score', (v_opponent_score->>'score')::INTEGER
    );
END;
$$;

-- 5. Updated resolve_matchday_duels (Handles reserved tokens)
CREATE OR REPLACE FUNCTION public.resolve_matchday_duels(p_matchday_id BIGINT)
RETURNS JSONB AS $$
DECLARE
  v_duel RECORD;
  v_scores JSONB;
  v_c_goals INTEGER;
  v_o_goals INTEGER;
  v_winner_id UUID;
  v_wager INTEGER;
  v_updates_count INTEGER := 0;
BEGIN
  FOR v_duel IN 
    SELECT * FROM public.duels 
    WHERE matchday_id = p_matchday_id AND status = 'ACCEPTED'
  LOOP
    -- Use the live score logic
    v_scores := public.live_scores(v_duel);
    v_c_goals := (v_scores->>'challenger_score')::INTEGER;
    v_o_goals := (v_scores->>'opponent_score')::INTEGER;
    
    -- Determine Winner
    IF v_c_goals > v_o_goals THEN
      v_winner_id := v_duel.challenger_id;
    ELSIF v_o_goals > v_c_goals THEN
      v_winner_id := v_duel.opponent_id;
    ELSE
      v_winner_id := NULL; -- Draw
    END IF;
    
    -- Update Duel
    UPDATE public.duels
    SET 
      status = 'COMPLETED',
      winner_id = v_winner_id,
      scores = v_scores
    WHERE id = v_duel.id;
    
    -- Handle Prize Payout (Tokens are already deducted!)
    v_wager := COALESCE(v_duel.wager_amount, 0);
    
    IF v_wager > 0 THEN
      IF v_winner_id IS NOT NULL THEN
        -- Winner gets both wagers (2x)
        UPDATE public.profiles 
        SET tokens = tokens + (v_wager * 2),
            total_tokens_won = COALESCE(total_tokens_won, 0) + v_wager
        WHERE id = v_winner_id;
      ELSE
        -- Draw: Everyone gets their wager back (1x)
        UPDATE public.profiles SET tokens = tokens + v_wager WHERE id = v_duel.challenger_id;
        UPDATE public.profiles SET tokens = tokens + v_wager WHERE id = v_duel.opponent_id;
      END IF;
    END IF;
    
    v_updates_count := v_updates_count + 1;
  END LOOP;
  
  RETURN jsonb_build_object('success', true, 'resolved_count', v_updates_count);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
