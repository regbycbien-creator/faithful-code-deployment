import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Cloud, HardDrive, LogIn, LogOut, Sparkles, X } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { checkStoryConsistency } from "@/lib/ai/consistency.functions";
import type { ConsistencyResult } from "@/lib/ai/consistency.server";
import { BOOK_RESPONSIVE_CSS } from "@/lib/book-responsive";
import { AUTOSAVE_INTERVAL_MS, BOOK_LOCAL_KEY, createCloudSaver } from "@/lib/autosave";

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
// All cloud writes (the file's own and the page's autosave) share one ordered queue.
function makeBridge(userId: string) {
  const saver = createCloudSaver(async (json) => {
    const { error } = await supabase
      .from("story_docs")
      .upsert({ user_id: userId, data: JSON.parse(json), updated_at: new Date().toISOString() });
    if (error) throw error;
  });
  let loaded = false;
  const db = {
    doc: () => ({
      async get() {
        const { data, error } = await supabase.from("story_docs").select("data").eq("user_id", userId).maybeSingle();
        if (error) throw error;
        if (data) saver.markSynced(JSON.stringify(data.data));
        loaded = true;
        return { exists: !!data, data: () => data?.data };
      },
      async set(v: unknown) {
        if (!(await saver.save(JSON.stringify(v)))) throw new Error("save failed");
      },
    }),
  };
  return { use: async (name: string) => (name === "db" ? db : null), saver, isLoaded: () => loaded };
}
type Bridge = ReturnType<typeof makeBridge>;

type BookWindow = { eval: (s: string) => string };

const btn =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-sm text-foreground hover:bg-muted sm:h-8";
const closeBtn = "grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted";

// Esc closes dialogs/panels on keyboards.
function useEscape(onEsc: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onEsc();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onEsc]);
}

function SoPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [html, setHtml] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const uid = session?.user.id;
  // One bridge per account: the iframe keeps the one it saw at load.
  const bridge = useMemo<Bridge | undefined>(() => (uid ? makeBridge(uid) : undefined), [uid]);
  const ready = session !== undefined && !!html;

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

  const bookWin = () => frame.current?.contentWindow as unknown as BookWindow | null;
  const readBook = (): string | null => {
    try {
      return bookWin()?.eval("JSON.stringify(S)") ?? null;
    } catch {
      return null;
    }
  };
  // Runs the file's own save(): writes this device's copy now and the account copy shortly after.
  const runFileSave = () => {
    try {
      bookWin()?.eval("save()");
    } catch {
      /* book not loaded yet */
    }
  };
  // Push any unsaved change right away (leaving the page, switching apps, signing out).
  const flush = async () => {
    const snap = readBook();
    if (!snap) return;
    if (snap !== localStorage.getItem(BOOK_LOCAL_KEY)) runFileSave();
    if (bridge?.isLoaded() && bridge.saver.isDirty(snap)) await bridge.saver.save(snap);
    else if (bridge) await bridge.saver.idle();
  };

  // Autosave safety net on top of the file's per-edit save: catches changes the
  // file did not save, retries failed account saves, and flushes when the page is left.
  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      const snap = readBook();
      if (!snap) return;
      const unsaved = bridge
        ? bridge.isLoaded() && bridge.saver.isDirty(snap)
        : snap !== localStorage.getItem(BOOK_LOCAL_KEY);
      if (unsaved) runFileSave();
    };
    const onHide = () => { if (document.visibilityState === "hidden") void flush(); };
    const onPageHide = () => void flush();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const snap = readBook();
      if (bridge && snap && (bridge.saver.busy() || (bridge.isLoaded() && bridge.saver.isDirty(snap)))) {
        void flush();
        e.preventDefault();
        e.returnValue = "";
      }
    };
    const t = setInterval(tick, AUTOSAVE_INTERVAL_MS);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, bridge]);

  if (!ready || !html) return <div className="p-6 text-muted-foreground">Đang tải…</div>;

  // Signed out: no bridge, so the book saves on this device as in the original file.
  (window as unknown as { __claude: unknown }).__claude = bridge;
  const doc = html
    .replace("<head>", "<head><script>window.claude=parent.__claude</script>")
    .replace("</head>", `<style>${BOOK_RESPONSIVE_CSS}</style></head>`);

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <div className="flex items-center gap-1.5 border-b border-border bg-card px-2 py-1.5 sm:gap-2 sm:px-3">
        <span className="mr-auto flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
          {uid ? <Cloud className="h-4 w-4 shrink-0" aria-hidden /> : <HardDrive className="h-4 w-4 shrink-0" aria-hidden />}
          <span className="truncate">
            <span className="sm:hidden">{uid ? "Tự lưu vào tài khoản" : "Tự lưu trên máy này"}</span>
            <span className="hidden sm:inline">{uid ? "Tự động lưu vào tài khoản" : "Chưa đăng nhập – tự động lưu trên máy này"}</span>
          </span>
        </span>
        <button className={`${btn} ${aiOpen ? "bg-muted" : ""}`} aria-pressed={aiOpen} onClick={() => setAiOpen((v) => !v)}>
          <Sparkles className="h-4 w-4" aria-hidden />
          <span className="sm:hidden">AI</span>
          <span className="hidden sm:inline">Kiểm tra mâu thuẫn</span>
        </button>
        {uid ? (
          <>
            <span className="hidden max-w-[14rem] truncate text-sm text-muted-foreground lg:inline">{session?.user.email}</span>
            <button className={btn} onClick={async () => { await flush(); await supabase.auth.signOut(); }} aria-label="Đăng xuất" title={session?.user.email ?? undefined}>
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </>
        ) : (
          <button className={btn} onClick={() => setAuthOpen(true)}>
            <LogIn className="h-4 w-4" aria-hidden />
            <span className="sm:hidden">Đăng nhập</span>
            <span className="hidden sm:inline">Đăng nhập / Đăng ký</span>
          </button>
        )}
      </div>
      <div className="relative flex min-h-0 flex-1">
        <iframe ref={frame} key={uid ?? "guest"} title="Sổ cốt truyện" srcDoc={doc} className="h-full min-w-0 flex-1 border-0" />
        {aiOpen && (
          <>
            {/* Tablet: panel floats over the book; tap outside to close. Desktop: it sits beside the book. */}
            <div className="absolute inset-0 z-10 hidden bg-foreground/30 sm:block lg:hidden" onClick={() => setAiOpen(false)} />
            <AiPanel signedIn={!!uid} readBook={readBook} onClose={() => setAiOpen(false)} onLogin={() => setAuthOpen(true)} />
          </>
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
  useEscape(onClose);

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
      className={`flex-1 rounded px-3 py-2 text-sm ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/40 p-3 sm:p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tài khoản</h2>
          <button type="button" aria-label="Đóng" className={closeBtn} onClick={onClose}><X className="h-4 w-4" /></button>
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
  useEscape(props.onClose);

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
    <aside className="absolute inset-y-0 right-0 z-20 flex w-full flex-col gap-3 overflow-y-auto border-l border-border bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-card-foreground sm:w-[420px] sm:shadow-xl lg:static lg:z-auto lg:w-[380px] lg:shrink-0 lg:shadow-none xl:w-[440px]">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Kiểm tra mâu thuẫn</h2>
        <button aria-label="Đóng" className={closeBtn} onClick={props.onClose}><X className="h-4 w-4" /></button>
      </div>
      <p className="text-sm text-muted-foreground">
        Nhập ghi chú cốt truyện. AI sẽ tìm chỗ mâu thuẫn về nhân vật, địa điểm và sự kiện.
      </p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Ví dụ: Lâm Thu sinh năm 870, gặp Mạnh Lịch ở Bách Hải năm 860…"
        className="min-h-40 w-full rounded border border-input bg-background p-2 text-base sm:text-sm"
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="h-4 w-4" checked={withBook} onChange={(e) => setWithBook(e.target.checked)} />
        So với toàn bộ nội dung sổ hiện tại
      </label>
      {props.signedIn ? (
        <button disabled={busy} onClick={run} className="min-h-10 rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60">
          {busy ? "AI đang đọc… (có thể mất tới 1 phút)" : "Kiểm tra"}
        </button>
      ) : (
        <button onClick={props.onLogin} className="min-h-10 rounded bg-primary px-3 py-2 text-sm text-primary-foreground">
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
