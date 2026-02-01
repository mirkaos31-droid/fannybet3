-- Migration: Add predictions to bets and cleanup
-- Description: Adds the TEXT[] column 'predictions' to the 'bets' table and removes unused columns 'team' and 'amount'.

ALTER TABLE public.bets 
ADD COLUMN IF NOT EXISTS predictions TEXT[];

-- Cleanup obsolete columns from early schema
ALTER TABLE public.bets 
DROP COLUMN IF EXISTS team,
DROP COLUMN IF EXISTS amount;

-- Update RLS if needed (already managed by previous migrations mostly, but let's ensure authenticated can insert)
GRANT INSERT, SELECT, UPDATE ON public.bets TO authenticated;
