import { useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { closeBtn, primaryBtn, useEscape } from "./ui";

export function PublishDialog(props: {
  onPublish: (note: string) => Promise<void>;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEscape(props.onClose);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await props.onPublish(note.trim());
    } catch {
      setErr("Chưa đăng tải được. Kiểm tra mạng rồi thử lại.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/40 p-3 sm:p-4"
      onClick={props.onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md space-y-3 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Đăng tải đồng bộ</h2>
          <button type="button" aria-label="Đóng" className={closeBtn} onClick={props.onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Bản riêng của bạn sẽ thành bản công khai trên web, ai cũng đọc được. Bản công khai cũ vẫn
          được giữ trong Lịch sử để khôi phục khi cần.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          placeholder="Ghi chú cho lần đăng tải này (không bắt buộc), ví dụ: thêm án hậu cung"
          className="min-h-24 w-full rounded border border-input bg-background p-2 text-base sm:text-sm"
        />
        <button disabled={busy} className={primaryBtn + " w-full"}>
          {busy ? "Đang đăng tải…" : "Đăng tải lên web"}
        </button>
        {err && <p className="text-sm text-destructive">{err}</p>}
      </form>
    </div>
  );
}
