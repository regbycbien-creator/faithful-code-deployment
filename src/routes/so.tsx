import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/so")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sổ cốt truyện – Phủ Hách & Đại Hòa" },
      { name: "description", content: "Đăng nhập để lưu sổ cốt truyện Phủ Hách & Đại Hòa." },
      { property: "og:title", content: "Sổ cốt truyện – Phủ Hách & Đại Hòa" },
      { property: "og:description", content: "Đăng nhập để lưu sổ cốt truyện Phủ Hách & Đại Hòa." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SoPage,
});

// The original HTML already talks to a `claude.use("db")` storage API; we provide it backed by Lovable Cloud.
function makeBridge(userId: string) {
  const db = {
    doc: () => ({
      async get() {
        const { data, error } = await supabase.from("story_docs").select("data").eq("user_id", userId).maybeSingle();
        if (error) throw error;
        return { exists: !!data, data: () => data?.data };
      },
      async set(v: unknown) {
        const { error } = await supabase
          .from("story_docs")
          .upsert({ user_id: userId, data: v as never, updated_at: new Date().toISOString() });
        if (error) throw error;
      },
    }),
  };
  return { use: async (name: string) => (name === "db" ? db : null) };
}

function SoPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    fetch("/so-cot-truyen.html").then((r) => r.text()).then(setHtml);
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  if (session === undefined || !html) return <div className="p-6 text-muted-foreground">Đang tải…</div>;
  if (!session || !uid) return <AuthForm />;

  (window as unknown as { __claude: unknown }).__claude = makeBridge(uid);
  const doc = html.replace("<head>", "<head><script>window.claude=parent.__claude</script>");

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex items-center justify-end gap-3 border-b border-border px-3 py-1 text-sm text-muted-foreground">
        <span>{session.user.email}</span>
        <button className="rounded border border-border px-2 py-0.5 text-foreground" onClick={() => supabase.auth.signOut()}>
          Đăng xuất
        </button>
      </div>
      <iframe key={uid} title="Sổ cốt truyện" srcDoc={doc} className="w-full flex-1 border-0" />
    </div>
  );
}

function AuthForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
      if (error) setMsg("Sai email hoặc mật khẩu, hoặc email chưa được xác nhận.");
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: pw,
        options: { emailRedirectTo: `${window.location.origin}/so` },
      });
      if (error) setMsg(error.message);
      else if (!data.session) setMsg("Đã gửi thư xác nhận. Mở email và bấm vào liên kết, rồi quay lại đăng nhập.");
    }
    setBusy(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-card p-6">
        <h1 className="text-xl font-semibold">Sổ cốt truyện</h1>
        <p className="text-sm text-muted-foreground">{mode === "in" ? "Đăng nhập để lưu nội dung." : "Tạo tài khoản mới."}</p>
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-input bg-background px-3 py-2" />
        <input type="password" required minLength={6} placeholder="Mật khẩu (ít nhất 6 ký tự)" value={pw}
          onChange={(e) => setPw(e.target.value)} className="w-full rounded border border-input bg-background px-3 py-2" />
        <button disabled={busy} className="w-full rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-60">
          {mode === "in" ? "Đăng nhập" : "Đăng ký"}
        </button>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
        <button type="button" className="w-full text-sm underline" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(""); }}>
          {mode === "in" ? "Chưa có tài khoản? Đăng ký" : "Đã có tài khoản? Đăng nhập"}
        </button>
      </form>
    </div>
  );
}
