-- Migration: Add SuperJ Card
-- Description: Adds the epic SuperJ card awarded to Super Jackpot winners.

INSERT INTO public.collectible_cards (title, description, rarity, category, image_url)
VALUES 
(
    'SuperJ', 
    'Il bersaglio grosso. Assegnata unicamente ai vincitori del Super Jackpot!', 
    'EPIC', 
    'ACHIEVEMENT',
    'https://rzyscsvzentuplsgoipv.supabase.co/storage/v1/object/public/cards/superj.png'
)
ON CONFLICT (title) DO UPDATE SET 
    description = EXCLUDED.description,
    rarity = EXCLUDED.rarity,
    image_url = EXCLUDED.image_url;
