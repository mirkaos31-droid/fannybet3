-- Seed: First Card "Il Maestro del 5-5-5"
INSERT INTO public.collectible_cards (title, description, rarity, category, image_url)
VALUES (
    'Il Maestro del 5-5-5', 
    'Dedicata a chi ha saputo distinguersi per la sua strategia... alternativa. Ultimo posto sudato!', 
    'LEGENDARY', 
    'ACHIEVEMENT',
    'https://i.ibb.co/vzG7ZzG/cana-placeholder.png' -- Placeholder or I can use a generic asset if available
) ON CONFLICT DO NOTHING;
