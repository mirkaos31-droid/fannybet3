-- Migration: Add atomic function to increment matchday prize pool
-- This prevents race conditions when multiple users bet simultaneously

CREATE OR REPLACE FUNCTION public.increment_matchday_pot(p_matchday_id BIGINT, p_amount NUMERIC)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.matchdays
  SET current_pot = current_pot + p_amount,
      updated_at = now()
  WHERE id = p_matchday_id;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.increment_matchday_pot(BIGINT, NUMERIC) TO authenticated;
