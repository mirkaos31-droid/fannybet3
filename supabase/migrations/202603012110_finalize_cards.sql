-- Update Card URLs based on Supabase Storage
UPDATE public.collectible_cards 
SET image_url = 'https://rzyscsvzentuplsgoipv.supabase.co/storage/v1/object/public/cards/Ultimo.png'
WHERE title = 'Il Maestro del 5-5-5';

UPDATE public.collectible_cards 
SET image_url = 'https://rzyscsvzentuplsgoipv.supabase.co/storage/v1/object/public/cards/Rettangolo.png'
WHERE title = 'C''eri quasi!';

-- Function to Award a Card to a User
CREATE OR REPLACE FUNCTION public.award_card_to_user(p_username TEXT, p_card_title TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_card_id UUID;
BEGIN
    -- Admin check
    IF NOT public.is_admin() THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- Get IDs
    SELECT id INTO v_user_id FROM public.profiles WHERE username = p_username;
    SELECT id INTO v_card_id FROM public.collectible_cards WHERE title = p_card_title;

    IF v_user_id IS NULL OR v_card_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'User or Card not found');
    END IF;

    -- Award card
    INSERT INTO public.user_cards (user_id, card_id)
    VALUES (v_user_id, v_card_id)
    ON CONFLICT DO NOTHING;

    RETURN json_build_object('success', true, 'message', 'Card awarded successfully');
END;
$$;
