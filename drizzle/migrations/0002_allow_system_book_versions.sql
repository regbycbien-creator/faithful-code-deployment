-- Signed-in publishers are always stamped with their own id/name; only backend-made
-- versions (no signed-in user, RLS bypassed) keep the author fields they provide.
CREATE OR REPLACE FUNCTION public.set_public_version_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.author_id := auth.uid();
    NEW.author_label := coalesce((SELECT split_part(u.email, '@', 1) FROM auth.users u WHERE u.id = auth.uid()), '');
    NEW.created_at := now();
  END IF;
  NEW.note := left(coalesce(NEW.note, ''), 500);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_public_version_author() FROM PUBLIC, anon, authenticated;