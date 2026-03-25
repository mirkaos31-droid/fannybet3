-- =============================================================
-- RETROFIX: Bonuses missing on Lega X 2026 - Round 2
-- =============================================================
-- STEP 1 — DIAGNOSI (esegui prima questo blocco per verificare la situazione)
-- Sostituisci <LEAGUE_ID> e <MATCHDAY_ID> con i valori reali.
--
-- Per trovare i valori giusti:
--   SELECT id, name, current_round FROM public.fb_leagues;
--   SELECT id, deadline, status FROM public.matchdays ORDER BY id DESC LIMIT 10;
-- =============================================================

-- ► LEGGI PRIMA: Trova l'id della lega e della giornata 2
-- SELECT id, name, current_round FROM public.fb_leagues WHERE name ILIKE '%lega x%';
-- SELECT flp.matchday_id, flp.user_id, flp.points_earned, flp.predictions,
--        m.results, m.jolly_match_index
-- FROM public.fb_league_picks flp
-- JOIN public.matchdays m ON m.id = flp.matchday_id
-- WHERE flp.league_id = <LEAGUE_ID>
-- ORDER BY flp.matchday_id;


-- =============================================================
-- STEP 2 — FIX (esegui questo dopo aver verificato i dati sopra)
-- Imposta qui le variabili corrette:
-- =============================================================

DO $$
DECLARE
    v_league_id   BIGINT := 2;  -- Lega Serie X 2026
    v_matchday_id BIGINT := 18; -- Giornata 2 (la giornata senza bonus)

    v_results     TEXT[];
    v_jolly_idx   INTEGER;
    v_pick        RECORD;

    v_score_old   INTEGER;
    v_score_new   INTEGER;
    v_consecutive INTEGER;
    v_max_cons    INTEGER;
    v_correct     INTEGER;
    v_delta       INTEGER;

    i INTEGER;
BEGIN
    -- Assicuriamoci che i parametri siano stati impostati
    IF v_league_id IS NULL OR v_matchday_id IS NULL THEN
        RAISE EXCEPTION 'Imposta v_league_id e v_matchday_id prima di eseguire il fix!';
    END IF;

    -- Leggi i risultati della giornata (non richiede che sia CLOSED, solo che abbia results)
    SELECT results, jolly_match_index
    INTO v_results, v_jolly_idx
    FROM public.matchdays
    WHERE id = v_matchday_id;

    IF v_results IS NULL THEN
        RAISE EXCEPTION 'Nessun risultato trovato per la giornata id=%', v_matchday_id;
    END IF;

    RAISE NOTICE 'Risultati giornata %: %', v_matchday_id, v_results;
    RAISE NOTICE 'Jolly index: %', v_jolly_idx;

    -- Itera su TUTTI i pick della giornata (anche quelli già risolti con points_earned != NULL)
    FOR v_pick IN
        SELECT id, user_id, predictions, points_earned
        FROM public.fb_league_picks
        WHERE league_id = v_league_id AND matchday_id = v_matchday_id
    LOOP
        v_score_new := 0;
        v_consecutive := 0;
        v_max_cons := 0;
        v_correct := 0;

        -- Calcola il punteggio corretto con TUTTI i bonus
        FOR i IN 1..10 LOOP
            IF v_pick.predictions[i] = v_results[i] THEN
                v_correct := v_correct + 1;
                v_consecutive := v_consecutive + 1;

                -- Punteggio base: X = 2pt, 1 o 2 = 1pt
                IF v_results[i] = 'X' THEN
                    v_score_new := v_score_new + 2;
                ELSE
                    v_score_new := v_score_new + 1;
                END IF;

                -- Bonus Jolly: +2 se indovinata ed è la partita jolly (jolly_match_index è 0-indexed)
                IF v_jolly_idx IS NOT NULL AND (i - 1) = v_jolly_idx THEN
                    v_score_new := v_score_new + 2;
                END IF;

                IF v_consecutive > v_max_cons THEN
                    v_max_cons := v_consecutive;
                END IF;
            ELSE
                v_consecutive := 0;
            END IF;
        END LOOP;

        -- Bonus Strike: +3 per 3+ risultati consecutivi indovinati
        IF v_max_cons >= 3 THEN
            v_score_new := v_score_new + 3;
        END IF;

        -- Bonus En Plein: +10 per tutte e 10 corrette
        IF v_correct = 10 THEN
            v_score_new := v_score_new + 10;
        END IF;

        -- Calcola il delta rispetto al punteggio precedente
        v_score_old := COALESCE(v_pick.points_earned, 0);
        v_delta := v_score_new - v_score_old;

        RAISE NOTICE 'User %, pick %, old=%, new=%, delta=%',
            v_pick.user_id, v_pick.id, v_score_old, v_score_new, v_delta;

        IF v_delta != 0 THEN
            -- Aggiorna il pick
            UPDATE public.fb_league_picks
            SET points_earned = v_score_new
            WHERE id = v_pick.id;

            -- Aggiorna i punti totali del partecipante nella lega
            UPDATE public.fb_league_participants
            SET total_points = total_points + v_delta
            WHERE league_id = v_league_id AND user_id = v_pick.user_id;

            RAISE NOTICE '  ✓ Aggiornato: delta % applicato a user %', v_delta, v_pick.user_id;
        ELSE
            RAISE NOTICE '  - Nessuna modifica necessaria per user %', v_pick.user_id;
        END IF;

    END LOOP;

    RAISE NOTICE '✅ Fix completato per lega % giornata %', v_league_id, v_matchday_id;
END;
$$;


-- =============================================================
-- STEP 3 — VERIFICA FINALE
-- Dopo aver eseguito il fix, controlla i risultati:
-- =============================================================
-- SELECT
--     p.username,
--     flp.predictions,
--     flp.points_earned,
--     flp_part.total_points AS total_lega_points
-- FROM public.fb_league_picks flp
-- JOIN public.fb_league_participants flp_part
--     ON flp_part.league_id = flp.league_id AND flp_part.user_id = flp.user_id
-- JOIN public.profiles p ON p.id = flp.user_id
-- WHERE flp.league_id = <LEAGUE_ID> AND flp.matchday_id = <MATCHDAY_ID>
-- ORDER BY flp_part.total_points DESC;
