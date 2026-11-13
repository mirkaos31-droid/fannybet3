/* ====================================================================
   MIGRATION: Create Cyber Murales Wall System
   ==================================================================== */

CREATE TABLE IF NOT EXISTS public.murales_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    username TEXT NOT NULL DEFAULT 'Anon',
    avatar_url TEXT,
    message TEXT NOT NULL CHECK (char_length(message) <= 140),
    color TEXT NOT NULL DEFAULT 'neon-cyan', -- neon-cyan, acid-green, hot-pink, electric-purple, sun-orange, pure-white
    font_style TEXT NOT NULL DEFAULT 'spray', -- spray, stencil, marker, drip, neon
    rotation NUMERIC NOT NULL DEFAULT 0, -- angle in degrees, e.g. -10 to +10
    pos_x NUMERIC NOT NULL DEFAULT 50, -- 0 to 100 percentage
    pos_y NUMERIC NOT NULL DEFAULT 50, -- 0 to 100 percentage
    scale NUMERIC NOT NULL DEFAULT 1.0,
    likes_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.murales_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tag_id UUID REFERENCES public.murales_tags(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reaction_type TEXT NOT NULL DEFAULT 'fire', -- fire, bomb, spray, skull, crown
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_murales_tag_user_reaction UNIQUE (tag_id, user_id, reaction_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_murales_tags_created_at ON public.murales_tags(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_murales_reactions_tag_id ON public.murales_reactions(tag_id);

-- Enable RLS
ALTER TABLE public.murales_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.murales_reactions ENABLE ROW LEVEL SECURITY;

-- Policies for murales_tags
DROP POLICY IF EXISTS "Murales tags viewable by everyone" ON public.murales_tags;
CREATE POLICY "Murales tags viewable by everyone" ON public.murales_tags
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create murales tags" ON public.murales_tags;
CREATE POLICY "Authenticated users can create murales tags" ON public.murales_tags
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own murales tags" ON public.murales_tags;
CREATE POLICY "Users can delete their own murales tags" ON public.murales_tags
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id OR public.is_admin());

-- Policies for murales_reactions
DROP POLICY IF EXISTS "Murales reactions viewable by everyone" ON public.murales_reactions;
CREATE POLICY "Murales reactions viewable by everyone" ON public.murales_reactions
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can react to murales tags" ON public.murales_reactions;
CREATE POLICY "Authenticated users can react to murales tags" ON public.murales_reactions
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove their own reactions" ON public.murales_reactions;
CREATE POLICY "Users can remove their own reactions" ON public.murales_reactions
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- Enable Realtime for murales_tags and murales_reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.murales_tags;
ALTER PUBLICATION supabase_realtime ADD TABLE public.murales_reactions;

