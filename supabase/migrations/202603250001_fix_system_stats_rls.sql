-- Migration: Fix RLS on system_stats table
-- Resolves Supabase security warning: "Detects cases where row level security (RLS) 
-- has not been enabled on tables in schemas exposed to PostgREST."
-- The system_stats table was created without RLS in 202602261400_add_burned_tokens_tracking.sql

-- 1. Enable RLS
ALTER TABLE public.system_stats ENABLE ROW LEVEL SECURITY;

-- 2. Policies
-- Only admins can read system stats (e.g., burned_tokens counter shown in admin panel)
DROP POLICY IF EXISTS "Admins can view system stats" ON public.system_stats;
CREATE POLICY "Admins can view system stats"
  ON public.system_stats FOR SELECT
  USING (public.is_admin());

-- Only the service role (used in SECURITY DEFINER functions) can insert/update.
-- No direct INSERT/UPDATE policy needed for regular users: the submit_1x2_bet and
-- reset_fanny_system functions are SECURITY DEFINER and bypass RLS automatically.
-- Admins can also update directly if needed.
DROP POLICY IF EXISTS "Admins can manage system stats" ON public.system_stats;
CREATE POLICY "Admins can manage system stats"
  ON public.system_stats FOR ALL
  USING (public.is_admin());
