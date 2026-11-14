CREATE TABLE public.story_docs (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.story_docs TO authenticated;
GRANT ALL ON public.story_docs TO service_role;
ALTER TABLE public.story_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own select" ON public.story_docs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own insert" ON public.story_docs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own update" ON public.story_docs FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);