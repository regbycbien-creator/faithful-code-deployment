CREATE TABLE public.public_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data jsonb NOT NULL,
  note text NOT NULL DEFAULT '',
  author_id uuid NOT NULL DEFAULT auth.uid(),
  author_label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX public_versions_created_at_idx ON public.public_versions (created_at DESC);

GRANT SELECT ON public.public_versions TO anon, authenticated;
GRANT INSERT ON public.public_versions TO authenticated;
GRANT ALL ON public.public_versions TO service_role;

ALTER TABLE public.public_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads public versions" ON public.public_versions
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "accounts publish as themselves" ON public.public_versions
  FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

-- Author and time are set by the server so nobody can publish under another name or date.
CREATE OR REPLACE FUNCTION public.set_public_version_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.author_id := auth.uid();
  NEW.author_label := coalesce((SELECT split_part(u.email, '@', 1) FROM auth.users u WHERE u.id = auth.uid()), '');
  NEW.note := left(coalesce(NEW.note, ''), 500);
  NEW.created_at := now();
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_public_version_author() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER public_versions_set_author
  BEFORE INSERT ON public.public_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_public_version_author();