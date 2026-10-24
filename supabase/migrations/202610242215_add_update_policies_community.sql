/* ====================================================================
   MIGRATION: Add UPDATE policies for Community Posts and Comments
   ==================================================================== */

-- Add UPDATE policy for community_posts
DROP POLICY IF EXISTS "Users can update own posts or admin" ON public.community_posts;
CREATE POLICY "Users can update own posts or admin"
    ON public.community_posts FOR UPDATE
    USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );

-- Add UPDATE policy for community_comments
DROP POLICY IF EXISTS "Users can update own comments or admin" ON public.community_comments;
CREATE POLICY "Users can update own comments or admin"
    ON public.community_comments FOR UPDATE
    USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN')
    );
