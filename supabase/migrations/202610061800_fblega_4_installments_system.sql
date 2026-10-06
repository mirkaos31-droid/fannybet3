-- Migration: FB Lega 4-Installments Payment System (Iscrizione + 3 Rate)
-- Description:
--   1. Adds installments_paid column to fb_league_participants.
--   2. Updates join_fb_league to register participant with installments_paid = 1 (Rata 1) for installments leagues.
--   3. Adds pay_fb_league_installment RPC to allow paying subsequent installments (Rate 2, 3, 4) with atomicity and prize pool synchronization.
--   4. Updates submit_fb_league_picks to enforce that the required installment for the matchday's phase is paid before picks can be submitted.

-- 1. Schema update
ALTER TABLE public.fb_league_participants 
ADD COLUMN IF NOT EXISTS installments_paid INTEGER DEFAULT 1;

-- Backfill existing participants
UPDATE public.fb_league_participants p
SET installments_paid = CASE 
    WHEN (SELECT COALESCE(l.scoring_rules->>'payment_mode', 'full') FROM public.fb_leagues l WHERE l.id = p.league_id) = 'installments' THEN 1
    ELSE 4
END
WHERE p.installments_paid IS NULL;

-- 2. Update join_fb_league
CREATE OR REPLACE FUNCTION public.join_fb_league(p_league_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_entry_fee INTEGER;
    v_user_tokens NUMERIC;
    v_league_status TEXT;
    v_start_matchday_id BIGINT;
    v_deadline TIMESTAMPTZ;
    v_rules JSONB;
    v_payment_mode TEXT;
    v_initial_installments INTEGER := 1;
BEGIN
    -- Check if league exists and get settings
    SELECT entry_fee, status, start_matchday_id, scoring_rules
    INTO v_entry_fee, v_league_status, v_start_matchday_id, v_rules
    FROM public.fb_leagues WHERE id = p_league_id;

    IF v_league_status IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Lega non trovata');
    END IF;

    IF v_league_status != 'OPEN' THEN
        RETURN json_build_object('success', false, 'message', 'Iscrizioni chiuse per questa lega');
    END IF;

    -- Check if the start matchday deadline has passed
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

    v_payment_mode := COALESCE(v_rules->>'payment_mode', 'full');
    IF v_payment_mode = 'installments' THEN
        v_initial_installments := 1; -- Rata 1 (Iscrizione)
    ELSE
        v_initial_installments := 4; -- Pagamento unico, tutte le rate coperte
    END IF;

    -- Check tokens with FOR UPDATE for atomicity
    SELECT tokens INTO v_user_tokens FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
    IF v_user_tokens < v_entry_fee THEN
        RETURN json_build_object('success', false, 'message', 'Token insufficienti');
    END IF;

    -- Deduct tokens and increment bets_placed
    UPDATE public.profiles 
    SET tokens = tokens - v_entry_fee,
        bets_placed = COALESCE(bets_placed, 0) + 1
    WHERE id = auth.uid();

    -- Add to prize pool
    UPDATE public.fb_leagues SET prize_pool = prize_pool + v_entry_fee WHERE id = p_league_id;

    -- Add participant with installments_paid
    INSERT INTO public.fb_league_participants (league_id, user_id, installments_paid)
    VALUES (p_league_id, auth.uid(), v_initial_installments);

    -- Update level
    PERFORM public.update_user_level(auth.uid());

    RETURN json_build_object(
        'success', true, 
        'message', CASE 
            WHEN v_payment_mode = 'installments' THEN 'Iscrizione effettuata con successo! (Rata 1 di 4 saldata)'
            ELSE 'Iscrizione effettuata con successo!'
        END
    );
END;
$$;

-- 3. New pay_fb_league_installment RPC
CREATE OR REPLACE FUNCTION public.pay_fb_league_installment(p_league_id BIGINT)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_uid UUID;
    v_entry_fee INTEGER;
    v_league_status TEXT;
    v_league_name TEXT;
    v_rules JSONB;
    v_user_tokens NUMERIC;
    v_current_paid INTEGER;
    v_next_installment INTEGER;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Non autenticato');
    END IF;

    SELECT name, entry_fee, status, scoring_rules
    INTO v_league_name, v_entry_fee, v_league_status, v_rules
    FROM public.fb_leagues WHERE id = p_league_id;

    IF v_league_status IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Lega non trovata');
    END IF;

    IF v_league_status = 'COMPLETED' THEN
        RETURN json_build_object('success', false, 'message', 'Questa lega è già conclusa');
    END IF;

    IF COALESCE(v_rules->>'payment_mode', 'full') != 'installments' THEN
        RETURN json_build_object('success', false, 'message', 'Questa lega non prevede pagamento a rate');
    END IF;

    -- Lock and get participant installments_paid
    SELECT COALESCE(installments_paid, 1) INTO v_current_paid
    FROM public.fb_league_participants
    WHERE league_id = p_league_id AND user_id = v_uid
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Non sei iscritto a questa lega');
    END IF;

    IF v_current_paid >= 4 THEN
        RETURN json_build_object('success', false, 'message', 'Tutte le 4 rate sono già state saldate');
    END IF;

    v_next_installment := v_current_paid + 1;

    -- Check tokens
    SELECT tokens INTO v_user_tokens FROM public.profiles WHERE id = v_uid FOR UPDATE;
    IF v_user_tokens < v_entry_fee THEN
        RETURN json_build_object('success', false, 'message', 'Token insufficienti per saldare la Rata ' || v_next_installment || ' (' || v_entry_fee || ' FTK richiesti)');
    END IF;

    -- Deduct tokens from profile
    UPDATE public.profiles
    SET tokens = tokens - v_entry_fee
    WHERE id = v_uid;

    -- Increment league prize pool
    UPDATE public.fb_leagues
    SET prize_pool = prize_pool + v_entry_fee
    WHERE id = p_league_id;

    -- Update participant installments_paid
    UPDATE public.fb_league_participants
    SET installments_paid = v_next_installment
    WHERE league_id = p_league_id AND user_id = v_uid;

    -- Send in-app notification
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
        v_uid,
        '💳 Rata ' || v_next_installment || ' Pagata',
        'Hai saldato la Rata ' || v_next_installment || ' di 4 per la lega ' || v_league_name || ' (' || v_entry_fee || ' FTK).',
        'success'
    );

    RETURN json_build_object(
        'success', true, 
        'message', 'Rata ' || v_next_installment || ' saldata con successo!', 
        'installments_paid', v_next_installment,
        'next_installment', v_next_installment
    );
END;
$$;

-- 4. Update submit_fb_league_picks to enforce installment
CREATE OR REPLACE FUNCTION public.submit_fb_league_picks(
    p_league_id BIGINT,
    p_matchday_id BIGINT,
    p_predictions TEXT[],
    p_secret_match_index INTEGER DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_uid UUID;
    v_deadline TIMESTAMPTZ;
    v_locked BOOLEAN;
    v_rules JSONB;
    v_entry_fee INTEGER;
    v_round_num INTEGER;
    v_tranches JSONB;
    v_t1 INTEGER;
    v_t2 INTEGER;
    v_t3 INTEGER;
    v_req_installment INTEGER := 1;
    v_paid_installments INTEGER := 1;
BEGIN
    v_uid := auth.uid();
    IF v_uid IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Non autenticato');
    END IF;

    -- Check membership
    IF NOT EXISTS (
        SELECT 1 FROM public.fb_league_participants 
        WHERE league_id = p_league_id AND user_id = v_uid
    ) THEN
        RETURN json_build_object('success', false, 'message', 'Non sei iscritto a questa lega');
    END IF;

    -- Check matchday deadline & lock
    SELECT deadline, COALESCE(bets_locked, false) INTO v_deadline, v_locked
    FROM public.matchdays WHERE id = p_matchday_id;

    IF v_locked OR (v_deadline IS NOT NULL AND v_deadline < now()) THEN
        RETURN json_build_object('success', false, 'message', 'Pronostici chiusi per questa giornata');
    END IF;

    -- Check installments if payment_mode is 'installments'
    SELECT scoring_rules, entry_fee INTO v_rules, v_entry_fee
    FROM public.fb_leagues WHERE id = p_league_id;

    IF COALESCE(v_rules->>'payment_mode', 'full') = 'installments' THEN
        -- Find round_number of this matchday
        SELECT round_number INTO v_round_num
        FROM public.get_fb_league_matchdays(p_league_id)
        WHERE matchday_id = p_matchday_id;

        IF v_round_num IS NOT NULL THEN
            v_tranches := v_rules->'payment_tranches';
            IF v_tranches IS NOT NULL AND jsonb_array_length(v_tranches) = 4 THEN
                v_t1 := (v_tranches->>0)::INTEGER;
                v_t2 := (v_tranches->>1)::INTEGER;
                v_t3 := (v_tranches->>2)::INTEGER;

                IF v_round_num <= v_t1 THEN
                    v_req_installment := 1;
                ELSIF v_round_num <= (v_t1 + v_t2) THEN
                    v_req_installment := 2;
                ELSIF v_round_num <= (v_t1 + v_t2 + v_t3) THEN
                    v_req_installment := 3;
                ELSE
                    v_req_installment := 4;
                END IF;

                SELECT COALESCE(installments_paid, 1) INTO v_paid_installments
                FROM public.fb_league_participants
                WHERE league_id = p_league_id AND user_id = v_uid;

                IF v_paid_installments < v_req_installment THEN
                    RETURN json_build_object(
                        'success', false, 
                        'message', 'Per compilare la schedina della Fase ' || v_req_installment || ' (Round ' || v_round_num || ') devi saldare la Rata ' || v_req_installment || ' (' || v_entry_fee || ' FTK).',
                        'required_installment', v_req_installment,
                        'installments_paid', v_paid_installments
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    -- Insert or Update pick
    INSERT INTO public.fb_league_picks (league_id, matchday_id, user_id, predictions, secret_match_index, updated_at)
    VALUES (p_league_id, p_matchday_id, v_uid, p_predictions, p_secret_match_index, now())
    ON CONFLICT (league_id, matchday_id, user_id) 
    DO UPDATE SET 
        predictions = EXCLUDED.predictions,
        secret_match_index = EXCLUDED.secret_match_index,
        updated_at = now();

    RETURN json_build_object('success', true, 'message', 'Pronostici e Match Segreto salvati con successo!');
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.join_fb_league(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_fb_league_installment(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_fb_league_picks(BIGINT, BIGINT, TEXT[], INTEGER) TO authenticated;
