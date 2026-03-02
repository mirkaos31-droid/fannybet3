-- Migration: Consolidated Cards System Fix (Strict 6-Card Version)
-- Description: Ensures schema integrity, seeds EXACTLY 6 cards (including Survival), and finalizes award logic.

-- 1. Ensure schema integrity
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'collectible_cards_title_key') THEN
        ALTER TABLE public.collectible_cards ADD CONSTRAINT collectible_cards_title_key UNIQUE (title);
    END IF;
END $$;

ALTER TABLE public.user_cards ADD COLUMN IF NOT EXISTS seen_in_gallery BOOLEAN DEFAULT false;

-- 2. CLEANUP: Remove any card that is not in the official 6-card set
DELETE FROM public.collectible_cards 
WHERE title NOT IN ('Il Maestro del 5-5-5', 'C''eri quasi!', 'Horto muso', 'Hat-trick', 'Ultimo Posto', 'Survival');

-- 3. Seed/Update EXACTLY 6 Card Definitions
INSERT INTO public.collectible_cards (title, description, rarity, category, image_url)
VALUES 
(
    'Il Maestro del 5-5-5', 
    'Dedicata a chi ha saputo distinguersi per la sua strategia... alternativa. Ultimo posto sudato!', 
    'LEGENDARY', 
    'ACHIEVEMENT',
    'https://rzyscsvzentuplsgoipv.supabase.co/storage/v1/object/public/cards/Ultimo.png'
),
(
    'C''eri quasi!', 
    'A un passo dal trono. Perdere la lega per un solo punto è un''impresa da veri duri.', 
    'RARE', 
    'ACHIEVEMENT',
    'https://rzyscsvzentuplsgoipv.supabase.co/storage/v1/object/public/cards/Rettangolo.png'
),
(
    'Horto muso', 
    'Vincere di misura è un''arte. Primo posto conquistato per un solo punto di distacco!', 
    'RARE', 
    'ACHIEVEMENT',
    'https://rzyscsvzentuplsgoipv.supabase.co/storage/v1/object/public/cards/Corto muso.png'
),
(
    'Hat-trick', 
    'Cecchino infallibile. Tre risultati indovinati consecutivamente in una singola giornata!', 
    'COMMON', 
    'ACHIEVEMENT',
    'https://rzyscsvzentuplsgoipv.supabase.co/storage/v1/object/public/cards/Hat-trick.png'
),
(
    'Ultimo Posto', 
    'La gloria è effimera, ma il fondo della classifica è eterno.', 
    'COMMON', 
    'ACHIEVEMENT',
    'https://rzyscsvzentuplsgoipv.supabase.co/storage/v1/object/public/cards/Ultimo.png'
),
(
    'Survival', 
    'Sopravvissuto all''arena. Vincitore di una stagione Survival!', 
    'RARE', 
    'ACHIEVEMENT',
    'https://rzyscsvzentuplsgoipv.supabase.co/storage/v1/object/public/cards/Survival.png'
)
ON CONFLICT (title) DO UPDATE SET 
    description = EXCLUDED.description,
    rarity = EXCLUDED.rarity,
    image_url = EXCLUDED.image_url;

-- 4. Re-synchronize award functions

-- A. Liga League Prizes
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
            v_winner_list := v_winner_list || jsonb_build_object('rank', i, 'username', v_winners.username, 'points', v_winners.total_points, 'prize', v_prize_amount);
        END IF;
        i := i + 1;
    END LOOP;

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

-- B. League Round Resolution (Hat-trick)
CREATE OR REPLACE FUNCTION public.resolve_fb_league_round(p_league_id BIGINT, p_matchday_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_league_rules JSONB;
    v_match_results TEXT[];
    v_pick RECORD;
    v_points INTEGER;
    i INTEGER;
    v_sign TEXT;
    v_total_resolved INTEGER := 0;
    v_consecutive_correct INTEGER;
    v_max_consecutive INTEGER;
    v_card_hattrick_id UUID;
BEGIN
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'message', 'Azione riservata agli amministratori');
    END IF;

    SELECT scoring_rules INTO v_league_rules FROM public.fb_leagues WHERE id = p_league_id;
    SELECT results INTO v_match_results FROM public.matchdays WHERE id = p_matchday_id;

    IF v_match_results IS NULL OR array_length(v_match_results, 1) < 10 THEN
        RETURN json_build_object('success', false, 'message', 'Risultati della giornata non ancora completi per la Lega (minimo 10 match)');
    END IF;

    SELECT id INTO v_card_hattrick_id FROM public.collectible_cards WHERE title = 'Hat-trick';

    FOR v_pick IN 
        SELECT * FROM public.fb_league_picks 
        WHERE league_id = p_league_id AND matchday_id = p_matchday_id AND points_earned IS NULL
    LOOP
        v_points := 0;
        v_consecutive_correct := 0;
        v_max_consecutive := 0;

        FOR i IN 1..10 LOOP
            v_sign := v_pick.predictions[i];
            IF v_sign = v_match_results[i] THEN
                v_points := v_points + COALESCE((v_league_rules->>v_sign)::INTEGER, 1);
                v_consecutive_correct := v_consecutive_correct + 1;
                IF v_consecutive_correct > v_max_consecutive THEN
                    v_max_consecutive := v_consecutive_correct;
                END IF;
            ELSE
                v_consecutive_correct := 0;
            END IF;
        END LOOP;

        UPDATE public.fb_league_picks SET points_earned = v_points WHERE id = v_pick.id;

        UPDATE public.fb_league_participants 
        SET total_points = total_points + v_points 
        WHERE league_id = p_league_id AND user_id = v_pick.user_id;

        IF v_card_hattrick_id IS NOT NULL AND v_max_consecutive >= 3 THEN
            INSERT INTO public.user_cards (user_id, card_id)
            VALUES (v_pick.user_id, v_card_hattrick_id)
            ON CONFLICT DO NOTHING;
        END IF;

        v_total_resolved := v_total_resolved + 1;
    END LOOP;

    UPDATE public.fb_leagues SET current_round = current_round + 1 WHERE id = p_league_id;

    RETURN json_build_object('success', true, 'message', 'Round risolto e Card sbloccate!', 'resolved_count', v_total_resolved);
END;
$$;

-- C. Survival Winner Automation (Survival Card)
CREATE OR REPLACE FUNCTION public.close_survival_season(p_season_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_winner_id UUID;
  v_winner_username TEXT;
  v_prize_pool INTEGER;
  v_entry_fee INTEGER;
  v_prize_to_award INTEGER;
  v_alive_count INTEGER;
  v_card_survival_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN'
  ) THEN
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

  -- 🏆 AWARD SURVIVAL CARD
  SELECT id INTO v_card_survival_id FROM public.collectible_cards WHERE title = 'Survival';
  IF v_card_survival_id IS NOT NULL THEN
      INSERT INTO public.user_cards (user_id, card_id)
      VALUES (v_winner_id, v_card_survival_id)
      ON CONFLICT DO NOTHING;
  END IF;

  -- Close the season and set finished_at
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
