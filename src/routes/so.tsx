import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Cloud, Globe, History, LogIn, LogOut, Sparkles, Upload, X } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { checkStoryConsistency } from "@/lib/ai/consistency.functions";
import type { ConsistencyResult } from "@/lib/ai/consistency.server";
import { BOOK_RESPONSIVE_CSS } from "@/lib/book-responsive";
import { AUTOSAVE_INTERVAL_MS, BOOK_LOCAL_KEY, createCloudSaver } from "@/lib/autosave";
import { bookFrameHead, chooseStartingCopy } from "@/lib/book-frame";
import { caseBoxesHead } from "@/lib/case-boxes";
import {
  formatTime,
  latestPublicData,
  publishVersion,
  versionData,
  type VersionInfo,
} from "@/lib/public-versions";
import { HistoryPanel } from "@/components/book/HistoryPanel";
import { PublishDialog } from "@/components/book/PublishDialog";
import { btn, closeBtn, panelCls, useEscape } from "@/components/book/ui";

export const Route = createFileRoute("/so")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sổ cốt truyện – Phủ Hách & Đại Hòa" },
      {
        name: "description",
        content:
          "Sổ cốt truyện Phủ Hách & Đại Hòa: bản công khai ai cũng đọc được, bản riêng cho từng tài khoản, lịch sử đăng tải và kiểm tra mâu thuẫn bằng AI.",
      },
      { property: "og:title", content: "Sổ cốt truyện – Phủ Hách & Đại Hòa" },
      {
        property: "og:description",
        content: "Đọc bản công khai, sửa bản riêng theo tài khoản và đăng tải đồng bộ có lịch sử.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SoPage,
});

// The original HTML already talks to a `claude.use("db")` storage API; we provide it backed by Lovable Cloud.

// Private copy: one row per account in story_docs. All cloud writes share one ordered queue.
function makePrivateBridge(userId: string) {
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
        const { data, error } = await supabase
          .from("story_docs")
          .select("data")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          saver.markSynced(JSON.stringify(data.data));
          loaded = true;
          return { exists: true, data: () => data.data };
        }
        // First visit: duplicate the public book; autosave then stores it as this account's copy.
        const start = chooseStartingCopy(
          await latestPublicData(),
          localStorage.getItem(BOOK_LOCAL_KEY),
        );
        loaded = true;
        return { exists: !!start, data: () => start };
      },
      async set(v: unknown) {
        if (!(await saver.save(JSON.stringify(v)))) throw new Error("save failed");
      },
    }),
  };
  return {
    use: async (name: string) => (name === "db" ? db : null),
    saver,
    isLoaded: () => loaded,
  };
}
type PrivateBridge = ReturnType<typeof makePrivateBridge>;

// Read-only views (public book, or one history version): loads data, never writes.
function makeViewBridge(load: () => Promise<unknown | null>) {
  const db = {
    doc: () => ({
      async get() {
        const v = await load();
        return { exists: !!v, data: () => v };
      },
      async set() {},
    }),
  };
  return { use: async (name: string) => (name === "db" ? db : null) };
}

type BookWindow = { eval: (s: string) => string };

function SoPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [html, setHtml] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [panel, setPanel] = useState<"ai" | "history" | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [viewing, setViewing] = useState<VersionInfo | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [swapping, setSwapping] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);
  const [notice, setNotice] = useState("");
  const frame = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "INITIAL_SESSION")
        setSession(s);
    });
    fetch("/so-cot-truyen.html")
      .then((r) => r.text())
      .then(setHtml);
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) setAuthOpen(false);
  }, [session]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(t);
  }, [notice]);

  const uid = session?.user.id;
  const ready = session !== undefined && !!html;
  // New bridge per account / restore, so the iframe always gets a fresh one.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- epoch forces a fresh bridge after a restore
  const privateBridge = useMemo<PrivateBridge | undefined>(
    () => (uid ? makePrivateBridge(uid) : undefined),
    [uid, epoch],
  );
  const editing = !!privateBridge && !viewing;
  const viewId = viewing?.id;
  const bridge = useMemo(() => {
    if (viewId) return makeViewBridge(() => versionData(viewId));
    if (privateBridge) return privateBridge;
    return makeViewBridge(latestPublicData);
  }, [viewId, privateBridge]);

  const bookWin = () => frame.current?.contentWindow as unknown as BookWindow | null;
  const readBook = (): string | null => {
    try {
      return bookWin()?.eval("JSON.stringify(S)") ?? null;
    } catch {
      return null;
    }
  };
  // Runs the file's own save(): writes the on-device copy now and the account copy shortly after.
  const runFileSave = () => {
    try {
      bookWin()?.eval("save()");
    } catch {
      /* book not loaded yet */
    }
  };
  // Push any unsaved change of the private copy right away.
  const flush = async () => {
    if (!editing || !privateBridge) return;
    const snap = readBook();
    if (!snap) return;
    runFileSave();
    if (privateBridge.isLoaded() && privateBridge.saver.isDirty(snap))
      await privateBridge.saver.save(snap);
    else await privateBridge.saver.idle();
  };

  // Autosave safety net on top of the file's per-edit save: catches changes the
  // file did not save, retries failed saves, and flushes when the page is left.
  useEffect(() => {
    if (!ready || !editing || !privateBridge) return;
    const tick = () => {
      const snap = readBook();
      if (snap && privateBridge.isLoaded() && privateBridge.saver.isDirty(snap)) runFileSave();
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    const onPageHide = () => void flush();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const snap = readBook();
      if (
        snap &&
        (privateBridge.saver.busy() ||
          (privateBridge.isLoaded() && privateBridge.saver.isDirty(snap)))
      ) {
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
  }, [ready, editing, privateBridge]);

  if (!ready || !html) return <div className="p-6 text-muted-foreground">Đang tải…</div>;

  async function view(v: VersionInfo) {
    await flush();
    setViewing(v);
  }

  async function restore(v: VersionInfo) {
    if (!uid || !privateBridge) return;
    await flush();
    setSwapping(true); // unmount the book so its pending saves can't overwrite the restored copy
    try {
      await privateBridge.saver.idle();
      const data = await versionData(v.id);
      const { error } = await supabase
        .from("story_docs")
        .upsert({ user_id: uid, data: data as never, updated_at: new Date().toISOString() });
      if (error) throw error;
      setViewing(null);
      setNotice(`Đã khôi phục bản ${formatTime(v.created_at)} vào bản riêng của bạn.`);
    } catch {
      setNotice("Chưa khôi phục được. Thử lại sau.");
    }
    setEpoch((e) => e + 1);
    setSwapping(false);
  }

  async function publish(note: string) {
    await flush();
    const snap = readBook();
    if (!snap) throw new Error("no book");
    await publishVersion(snap, note);
    setPublishOpen(false);
    setHistoryKey((k) => k + 1);
    setNotice("Đã đăng tải. Bản công khai trên web giờ là bản của bạn.");
  }

  (window as unknown as { __claude: unknown }).__claude = bridge;
  const doc = html
    .replace(
      "<head>",
      `<head>${bookFrameHead({ ns: editing ? `:u:${uid}` : null, readonly: !editing })}`,
    )
    .replace(
      "</head>",
      `<style>${BOOK_RESPONSIVE_CSS}</style>${caseBoxesHead(!editing)}</head>`,
    );
  const frameKey = `${viewId ?? (uid ? `u:${uid}` : "public")}:${epoch}`;
  const togglePanel = (p: "ai" | "history") => setPanel((cur) => (cur === p ? null : p));

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <div className="flex items-center gap-1.5 border-b border-border bg-card px-2 py-1.5 sm:gap-2 sm:px-3">
        <span className="mr-auto flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
          {editing ? (
            <Cloud className="h-4 w-4 shrink-0" aria-hidden />
          ) : viewing ? (
            <History className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <Globe className="h-4 w-4 shrink-0" aria-hidden />
          )}
          <span className="truncate">
            {viewing ? (
              <>
                Bản {formatTime(viewing.created_at)}
                <span className="hidden sm:inline"> · chỉ xem</span>
              </>
            ) : editing ? (
              <>
                <span className="sm:hidden">Bản riêng · tự lưu</span>
                <span className="hidden sm:inline">
                  Bản riêng của bạn · tự động lưu, chỉ bạn thấy
                </span>
              </>
            ) : (
              <>
                <span className="sm:hidden">Bản công khai</span>
                <span className="hidden sm:inline">Bản công khai · chỉ xem</span>
              </>
            )}
          </span>
        </span>
        {viewing && (
          <button className={btn} onClick={() => setViewing(null)}>
            <ArrowLeft className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{uid ? "Về bản của tôi" : "Về bản công khai"}</span>
          </button>
        )}
        <button
          className={`${btn} ${panel === "history" ? "bg-muted" : ""}`}
          aria-pressed={panel === "history"}
          aria-label="Lịch sử"
          onClick={() => togglePanel("history")}
        >
          <History className="h-4 w-4" aria-hidden />
          <span className="hidden md:inline">Lịch sử</span>
        </button>
        {editing && (
          <button
            className={btn}
            onClick={() => setPublishOpen(true)}
            aria-label="Đăng tải đồng bộ"
          >
            <Upload className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Đăng tải</span>
          </button>
        )}
        <button
          className={`${btn} ${panel === "ai" ? "bg-muted" : ""}`}
          aria-pressed={panel === "ai"}
          onClick={() => togglePanel("ai")}
        >
          <Sparkles className="h-4 w-4" aria-hidden />
          <span className="lg:hidden">AI</span>
          <span className="hidden lg:inline">Kiểm tra mâu thuẫn</span>
        </button>
        {uid ? (
          <>
            <span className="hidden max-w-[14rem] truncate text-sm text-muted-foreground xl:inline">
              {session?.user.email}
            </span>
            <button
              className={btn}
              onClick={async () => {
                await flush();
                await supabase.auth.signOut();
              }}
              aria-label="Đăng xuất"
              title={session?.user.email ?? undefined}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden lg:inline">Đăng xuất</span>
            </button>
          </>
        ) : (
          <button className={btn} onClick={() => setAuthOpen(true)}>
            <LogIn className="h-4 w-4" aria-hidden />
            <span className="sm:hidden">Đăng nhập</span>
            <span className="hidden sm:inline">Đăng nhập để sửa</span>
          </button>
        )}
      </div>
      {notice && (
        <div role="status" className="border-b border-border bg-muted px-3 py-1.5 text-sm">
          {notice}
        </div>
      )}
      <div className="relative flex min-h-0 flex-1">
        {swapping ? (
          <div className="flex-1 p-6 text-muted-foreground">Đang khôi phục…</div>
        ) : (
          <iframe
            ref={frame}
            key={frameKey}
            title="Sổ cốt truyện"
            srcDoc={doc}
            className="h-full min-w-0 flex-1 border-0"
          />
        )}
        {panel && (
          <>
            {/* Tablet: panel floats over the book; tap outside to close. Desktop: it sits beside the book. */}
            <div
              className="absolute inset-0 z-10 hidden bg-foreground/30 sm:block lg:hidden"
              onClick={() => setPanel(null)}
            />
            {panel === "ai" ? (
              <AiPanel
                signedIn={!!uid}
                readBook={readBook}
                onClose={() => setPanel(null)}
                onLogin={() => setAuthOpen(true)}
              />
            ) : (
              <HistoryPanel
                signedIn={!!uid}
                viewingId={viewId ?? null}
                refreshKey={historyKey}
                onView={view}
                onRestore={restore}
                onClose={() => setPanel(null)}
                onLogin={() => setAuthOpen(true)}
              />
            )}
          </>
        )}
      </div>
      {authOpen && !uid && <AuthDialog onClose={() => setAuthOpen(false)} />}
      {publishOpen && editing && (
        <PublishDialog onPublish={publish} onClose={() => setPublishOpen(false)} />
      )}
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
      else if (!data.session)
        setMsg("Đã gửi thư xác nhận. Mở email và bấm vào liên kết, rồi quay lại đăng nhập.");
    }
    setBusy(false);
  }

  const tab = (m: "in" | "up", label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={mode === m}
      onClick={() => {
        setMode(m);
        setMsg("");
      }}
      className={`flex-1 rounded px-3 py-2 text-sm ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
    >
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/40 p-3 sm:p-4"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-3 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Tài khoản</h2>
          <button type="button" aria-label="Đóng" className={closeBtn} onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div role="tablist" className="flex gap-1 rounded-md border border-border p-1">
          {tab("in", "Đăng nhập")}
          {tab("up", "Đăng ký")}
        </div>
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded border border-input bg-background px-3 py-2"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Mật khẩu (ít nhất 6 ký tự)"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="w-full rounded border border-input bg-background px-3 py-2"
        />
        <button
          disabled={busy}
          className="w-full rounded bg-primary px-3 py-2 text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Đang xử lý…" : mode === "in" ? "Đăng nhập" : "Tạo tài khoản"}
        </button>
        {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      </form>
    </div>
  );
}

function AiPanel(props: {
  signedIn: boolean;
  readBook: () => string | null;
  onClose: () => void;
  onLogin: () => void;
}) {
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
    <aside className={panelCls}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Kiểm tra mâu thuẫn</h2>
        <button aria-label="Đóng" className={closeBtn} onClick={props.onClose}>
          <X className="h-4 w-4" />
        </button>
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
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={withBook}
          onChange={(e) => setWithBook(e.target.checked)}
        />
        So với toàn bộ nội dung sổ hiện tại
      </label>
      {props.signedIn ? (
        <button
          disabled={busy}
          onClick={run}
          className="min-h-10 rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-60"
        >
          {busy ? "AI đang đọc… (có thể mất tới 1 phút)" : "Kiểm tra"}
        </button>
      ) : (
        <button
          onClick={props.onLogin}
          className="min-h-10 rounded bg-primary px-3 py-2 text-sm text-primary-foreground"
        >
          Đăng nhập để dùng kiểm tra AI
        </button>
      )}
      {err && <p className="text-sm text-destructive">{err}</p>}
      {res && (
        <div className="space-y-3">
          <p className="text-sm">{res.tomTat}</p>
          {res.mauThuan.length === 0 && (
            <p className="text-sm text-muted-foreground">Không thấy mâu thuẫn.</p>
          )}
          {res.mauThuan.map((m, i) => (
            <div key={i} className="space-y-1.5 rounded-md border border-border p-3 text-sm">
              <div className="flex flex-wrap gap-1.5 text-xs">
                <span className="rounded-full border border-border px-2">{m.loai}</span>
                <span
                  className={`rounded-full border px-2 ${m.mucDo === "Cao" ? "border-destructive text-destructive" : "border-border text-muted-foreground"}`}
                >
                  Mức độ: {m.mucDo}
                </span>
              </div>
              <p className="font-medium">{m.tieuDe}</p>
              <p>{m.chiTiet}</p>
              {m.dauVet.length > 0 && (
                <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {m.dauVet.map((d, j) => (
                    <li key={j}>“{d}”</li>
                  ))}
                </ul>
              )}
              <p>
                <span className="text-muted-foreground">Gợi ý: </span>
                {m.goiY}
              </p>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
