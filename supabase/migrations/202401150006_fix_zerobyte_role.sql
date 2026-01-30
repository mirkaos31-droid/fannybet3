-- Force update for the specific user 'ZeroByte' to be ADMIN
UPDATE public.profiles
SET role = 'ADMIN'
WHERE username = 'ZeroByte';

-- Also ensure the email based check works case-insensitively for future
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role TEXT := 'USER';
BEGIN
  -- Check if the email matches the admin email (case insensitive)
  IF LOWER(new.email) = 'mirkaos31@gmail.com' THEN
    assigned_role := 'ADMIN';
  END IF;

  INSERT INTO public.profiles (id, username, role, tokens)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'username',
    assigned_role,
    100
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
