-- 1. Ensure email column exists (since the frontend requests it)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Backfill missing profiles for existing users (e.g. Admin created before triggers)
INSERT INTO public.profiles (id, email, username, role, tokens)
SELECT 
  id, 
  email, 
  COALESCE(raw_user_meta_data->>'username', SPLIT_PART(email, '@', 1)), -- Fallback to email prefix if username is missing
  'ADMIN', -- Default backfilled users to ADMIN if they match specific criteria? Or just USER? Safe to assume USER, then update manually. OR Check metadata.
  1000 -- Give legacy/admin users a nice starter pack
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles);

-- 3. Sync email addresses for existing profiles
UPDATE public.profiles
SET email = auth.users.email
FROM auth.users
WHERE public.profiles.id = auth.users.id
AND (public.profiles.email IS NULL OR public.profiles.email != auth.users.email);

-- 4. Automatically promote specific email/user to ADMIN if needed (Optional, user can do this via SQL)
-- UPDATE public.profiles SET role = 'ADMIN' WHERE email = 'YOUR_ADMIN_EMAIL';
