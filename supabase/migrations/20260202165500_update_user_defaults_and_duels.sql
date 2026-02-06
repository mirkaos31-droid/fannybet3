-- 1. Update Profiles Default Tokens to 0
ALTER TABLE public.profiles ALTER COLUMN tokens SET DEFAULT 0;

-- Update the handle_new_user function to use 0 as default
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role, tokens)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    'USER',
    0
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Add Wager Amount to Duels
ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS wager_amount INTEGER DEFAULT 0;

-- 3. Update Duel Creation Policy (Optional/Implicit - no RLS change needed for column addition usually if generic insert policy exists, but let's be safe)
-- Existing policy: "Users can create duels" ON public.duels FOR INSERT WITH CHECK (auth.uid() = challenger_id);
-- This covers the new column automatically.
