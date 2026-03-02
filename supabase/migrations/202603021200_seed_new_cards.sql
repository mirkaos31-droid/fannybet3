-- Seed: All 5 Collectible Cards
-- Ensuring consistent titles and metadata

-- 1. Il Maestro del 5-5-5 (Legendary)
INSERT INTO public.collectible_cards (title, description, rarity, category, image_url)
VALUES (
    'Il Maestro del 5-5-5', 
    'Dedicata a chi ha saputo distinguersi per la sua strategia... alternativa. Ultimo posto sudato!', 
    'LEGENDARY', 
    'ACHIEVEMENT',
    'https://rzyscsvzentuplsgoipv.supabase.co/storage/v1/object/public/cards/Ultimo.png'
) ON CONFLICT (title) DO UPDATE SET image_url = EXCLUDED.image_url;

-- 2. C'eri quasi! (Rare)
INSERT INTO public.collectible_cards (title, description, rarity, category, image_url)
VALUES (
    'C''eri quasi!', 
    'A un passo dal trono. Perdere la lega per un solo punto è un''impresa da veri duri.', 
    'RARE', 
    'ACHIEVEMENT',
    'https://rzyscsvzentuplsgoipv.supabase.co/storage/v1/object/public/cards/Rettangolo.png'
) ON CONFLICT (title) DO UPDATE SET image_url = EXCLUDED.image_url;

-- 3. Horto muso (Rare)
INSERT INTO public.collectible_cards (title, description, rarity, category, image_url)
VALUES (
    'Horto muso', 
    'Vincere di misura è un''arte. Primo posto conquistato per un solo punto di distacco!', 
    'RARE', 
    'ACHIEVEMENT',
    'https://rzyscsvzentuplsgoipv.supabase.co/storage/v1/object/public/cards/Corto muso.png'
) ON CONFLICT (title) DO UPDATE SET image_url = EXCLUDED.image_url;

-- 4. Hat-trick (Common)
INSERT INTO public.collectible_cards (title, description, rarity, category, image_url)
VALUES (
    'Hat-trick', 
    'Cecchino infallibile. Tre risultati indovinati consecutivamente in una singola giornata!', 
    'COMMON', 
    'ACHIEVEMENT',
    'https://rzyscsvzentuplsgoipv.supabase.co/storage/v1/object/public/cards/Hat-trick.png'
) ON CONFLICT (title) DO UPDATE SET image_url = EXCLUDED.image_url;

-- 5. Ultimo Posto (Common - and extra/fallback)
INSERT INTO public.collectible_cards (title, description, rarity, category, image_url)
VALUES (
    'Ultimo Posto', 
    'La gloria è effimera, ma il fondo della classifica è eterno.', 
    'COMMON', 
    'ACHIEVEMENT',
    'https://rzyscsvzentuplsgoipv.supabase.co/storage/v1/object/public/cards/Ultimo.png'
) ON CONFLICT (title) DO UPDATE SET image_url = EXCLUDED.image_url;
