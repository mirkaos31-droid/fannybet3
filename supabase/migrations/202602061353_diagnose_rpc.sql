
CREATE OR REPLACE FUNCTION public.diagnose_all_duels()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (SELECT jsonb_agg(d) FROM (SELECT * FROM public.duels) d);
END;
$$;
