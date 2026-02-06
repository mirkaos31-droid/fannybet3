-- Create a table for public profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  username TEXT UNIQUE,
  role TEXT DEFAULT 'USER',
  tokens NUMERIC DEFAULT 100,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Trigger to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role, tokens)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    'USER',
    100
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove existing trigger if it exists to avoid errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchdays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survival_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survival_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survival_picks ENABLE ROW LEVEL SECURITY;

-- Policies for Profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" 
  ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Policies for Matchdays
DROP POLICY IF EXISTS "Matchdays are viewable by everyone" ON public.matchdays;
CREATE POLICY "Matchdays are viewable by everyone" 
  ON public.matchdays FOR SELECT USING (true);

-- Policies for Bets
DROP POLICY IF EXISTS "Bets are viewable by everyone" ON public.bets;
CREATE POLICY "Bets are viewable by everyone" 
  ON public.bets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create their own bets" ON public.bets;
CREATE POLICY "Users can create their own bets" 
  ON public.bets FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND (
      SELECT COALESCE((deadline > now()), true) FROM public.matchdays WHERE id = matchday_id
    ) = true
  );

DROP POLICY IF EXISTS "Users can update their own bets" ON public.bets;
CREATE POLICY "Users can update their own bets" 
  ON public.bets FOR UPDATE
  USING (auth.uid() = user_id AND (
      SELECT COALESCE((deadline > now()), true) FROM public.matchdays WHERE id = matchday_id
    ) = true)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      SELECT COALESCE((deadline > now()), true) FROM public.matchdays WHERE id = matchday_id
    ) = true
  );

-- Policies for Survival
DROP POLICY IF EXISTS "Survival seasons are viewable by everyone" ON public.survival_seasons;
CREATE POLICY "Survival seasons are viewable by everyone" 
  ON public.survival_seasons FOR SELECT USING (true);

DROP POLICY IF EXISTS "Survival players viewable by everyone" ON public.survival_players;
CREATE POLICY "Survival players viewable by everyone" 
  ON public.survival_players FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can join survival" ON public.survival_players;
CREATE POLICY "Users can join survival" 
  ON public.survival_players FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Survival picks viewable by everyone" ON public.survival_picks;
CREATE POLICY "Survival picks viewable by everyone" 
  ON public.survival_picks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can make survival picks" ON public.survival_picks;
CREATE POLICY "Users can make survival picks" 
  ON public.survival_picks FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.survival_players sp
        WHERE sp.id = survival_picks.player_id
        AND sp.user_id = auth.uid()
    )
  );

-- Grant permissions to authenticated users and anon (for read)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;
