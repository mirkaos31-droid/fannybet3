-- Migration: Historical Leaderboard RPC
-- Description: Adds an RPC to fetch the leaderboard for a specific past matchday.

CREATE OR REPLACE FUNCTION public.get_fb_league_historical_leaderboard(p_league_id BIGINT, p_matchday_id BIGINT)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    points_matchday INTEGER,
    points_total INTEGER,
    rank INTEGER,
    active_bonuses JSONB
) 
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mr.user_id,
        p.username,
        mr.points_matchday,
        mr.points_total,
        mr.rank,
        mr.active_bonuses
    FROM public.fb_league_matchday_results mr
    JOIN public.profiles p ON p.id = mr.user_id
    WHERE mr.league_id = p_league_id AND mr.matchday_id = p_matchday_id
    ORDER BY mr.rank ASC, p.username ASC;
END;
$$;
