-- 1. Enable Admins to UPDATE other profiles (for Tokens/Role)
CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (
  auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'ADMIN')
);

-- 2. Secure Function to Delete Users (Requires Admin privileges)
CREATE OR REPLACE FUNCTION delete_user_by_admin(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Check if executing user is ADMIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN') THEN
    RAISE EXCEPTION 'Access Denied: Only Admins can delete users';
  END IF;

  -- Delete from auth.users (cascades to profiles usually, if configured, typically profiles FK is ON DELETE CASCADE?)
  -- Referencing 202401150003: id UUID REFERENCES auth.users(id) PRIMARY KEY
  -- We usually cannot DELETE FROM auth.users directly as a normal user, but SECURITY DEFINER allows it if creator is superuser.
  -- Supabase SQL Editor runs as postgres (superuser).
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Secure Function to Update User Role
CREATE OR REPLACE FUNCTION update_user_role(target_user_id UUID, new_role TEXT)
RETURNS VOID AS $$
BEGIN
  -- Check if executing user is ADMIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN') THEN
    RAISE EXCEPTION 'Access Denied: Only Admins can change roles';
  END IF;

  UPDATE public.profiles
  SET role = new_role
  WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to Force Sync Emails (if they are missing)
CREATE OR REPLACE FUNCTION sync_user_emails()
RETURNS VOID AS $$
BEGIN
  -- Check if executing user is ADMIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ADMIN') THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  UPDATE public.profiles
  SET email = auth.users.email
  FROM auth.users
  WHERE public.profiles.id = auth.users.id
  AND (public.profiles.email IS NULL OR public.profiles.email != auth.users.email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
