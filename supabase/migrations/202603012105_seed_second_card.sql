-- Seed: Second Card "C'eri quasi!"
INSERT INTO public.collectible_cards (title, description, rarity, category, image_url)
VALUES (
    'C''eri quasi!', 
    'A un passo dal trono. Perdere la lega per un solo punto è un''impresa da veri duri.', 
    'RARE', 
    'ACHIEVEMENT',
    'https://i.ibb.co/vzG7ZzG/rettangolo-placeholder.png' -- Placeholder
) ON CONFLICT DO NOTHING;
