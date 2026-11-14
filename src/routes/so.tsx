import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { checkStoryConsistency } from "@/lib/ai/consistency.functions";
import type { ConsistencyResult } from "@/lib/ai/consistency.server";

export const Route = createFileRoute("/so")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sổ cốt truyện – Phủ Hách & Đại Hòa" },
      { name: "description", content: "Sổ cốt truyện Phủ Hách & Đại Hòa: lưu theo tài khoản và kiểm tra mâu thuẫn bằng AI." },
      { property: "og:title", content: "Sổ cốt truyện – Phủ Hách & Đại Hòa" },
      { property: "og:description", content: "Lưu sổ cốt truyện theo tài khoản và kiểm tra mâu thuẫn bằng AI." },
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

const btn = "rounded border border-border bg-background px-2.5 py-1 text-sm text-foreground hover:bg-muted";

function SoPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [html, setHtml] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION") setSession(s);
    });
    fetch("/so-cot-truyen.html").then((r) => r.text()).then(setHtml);
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) setAuthOpen(false);
  }, [session]);

  if (session === undefined || !html) return <div className="p-6 text-muted-foreground">Đang tải…</div>;

  const uid = session?.user.id;
  // Signed out: no bridge, so the book saves on this device as in the original file.
  (window as unknown as { __claude: unknown }).__claude = uid ? makeBridge(uid) : undefined;
  const doc = html.replace("<head>", "<head><script>window.claude=parent.__claude</script>");

  const readBook = (): string | null => {
    try {
      const w = frame.current?.contentWindow as unknown as { eval: (s: string) => string } | null;
      return w ? w.eval("JSON.stringify(S)") : null;
    } catch {
      return null;
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border px-3 py-1.5 text-sm">
        <span className="mr-auto text-muted-foreground">
          {uid ? "Đang lưu vào tài khoản" : "Chưa đăng nhập – chỉ lưu trên máy này"}
        </span>
        <button className={btn} onClick={() => setAiOpen((v) => !v)}>
          Kiểm tra mâu thuẫn (AI)
        </button>
        {uid ? (
          <>
            <span className="text-muted-foreground">{session?.user.email}</span>
            <button className={btn} onClick={() => supabase.auth.signOut()}>
              Đăng xuất
            </button>
          </>
        ) : (
          <button className={btn} onClick={() => setAuthOpen(true)}>
            Đăng nhập / Đăng ký
          </button>
        )}
      </div>
      <div className="relative flex min-h-0 flex-1">
        <iframe ref={frame} key={uid ?? "guest"} title="Sổ cốt truyện" srcDoc={doc} className="h-full min-w-0 flex-1 border-0" />
        {aiOpen && (
          <AiPanel signedIn={!!uid} readBook={readBook} onClose={() => setAiOpen(false)} onLogin={() => setAuthOpen(true)} />
        )}
      </div>
      {authOpen && !uid && <AuthDialog onClose={() => setAuthOpen(false)} />}
    </div>
  );
}

function AuthDialog({ onClose }: { onClose: () => void }) {
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

  const tab = (m: "in" | "up", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => { setMode(m); setMsg(""); }}
      className={`flex-1 rounded px-3 py-1.5 text-sm ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tài khoản</h2>
          <button type="button" aria-label="Đóng" className="px-2 text-muted-foreground" onClick={onClose}>✕</button>
        </div>
        <div role="tablist" className="flex gap-1 rounded-md border border-border p-1">
          {tab("in", "Đăng nhập")}
          {tab("up", "Đăng ký")}
        </div>
        <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-input bg-background px-3 py-2" />
        <input type="password" required minLength={6} placeholder="Mật khẩu (ít nhất 6 ký tự)" value={pw}
          onChange={(e) => setPw(e.target.value)} className="w-full rounded border border-input bg-background px-3 py-2" />
        <button disabled={busy} className="w-full rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-60">
          {busy ? "Đang xử lý…" : mode === "in" ? "Đăng nhập" : "Tạo tài khoản"}
        </button>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </form>
    </div>
  );
}

function AiPanel(props: { signedIn: boolean; readBook: () => string | null; onClose: () => void; onLogin: () => void }) {
  const check = useServerFn(checkStoryConsistency);
  const [notes, setNotes] = useState("");
  const [withBook, setWithBook] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<ConsistencyResult | null>(null);

  async function run() {
    setBusy(true);
    setErr("");
    setRes(null);
    try {
      const r = await check({ data: { notes, book: withBook ? props.readBook() : null } });
      if (r.ok) setRes(r.result);
      else setErr(r.error);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Không kiểm tra được lúc này.");
    }
    setBusy(false);
  }

  return (
    <aside className="flex w-full max-w-md flex-col gap-3 overflow-y-auto border-l border-border bg-card p-4 text-card-foreground max-sm:absolute max-sm:inset-0 max-sm:max-w-none">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Kiểm tra mâu thuẫn</h2>
        <button aria-label="Đóng" className="px-2 text-muted-foreground" onClick={props.onClose}>✕</button>
      </div>
      <p className="text-sm text-muted-foreground">
        Nhập ghi chú cốt truyện. AI sẽ tìm chỗ mâu thuẫn về nhân vật, địa điểm và sự kiện.
      </p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Ví dụ: Lâm Thu sinh năm 870, gặp Mạnh Lịch ở Bách Hải năm 860…"
        className="min-h-40 w-full rounded border border-input bg-background p-2 text-sm"
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={withBook} onChange={(e) => setWithBook(e.target.checked)} />
        So với toàn bộ nội dung sổ hiện tại
      </label>
      {props.signedIn ? (
        <button disabled={busy} onClick={run} className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60">
          {busy ? "AI đang đọc… (có thể mất tới 1 phút)" : "Kiểm tra"}
        </button>
      ) : (
        <button onClick={props.onLogin} className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground">
          Đăng nhập để dùng kiểm tra AI
        </button>
      )}
      {err && <p className="text-sm text-destructive">{err}</p>}
      {res && (
        <div className="space-y-3">
          <p className="text-sm">{res.tomTat}</p>
          {res.mauThuan.length === 0 && <p className="text-sm text-muted-foreground">Không thấy mâu thuẫn.</p>}
          {res.mauThuan.map((m, i) => (
            <div key={i} className="space-y-1.5 rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full border border-border px-2">{m.loai}</span>
                <span className={`rounded-full border px-2 ${m.mucDo === "Cao" ? "border-destructive text-destructive" : "border-border text-muted-foreground"}`}>
                  Mức độ: {m.mucDo}
                </span>
              </div>
              <p className="font-medium">{m.tieuDe}</p>
              <p>{m.chiTiet}</p>
              {m.dauVet.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {m.dauVet.map((d, j) => <li key={j}>“{d}”</li>)}
                </ul>
              )}
              <p><span className="text-muted-foreground">Gợi ý: </span>{m.goiY}</p>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
