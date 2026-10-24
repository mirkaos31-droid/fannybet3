/* ====================================================================
   MIGRATION: Create Community Feed for FannyBet (Posts, Comments, Reactions)
   ==================================================================== */

CREATE TABLE IF NOT EXISTS public.community_posts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    author_name TEXT NOT NULL DEFAULT 'FannyBot',
    author_avatar TEXT,
    is_bot BOOLEAN NOT NULL DEFAULT false,
    type TEXT NOT NULL DEFAULT 'USER_POST', -- 'BOT_RESULT', 'BOT_LEADERBOARD', 'BOT_DEADLINE', 'BOT_ALERT', 'USER_POST', 'H2H_CHALLENGE'
    title TEXT,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    avatar_url TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.community_reactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    post_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_post_user_emoji UNIQUE (post_id, user_id, emoji)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON public.community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_comments_post_id ON public.community_comments(post_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_community_reactions_post_id ON public.community_reactions(post_id);

-- Enable RLS
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reactions ENABLE ROW LEVEL SECURITY;

-- Policies for community_posts
DROP POLICY IF EXISTS "Community posts are viewable by everyone" ON public.community_posts;
CREATE POLICY "Community posts are viewable by everyone"
    ON public.community_posts FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can create posts" ON public.community_posts;
CREATE POLICY "Authenticated users can create posts"
    ON public.community_posts FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete own posts or admin" ON public.community_posts;
CREATE POLICY "Users can delete own posts or admin"
    ON public.community_posts FOR DELETE
    USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Policies for community_comments
DROP POLICY IF EXISTS "Community comments are viewable by everyone" ON public.community_comments;
CREATE POLICY "Community comments are viewable by everyone"
    ON public.community_comments FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.community_comments;
CREATE POLICY "Authenticated users can create comments"
    ON public.community_comments FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own comments or admin" ON public.community_comments;
CREATE POLICY "Users can delete own comments or admin"
    ON public.community_comments FOR DELETE
    USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Policies for community_reactions
DROP POLICY IF EXISTS "Community reactions are viewable by everyone" ON public.community_reactions;
CREATE POLICY "Community reactions are viewable by everyone"
    ON public.community_reactions FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can add reactions" ON public.community_reactions;
CREATE POLICY "Authenticated users can add reactions"
    ON public.community_reactions FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can remove own reactions" ON public.community_reactions;
CREATE POLICY "Users can remove own reactions"
    ON public.community_reactions FOR DELETE
    USING (auth.uid() = user_id);

-- Helper RPC for system or admin to post as Bot cleanly
CREATE OR REPLACE FUNCTION public.create_community_bot_post(
    p_title TEXT,
    p_content TEXT,
    p_type TEXT DEFAULT 'BOT_ALERT',
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_pinned BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_post_id UUID;
BEGIN
    INSERT INTO public.community_posts (
        user_id,
        author_name,
        author_avatar,
        is_bot,
        type,
        title,
        content,
        metadata,
        pinned,
        created_at
    )
    VALUES (
        NULL,
        'FannyBot',
        '/logo.png',
        true,
        p_type,
        p_title,
        p_content,
        p_metadata,
        p_pinned,
        now()
    )
    RETURNING id INTO v_post_id;

    RETURN jsonb_build_object('success', true, 'id', v_post_id);
END;
$$;

-- Seed an initial welcome / kickoff bot post so the feed isn't empty!
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.community_posts LIMIT 1) THEN
        INSERT INTO public.community_posts (
            author_name,
            author_avatar,
            is_bot,
            type,
            title,
            content,
            created_at
        )
        VALUES (
            'FannyBot',
            '/logo.png',
            true,
            'BOT_ALERT',
            'Benvenuti ne La Curva di FannyBet! 🏟️🔥',
            'Benvenuti nello spazio ufficiale di sfottò, meme e commenti a caldo sulle partite! Qui pubblicherò in tempo reale risultati, sorpassi in classifica, cucchiai di legno e miracoli dell''ultimo minuto. Mettetevi comodi... e che vinca il migliore (o il più gufo)! 🦉🍿',
            now()
        );
    END IF;
END $$;

-- Enable Realtime publication
DO $$
BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.community_posts';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.community_comments';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.community_reactions';
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
