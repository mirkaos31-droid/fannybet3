-- Add new profile fields
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS wins_1x2 INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS wins_survival INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS prediction_accuracy NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS bets_placed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_tokens_won INTEGER DEFAULT 0;

-- Create avatars bucket if not exists
-- This part might need to be done in the Supabase UI or via a policy
-- For now we just prepare the table.
