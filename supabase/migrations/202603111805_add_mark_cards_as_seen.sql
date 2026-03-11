-- Migration: Add mark_cards_as_seen RPC
-- Description: Defines the RPC function to mark all user cards as seen in the gallery.

CREATE OR REPLACE FUNCTION public.mark_cards_as_seen()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.user_cards 
    SET seen_in_gallery = true 
    WHERE user_id = auth.uid() AND seen_in_gallery = false;
END;
$$;
