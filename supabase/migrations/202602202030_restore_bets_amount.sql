-- Migration: Restore 'amount' column to bets table
-- Description: The 'amount' column was dropped in a previous migration but is now required for token auditing in the 'submit_1x2_bet' RPC.

ALTER TABLE public.bets 
ADD COLUMN IF NOT EXISTS amount INTEGER DEFAULT 1;

-- Update existing bets to have a default amount of 1 (standard bet)
UPDATE public.bets SET amount = 1 WHERE amount IS NULL;

-- Ensure RLS and permissions are correct (inherited, but being defensive)
GRANT ALL ON public.bets TO authenticated;
GRANT ALL ON public.bets TO postgres;
GRANT ALL ON public.bets TO service_role;
