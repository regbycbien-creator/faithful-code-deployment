import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ConsistencyResult } from "./consistency.server";

export type CheckResponse = { ok: true; result: ConsistencyResult } | { ok: false; error: string };

function friendlyError(e: unknown): string {
  const status = (e as { statusCode?: number })?.statusCode;
  if (status === 429) return "AI đang quá tải, vui lòng thử lại sau ít phút.";
  if (status === 402) return "Đã hết hạn mức AI của không gian làm việc. Cần nạp thêm để tiếp tục.";
  if (status === 403) return "Yêu cầu bị từ chối bởi dịch vụ AI.";
  return "Không kiểm tra được lúc này. Vui lòng thử lại.";
}

export const checkStoryConsistency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { notes: string; book: string | null }) => {
    const notes = String(input?.notes ?? "").slice(0, 50_000);
    const book = input?.book ? String(input.book).slice(0, 300_000) : null;
    if (!notes.trim() && !book) throw new Error("Hãy nhập ghi chú hoặc chọn kèm nội dung sổ.");
    return { notes, book };
  })
  .handler(async ({ data }): Promise<CheckResponse> => {
    const { checkConsistency } = await import("./consistency.server");
    try {
      return { ok: true, result: await checkConsistency(data.notes, data.book) };
    } catch (e) {
      console.error("consistency check failed", e);
      return { ok: false, error: friendlyError(e) };
    }
  });
