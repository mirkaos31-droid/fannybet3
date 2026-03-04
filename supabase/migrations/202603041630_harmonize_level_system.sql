-- Migration: Harmonize Level System and Token Security
-- Description: Centralizes level calculation, updates participation stats, and ensures atomic token checks.

-- 1. Unified Level Calculation Function
CREATE OR REPLACE FUNCTION public.update_user_level(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_wins INTEGER;
    v_tokens_won NUMERIC;
    v_bets_placed INTEGER;
    v_new_level INTEGER := 1;
BEGIN
    -- Get current stats
    SELECT 
        (COALESCE(wins_1x2, 0) + COALESCE(wins_survival, 0)),
        COALESCE(total_tokens_won, 0),
        COALESCE(bets_placed, 0)
    INTO v_wins, v_tokens_won, v_bets_placed
    FROM public.profiles
    WHERE id = p_user_id;

    -- Level milestones (Level 1: 0 req)
    -- Level 2: 5 bets + 1 win + 50 tokens
    -- Level 3: 15 bets + 3 wins + 500 tokens
    -- Level 4: 30 bets + 7 wins + 1500 tokens
    -- Level 5: 50 bets + 15 wins + 5000 tokens

    IF v_bets_placed >= 50 AND v_wins >= 15 AND v_tokens_won >= 5000 THEN
        v_new_level := 5;
    ELSIF v_bets_placed >= 30 AND v_wins >= 7 AND v_tokens_won >= 1500 THEN
        v_new_level := 4;
    ELSIF v_bets_placed >= 15 AND v_wins >= 3 AND v_tokens_won >= 500 THEN
        v_new_level := 3;
    ELSIF v_bets_placed >= 5 AND v_wins >= 1 AND v_tokens_won >= 50 THEN
        v_new_level := 2;
    ELSE
        v_new_level := 1;
    END IF;

    -- Update level if higher
    UPDATE public.profiles 
    SET level = GREATEST(level, v_new_level)
    WHERE id = p_user_id;

    RETURN v_new_level;
END;
$$;

-- 2. Update join_fb_league with FOR UPDATE and bets_placed increment
CREATE OR REPLACE FUNCTION public.join_fb_league(p_league_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_entry_fee INTEGER;
    v_user_tokens NUMERIC;
    v_league_status TEXT;
BEGIN
    -- Check if league exists and is OPEN
    SELECT entry_fee, status INTO v_entry_fee, v_league_status 
    FROM public.fb_leagues WHERE id = p_league_id;

    IF v_league_status IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Lega non trovata');
    END IF;

    IF v_league_status != 'OPEN' THEN
        RETURN json_build_object('success', false, 'message', 'Iscrizioni chiuse per questa lega');
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

-- 3. Update join_survival with bets_placed increment and level update
CREATE OR REPLACE FUNCTION public.join_survival(p_season_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_season_with_deadline RECORD;
  v_user_tokens NUMERIC;
  v_cost INTEGER;
  v_player_id BIGINT;
BEGIN
  -- 1. Get Season Info and Matchday Deadline
  SELECT s.*, m.deadline 
  INTO v_season_with_deadline 
  FROM public.survival_seasons s
  LEFT JOIN public.matchdays m ON s.start_matchday_id = m.id
  WHERE s.id = p_season_id;
  
  IF v_season_with_deadline.id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Campionato non trovato.');
  END IF;

  -- 2. Check Status
  IF v_season_with_deadline.status != 'OPEN' THEN
    RETURN json_build_object('success', false, 'message', 'Iscrizioni chiuse per questo campionato.');
  END IF;

  -- 3. Check Deadline
  IF v_season_with_deadline.deadline IS NOT NULL AND NOW() > v_season_with_deadline.deadline THEN
    RETURN json_build_object('success', false, 'message', 'Iscrizioni chiuse: il primo match è già iniziato.');
  END IF;

  -- 4. Check if already joined
  IF EXISTS (SELECT 1 FROM public.survival_players WHERE season_id = p_season_id AND user_id = v_user_id) THEN
    RETURN json_build_object('success', false, 'message', 'Sei già iscritto.');
  END IF;

  -- 5. Check Tokens with FOR UPDATE
  SELECT tokens INTO v_user_tokens FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  v_cost := COALESCE(v_season_with_deadline.entry_fee, 2); 

  IF v_user_tokens < v_cost THEN
    RETURN json_build_object('success', false, 'message', 'Token insufficienti (Richiesti: ' || v_cost || ')');
  END IF;

  -- 6. Deduct Tokens & Add to Pool & Increment bets_placed
  UPDATE public.profiles 
  SET tokens = tokens - v_cost,
      bets_placed = COALESCE(bets_placed, 0) + 1
  WHERE id = v_user_id;

  UPDATE public.survival_seasons SET prize_pool = COALESCE(prize_pool, 0) + v_cost WHERE id = p_season_id;

  -- 7. Register Player
  INSERT INTO public.survival_players (season_id, user_id, status, used_teams)
  VALUES (p_season_id, v_user_id, 'ALIVE', '{}')
  RETURNING id INTO v_player_id;

  -- 8. Update level
  PERFORM public.update_user_level(v_user_id);

  RETURN json_build_object('success', true, 'message', 'Iscrizione confermata (-' || v_cost || ' token)');
END;
$$;

-- 4. Update submit_1x2_bet to include level update
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
    SELECT * INTO v_matchday FROM public.matchdays WHERE deadline > now() AND status = 'OPEN' ORDER BY deadline ASC LIMIT 1;
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

    -- 6. Update Level
    PERFORM public.update_user_level(v_user_id);

    RETURN json_build_object('success', true, 'message', 'Scommessa piazzata con successo!', 'bet_id', v_bet_id);
END;
$$;

-- 5. Inject level update into prize distribution
-- Survival
CREATE OR REPLACE FUNCTION public.close_survival_season(p_season_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_winner_id UUID;
  v_winner_username TEXT;
  v_prize_pool NUMERIC;
  v_entry_fee INTEGER;
  v_prize_to_award NUMERIC;
  v_alive_count INTEGER;
  v_card_survival_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- Get season info
  SELECT prize_pool, entry_fee INTO v_prize_pool, v_entry_fee
  FROM public.survival_seasons 
  WHERE id = p_season_id;

  IF v_prize_pool IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Stagione non trovata');
  END IF;

  -- Count alive players
  SELECT COUNT(*) INTO v_alive_count
  FROM public.survival_players
  WHERE season_id = p_season_id AND status = 'ALIVE';

  IF v_alive_count = 0 THEN
    RETURN json_build_object('success', false, 'message', 'Nessun sopravvissuto! Impossibile chiudere.');
  END IF;

  IF v_alive_count > 1 THEN
    RETURN json_build_object('success', false, 'message', 'Ci sono ancora ' || v_alive_count || ' sopravvissuti. Continua il torneo!');
  END IF;

  -- Get the winner
  SELECT user_id INTO v_winner_id
  FROM public.survival_players
  WHERE season_id = p_season_id AND status = 'ALIVE'
  LIMIT 1;

  -- Get winner username
  SELECT username INTO v_winner_username
  FROM public.profiles
  WHERE id = v_winner_id;

  -- Calculate prize
  v_prize_to_award := GREATEST(0, v_prize_pool - COALESCE(v_entry_fee, 2));

  -- Transfer prize to winner's wallet
  UPDATE public.profiles
  SET tokens = tokens + v_prize_to_award,
      wins_survival = COALESCE(wins_survival, 0) + 1,
      total_tokens_won = COALESCE(total_tokens_won, 0) + v_prize_to_award
  WHERE id = v_winner_id;

  -- Set winner status
  UPDATE public.survival_players
  SET status = 'WINNER'
  WHERE season_id = p_season_id AND user_id = v_winner_id;

  -- AWARD SURVIVAL CARD
  SELECT id INTO v_card_survival_id FROM public.collectible_cards WHERE title = 'Survival';
  IF v_card_survival_id IS NOT NULL THEN
      INSERT INTO public.user_cards (user_id, card_id)
      VALUES (v_winner_id, v_card_survival_id)
      ON CONFLICT DO NOTHING;
  END IF;

  -- 🏆 Update level
  PERFORM public.update_user_level(v_winner_id);

  -- Close the season
  UPDATE public.survival_seasons 
  SET status = 'COMPLETED', finished_at = NOW()
  WHERE id = p_season_id;

  RETURN json_build_object(
    'success', true, 
    'message', '🏆 VITTORIA! ' || v_winner_username || ' ha vinto ' || v_prize_to_award || ' FTK!',
    'winner', v_winner_username,
    'prize', v_prize_to_award
  );
END;
$$;

-- FB Lega Prizes
CREATE OR REPLACE FUNCTION public.distribute_fb_league_prizes(p_league_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_prize_pool NUMERIC;
    v_distribution JSONB;
    v_winners RECORD;
    v_prize_amount NUMERIC;
    v_winner_list JSONB := '[]'::JSONB;
    v_max_points INTEGER;
    v_min_points INTEGER;
    v_second_max_points INTEGER;
    v_card_ultimo_id UUID;
    v_card_quasi_id UUID;
    v_card_horto_id UUID;
    i INTEGER := 1;
BEGIN
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    SELECT prize_pool, prize_distribution INTO v_prize_pool, v_distribution 
    FROM public.fb_leagues WHERE id = p_league_id AND status = 'ACTIVE';

    IF v_prize_pool IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Lega non attiva o non trovata');
    END IF;

    SELECT MAX(total_points), MIN(total_points) INTO v_max_points, v_min_points 
    FROM public.fb_league_participants WHERE league_id = p_league_id;

    SELECT MAX(total_points) INTO v_second_max_points 
    FROM public.fb_league_participants 
    WHERE league_id = p_league_id AND total_points < v_max_points;

    SELECT id INTO v_card_ultimo_id FROM public.collectible_cards WHERE title = 'Ultimo Posto';
    SELECT id INTO v_card_quasi_id FROM public.collectible_cards WHERE title = 'C''eri quasi!';
    SELECT id INTO v_card_horto_id FROM public.collectible_cards WHERE title = 'Horto muso';

    FOR v_winners IN 
        SELECT user_id, total_points, p.username
        FROM public.fb_league_participants lp
        JOIN public.profiles p ON lp.user_id = p.id
        WHERE league_id = p_league_id
        ORDER BY total_points DESC
        LIMIT jsonb_array_length(v_distribution)
    LOOP
        v_prize_amount := v_prize_pool * (v_distribution->>(i-1))::NUMERIC;
        IF v_prize_amount > 0 THEN
            UPDATE public.profiles SET tokens = tokens + v_prize_amount, total_tokens_won = total_tokens_won + v_prize_amount WHERE id = v_winners.user_id;
            
            -- 🏆 Update level for this winner
            PERFORM public.update_user_level(v_winners.user_id);
            
            v_winner_list := v_winner_list || jsonb_build_object('rank', i, 'username', v_winners.username, 'points', v_winners.total_points, 'prize', v_prize_amount);
        END IF;
        i := i + 1;
    END LOOP;

    -- Card awarding... (rest of the logic)
    IF v_card_ultimo_id IS NOT NULL THEN
        INSERT INTO public.user_cards (user_id, card_id)
        SELECT user_id, v_card_ultimo_id FROM public.fb_league_participants 
        WHERE league_id = p_league_id AND total_points = v_min_points
        ON CONFLICT DO NOTHING;
    END IF;

    IF v_card_quasi_id IS NOT NULL AND v_max_points > v_min_points THEN
        INSERT INTO public.user_cards (user_id, card_id)
        SELECT user_id, v_card_quasi_id FROM public.fb_league_participants 
        WHERE league_id = p_league_id AND total_points = (v_max_points - 1)
        ON CONFLICT DO NOTHING;
    END IF;

    IF v_card_horto_id IS NOT NULL AND v_second_max_points IS NOT NULL AND (v_max_points - v_second_max_points) = 1 THEN
        INSERT INTO public.user_cards (user_id, card_id)
        SELECT user_id, v_card_horto_id FROM public.fb_league_participants 
        WHERE league_id = p_league_id AND total_points = v_max_points
        ON CONFLICT DO NOTHING;
    END IF;

    UPDATE public.fb_leagues SET status = 'COMPLETED' WHERE id = p_league_id;

    RETURN json_build_object('success', true, 'message', 'Premi distribuiti e Card sbloccate!', 'winners', v_winner_list);
END;
$$;
