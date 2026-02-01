-- Migration: Add include_super_jackpot to bets
-- Description: Adds a boolean flag to track if a bet includes the SuperJackpot option (extra token).

ALTER TABLE public.bets 
ADD COLUMN IF NOT EXISTS include_super_jackpot BOOLEAN DEFAULT false;

-- Update existing bets to false as they were 2 tokens by default before (but we'll start fresh with the new logic)
UPDATE public.bets SET include_super_jackpot = false WHERE include_super_jackpot IS NULL;
