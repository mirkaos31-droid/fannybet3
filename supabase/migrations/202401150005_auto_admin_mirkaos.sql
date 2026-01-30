-- Update the trigger function to automatically grant ADMIN role to specific email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role TEXT := 'USER';
BEGIN
  -- Check if the email matches the admin email
  IF new.email = 'mirkaos31@gmail.com' THEN
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

-- Also try to update if the user already exists (just in case)
DO $$
BEGIN
  UPDATE public.profiles
  SET role = 'ADMIN'
  WHERE id IN (SELECT id FROM auth.users WHERE email = 'mirkaos31@gmail.com');
END $$;
