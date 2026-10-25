-- Function to handle new user signup and insert them into public tables
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert into public.users
  INSERT INTO public.users (id, email, role, language)
  VALUES (new.id, new.email, 'siswa', 'id');
  
  -- Insert into public.user_profiles
  INSERT INTO public.user_profiles (user_id, full_name)
  VALUES (new.id, split_part(new.email, '@', 1));
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger that fires when a user is created in Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- For the existing user (your first account), run this to sync manually:
INSERT INTO public.users (id, email, role)
SELECT id, email, 'admin' FROM auth.users ON CONFLICT DO NOTHING;

INSERT INTO public.user_profiles (user_id, full_name)
SELECT id, split_part(email, '@', 1) FROM auth.users ON CONFLICT DO NOTHING;
