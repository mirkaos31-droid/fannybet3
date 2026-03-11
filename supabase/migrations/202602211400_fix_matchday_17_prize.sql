-- Fix for matchday 17 prize pot issue
-- El Barto should have received 5 tokens for winning matchday 17
-- but the pot was incorrectly recorded as 0

-- Update matchday 17 with correct pot and winner
UPDATE public.matchdays
SET
  current_pot = 5,
  winners = '["El Barto"]'::jsonb,
  winner_animation = true
WHERE id = 17;

-- Award 5 tokens to El Barto for the win
UPDATE public.profiles
SET
  tokens = tokens + 5,
  wins_1x2 = wins_1x2 + 1,
  total_tokens_won = total_tokens_won + 5
WHERE username = 'El Barto';