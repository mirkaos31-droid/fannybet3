-- Migration: Collectible Cards System
-- Description: Adds tables for card catalog and user ownership.

-- 1. Create collectible_cards Table (The Catalog)
CREATE TABLE IF NOT EXISTS public.collectible_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    image_url TEXT,
    rarity TEXT NOT NULL CHECK (rarity IN ('COMMON', 'RARE', 'EPIC', 'LEGENDARY')),
    category TEXT NOT NULL DEFAULT 'ACHIEVEMENT',
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create user_cards Table (The Collection)
CREATE TABLE IF NOT EXISTS public.user_cards (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    card_id UUID REFERENCES public.collectible_cards(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_favorite BOOLEAN DEFAULT false,
    PRIMARY KEY (user_id, card_id)
);

-- 3. Enable RLS
ALTER TABLE public.collectible_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cards ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- collectible_cards: everyone can view
CREATE POLICY "Public can view cards" ON public.collectible_cards FOR SELECT USING (true);
CREATE POLICY "Admins can manage cards" ON public.collectible_cards FOR ALL USING (public.is_admin());

-- user_cards: users can view their own, everyone can view (for "SPY" mode/leaderboard)
CREATE POLICY "Public can view user cards" ON public.user_cards FOR SELECT USING (true);
CREATE POLICY "Users can manage their favorites" ON public.user_cards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System/Admins can award cards" ON public.user_cards FOR INSERT WITH CHECK (public.is_admin() OR auth.uid() = user_id); -- For now allow user to self-award for testing, or restrict to admin

-- 5. Storage Bucket for Card Images
INSERT INTO storage.buckets (id, name, public)
VALUES ('cards', 'cards', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
DROP POLICY IF EXISTS "Public Card Images Access" ON storage.objects;
CREATE POLICY "Public Card Images Access" ON storage.objects
  FOR SELECT USING (bucket_id = 'cards');

DROP POLICY IF EXISTS "Admin Card Images Upload" ON storage.objects;
CREATE POLICY "Admin Card Images Upload" ON storage.objects
  FOR ALL USING (bucket_id = 'cards' AND public.is_admin());

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_user_cards_user_id ON user_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_user_cards_card_id ON user_cards(card_id);
