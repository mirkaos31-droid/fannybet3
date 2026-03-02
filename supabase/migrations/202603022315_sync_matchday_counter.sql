-- Migration: Final Matchday Sync & Reindexing
-- Last archived was 29 (should be 16), current is 30 (should be 17).
-- Next should be 18.

-- Disable triggers to safely update IDs
SET session_replication_role = 'replica';

BEGIN;

-- 1. Correct Matchday 29 -> 16 (The archived one)
UPDATE public.matchdays SET id = 16 WHERE id = 29;
UPDATE public.bets SET matchday_id = 16 WHERE matchday_id = 29;
UPDATE public.survival_picks SET matchday_id = 16 WHERE matchday_id = 29;
UPDATE public.fb_league_picks SET matchday_id = 16 WHERE matchday_id = 29;

-- 2. Correct Matchday 30 -> 17 (The current OPEN one)
UPDATE public.matchdays SET id = 17 WHERE id = 30;
UPDATE public.bets SET matchday_id = 17 WHERE matchday_id = 30;
UPDATE public.survival_picks SET matchday_id = 17 WHERE matchday_id = 30;
UPDATE public.fb_league_picks SET matchday_id = 17 WHERE matchday_id = 30;

-- 3. Reset the identity sequence to start at 18
SELECT setval('public.matchdays_id_seq', 17, true);

COMMIT;

-- Restore triggers
SET session_replication_role = 'origin';
