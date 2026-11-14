import { createOpenAI } from "@ai-sdk/openai";
import { Output, streamText } from "ai";
import { z } from "zod/v4";

import { createLovableAiGatewayRunIdFetch } from "./run-id";

const issueSchema = z.object({
  loai: z.enum(["Nhân vật", "Địa điểm", "Sự kiện", "Thời gian", "Khác"]),
  mucDo: z.enum(["Cao", "Trung bình", "Thấp"]),
  tieuDe: z.string(),
  chiTiet: z.string(),
  dauVet: z.array(z.string()),
  goiY: z.string(),
});

export const resultSchema = z.object({
  tomTat: z.string(),
  mauThuan: z.array(issueSchema),
});

export type ConsistencyResult = z.infer<typeof resultSchema>;

const INSTRUCTIONS = `Bạn là biên tập viên kiểm tra tính nhất quán của cốt truyện (tiếng Việt).
Nhiệm vụ: tìm MÂU THUẪN thật sự giữa nhân vật (tên, tuổi, quan hệ, thân phận, tính cách, sống/chết), địa điểm (vị trí, ai ở đâu, khoảng cách) và sự kiện (thứ tự, năm tháng, nguyên nhân – kết quả).
- Chỉ nêu điều thực sự trái ngược nhau hoặc bất khả thi; không nêu góp ý văn phong.
- "dauVet": trích nguyên văn ngắn các câu gây mâu thuẫn (2 trích dẫn trở lên nếu có).
- "goiY": cách sửa ngắn gọn.
- Nếu không thấy mâu thuẫn, trả về danh sách rỗng và nói rõ trong "tomTat".
Trả lời hoàn toàn bằng tiếng Việt.`;

export async function checkConsistency(notes: string, book: string | null): Promise<ConsistencyResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("Chưa cấu hình khóa AI.");
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });

  let content = `GHI CHÚ CỐT TRUYỆN CỦA NGƯỜI VIẾT:\n${notes.trim() || "(trống)"}`;
  if (book) content += `\n\nDỮ LIỆU SỔ CỐT TRUYỆN HIỆN TẠI (JSON):\n${book}`;

  let streamError: unknown;
  const result = streamText({
    model: provider.responses("openai/gpt-6-astra"),
    instructions: INSTRUCTIONS,
    messages: [{ role: "user", content }],
    output: Output.object({ schema: resultSchema }),
    maxRetries: 0,
    onError: ({ error }) => {
      streamError = error;
    },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: "medium",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  try {
    return await result.output;
  } catch (e) {
    throw streamError ?? e;
  }
}
