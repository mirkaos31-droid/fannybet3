-- Migration: Fix Underdog Card Registration and Backfill
-- Description: Correctly registers the UNDERDOG card in collectible_cards and awards it retroactively.

-- 1. Register the card in the correct table
INSERT INTO public.collectible_cards (title, description, rarity, category, image_url)
VALUES (
    'UNDERDOG',
    'Sbloccata indovinando il risultato meno pronosticato in FB Lega (Bonus Underdog).',
    'RARE',
    'ACHIEVEMENT',
    'https://rzyscsvzentuplsgoipv.supabase.co/storage/v1/object/public/cards/Underdog.png'
)
ON CONFLICT (title) DO UPDATE SET
    description = EXCLUDED.description,
    rarity = EXCLUDED.rarity,
    image_url = EXCLUDED.image_url;

-- 2. Retroactive Award (Backfill)
DO $$
DECLARE
    v_card_id UUID;
    v_league_pick RECORD;
    v_matchday_id BIGINT;
    v_results TEXT[];
    v_total_picks INTEGER;
    v_pop_count INTEGER;
    i INTEGER;
BEGIN
    -- Get the card ID
    SELECT id INTO v_card_id FROM public.collectible_cards WHERE title = 'UNDERDOG';
    IF v_card_id IS NULL THEN RETURN; END IF;

    -- Iterate through all matchdays that have results
    FOR v_matchday_id, v_results IN 
        SELECT id, results FROM public.matchdays WHERE results IS NOT NULL AND status IN ('CLOSED', 'ARCHIVED')
    LOOP
        -- Process each league that had picks for this matchday
        FOR v_league_pick IN 
            SELECT DISTINCT league_id FROM public.fb_league_picks WHERE matchday_id = v_matchday_id
        LOOP
            -- Calculate total picks for this league/matchday
            SELECT COUNT(*) INTO v_total_picks FROM public.fb_league_picks 
            WHERE league_id = v_league_pick.league_id AND matchday_id = v_matchday_id;

            IF v_total_picks > 3 THEN
                -- Check each user's picks in this league/matchday
                FOR v_league_pick IN 
                    SELECT user_id, predictions FROM public.fb_league_picks 
                    WHERE league_id = v_league_pick.league_id AND matchday_id = v_matchday_id
                LOOP
                    -- Check if any of their correct picks were underdogs
                    FOR i IN 1..10 LOOP
                        IF v_league_pick.predictions[i] = v_results[i] THEN
                            -- Count how many people made this same prediction
                            SELECT COUNT(*) INTO v_pop_count FROM public.fb_league_picks 
                            WHERE league_id = v_league_pick.league_id AND matchday_id = v_matchday_id AND predictions[i] = v_results[i];

                            IF (v_pop_count::FLOAT / v_total_picks::FLOAT) < 0.15 THEN
                                -- Award the card!
                                INSERT INTO public.user_cards (user_id, card_id)
                                VALUES (v_league_pick.user_id, v_card_id)
                                ON CONFLICT DO NOTHING;
                                EXIT; -- Only need one underdog pick to get the card
                            END IF;
                        END IF;
                    END LOOP;
                END LOOP;
            END IF;
        END LOOP;
    END LOOP;
END;
$$;
