import { useEffect, useState } from "react";
import { Eye, RotateCcw, X } from "lucide-react";
import { formatTime, listVersions, type VersionInfo } from "@/lib/public-versions";
import { btn, closeBtn, panelCls, useEscape } from "./ui";

export function HistoryPanel(props: {
  signedIn: boolean;
  viewingId: string | null;
  refreshKey: number;
  onView: (v: VersionInfo) => void;
  onRestore: (v: VersionInfo) => Promise<void>;
  onClose: () => void;
  onLogin: () => void;
}) {
  const [items, setItems] = useState<VersionInfo[] | null>(null);
  const [err, setErr] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  useEscape(props.onClose);

  useEffect(() => {
    setItems(null);
    listVersions().then(setItems, () => setErr("Không tải được lịch sử lúc này."));
  }, [props.refreshKey]);

  async function restore(v: VersionInfo) {
    setBusyId(v.id);
    await props.onRestore(v);
    setBusyId(null);
    setConfirmId(null);
  }

  return (
    <aside className={panelCls} aria-label="Lịch sử đăng tải">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Lịch sử bản công khai</h2>
        <button aria-label="Đóng" className={closeBtn} onClick={props.onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <p className="text-sm text-muted-foreground">
        Mỗi lần đăng tải được giữ lại thành một bản. Khôi phục sẽ thay bản riêng của bạn; muốn bản
        công khai đổi theo thì bấm “Đăng tải” sau đó.
      </p>
      {!props.signedIn && (
        <button className={btn + " self-start"} onClick={props.onLogin}>
          Đăng nhập để khôi phục về bản riêng
        </button>
      )}
      {err && <p className="text-sm text-destructive">{err}</p>}
      {!items && !err && <p className="text-sm text-muted-foreground">Đang tải…</p>}
      {items?.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Chưa có lần đăng tải nào. Web đang hiện sổ mẫu ban đầu.
        </p>
      )}
      <ol className="space-y-2">
        {items?.map((v, i) => (
          <li
            key={v.id}
            className={`space-y-2 rounded-md border p-3 text-sm ${props.viewingId === v.id ? "border-primary" : "border-border"}`}
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium">{formatTime(v.created_at)}</span>
              {i === 0 && (
                <span className="rounded-full border border-primary px-2 text-xs text-primary">
                  Đang công khai
                </span>
              )}
            </div>
            <p className="text-muted-foreground">bởi {v.author_label || "một tài khoản"}</p>
            {v.note && <p className="whitespace-pre-wrap">{v.note}</p>}
            {confirmId === v.id ? (
              <div className="space-y-2 rounded bg-muted p-2">
                <p>Bản riêng hiện tại của bạn sẽ bị thay bằng bản này. Tiếp tục?</p>
                <div className="flex gap-2">
                  <button className={btn} disabled={busyId === v.id} onClick={() => restore(v)}>
                    {busyId === v.id ? "Đang khôi phục…" : "Khôi phục"}
                  </button>
                  <button className={btn} onClick={() => setConfirmId(null)}>
                    Thôi
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button className={btn} onClick={() => props.onView(v)}>
                  <Eye className="h-4 w-4" aria-hidden />
                  Xem
                </button>
                {props.signedIn && (
                  <button className={btn} onClick={() => setConfirmId(v.id)}>
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    {i === 0 ? "Lấy về bản của tôi" : "Khôi phục về bản của tôi"}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </aside>
  );
}
