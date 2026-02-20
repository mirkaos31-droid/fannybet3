-- Migration: Remove "Sfide" (Duels) Feature Objects
-- Description: Drops the duels table, associated types, and all RPC functions related to the duel system.

-- 1. Drop the table and associated policies/triggers
DROP TABLE IF EXISTS public.duels CASCADE;

-- 2. Drop the custom enum type
DROP TYPE IF EXISTS public.duel_status CASCADE;

-- 3. Drop all duel-related functions
DROP FUNCTION IF EXISTS public.get_challengeable_users(INTEGER);
DROP FUNCTION IF EXISTS public.calculate_user_matchday_score(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.create_duel_secure(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.accept_duel_secure(BIGINT);
DROP FUNCTION IF EXISTS public.decline_duel_secure(BIGINT);
DROP FUNCTION IF EXISTS public.live_scores(public.duels);
DROP FUNCTION IF EXISTS public.resolve_matchday_duels(INTEGER);
DROP FUNCTION IF EXISTS public.resolve_matchday_duels(BIGINT);
DROP FUNCTION IF EXISTS public.admin_create_matchday_cleanup_duels(INTEGER);
DROP FUNCTION IF EXISTS public.diagnose_all_duels();

-- 4. Cleanup any diagnostic functions that mention duels if they exist
DROP FUNCTION IF EXISTS public.diagnose_duels_rpc();

-- Note: Other tables (profiles, matchdays) remain intact as they only had weak references or were shared.
