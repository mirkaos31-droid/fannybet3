-- Add missing columns to matchdays table
ALTER TABLE public.matchdays 
ADD COLUMN IF NOT EXISTS matches JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS results TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS current_pot NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS rollover_pot NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'OPEN';

-- Add admin function to process survival round (simple version, logic can be hybrid)
-- This function can be used to set a player as eliminated directly
CREATE OR REPLACE FUNCTION public.eliminate_survival_players(p_player_ids BIGINT[])
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE survival_players
  SET eliminated = true
  WHERE id = ANY(p_player_ids);
END;
$$;

-- Function to advance a specific player (optional, if we want to track 'passed')
-- For now 'not eliminated' is enough.

-- Ensure Admin role management (simple manual promotion for now)
-- We can add a function to promote a user to admin
CREATE OR REPLACE FUNCTION public.promote_to_admin(p_email TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.profiles
  SET role = 'ADMIN'
  WHERE id = (SELECT id FROM auth.users WHERE email = p_email);
END;
$$;
