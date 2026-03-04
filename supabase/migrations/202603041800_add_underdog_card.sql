-- Migration: Add Underdog Card
-- Description: Inserts the Underdog card into the registry.

INSERT INTO public.cards_registry (title, rarity, description, image_url, goal_type, goal_value)
VALUES (
    'UNDERDOG',
    'rara',
    'Sbloccata indovinando il risultato meno pronosticato in FB Lega (Bonus Underdog).',
    'Underdog.png',
    'fblega_underdog',
    1
) ON CONFLICT (title) DO UPDATE SET
    rarity = EXCLUDED.rarity,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url;
