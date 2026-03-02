-- Migration: Add 1x2 Winner Card
-- Description: Adds the winner card for the 1x2 mode after the consolidated fix.

-- 1. Seed the 1x2 Winner Card
INSERT INTO public.collectible_cards (title, description, rarity, category, image_url)
VALUES 
(
    '1x2 Winner', 
    'Campione del pronostico. Assegnata a chi trionfa in una giornata della modalità 1x2!', 
    'COMMON', 
    'ACHIEVEMENT',
    'https://rzyscsvzentuplsgoipv.supabase.co/storage/v1/object/public/cards/1x2%20winner.png'
)
ON CONFLICT (title) DO UPDATE SET 
    description = EXCLUDED.description,
    rarity = EXCLUDED.rarity,
    image_url = EXCLUDED.image_url;
