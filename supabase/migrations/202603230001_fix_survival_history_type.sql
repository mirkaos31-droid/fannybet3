-- Migration: Fix Survival Winner History Type Mismatch
-- Description: Updates get_survival_winner_history to use NUMERIC for prize_pool, matching the table schema.

DROP FUNCTION IF EXISTS public.get_survival_winner_history(p_limit INTEGER);

CREATE OR REPLACE FUNCTION public.get_survival_winner_history(p_limit INTEGER DEFAULT 3)
RETURNS TABLE (
    season_id BIGINT,
    finished_at TIMESTAMPTZ,
    prize_pool NUMERIC, -- Fixed from INTEGER to NUMERIC
    entry_fee INTEGER,
    winner_id UUID,
    username TEXT,
    avatar_url TEXT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id as season_id,
        s.finished_at,
        s.prize_pool,
        s.entry_fee,
        p.user_id as winner_id,
        pr.username,
        pr.avatar_url
    FROM public.survival_seasons s
    JOIN public.survival_players p ON s.id = p.season_id
    JOIN public.profiles pr ON p.user_id = pr.id
    WHERE s.status = 'COMPLETED' 
    AND p.status = 'WINNER'
    ORDER BY s.finished_at DESC NULLS LAST, s.id DESC
    LIMIT p_limit;
END;
$$;
