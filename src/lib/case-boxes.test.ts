import { readFileSync } from "node:fs";
import path from "node:path";
import runtime from "./case-boxes.runtime.js?raw";

type Model = {
  mode: string;
  rows?: { tag: string; f: string[] }[];
  groups?: { t: string | null; items: string[] }[];
};
type Codec = { parse: (t: string, k: string) => Model; serialize: (m: Model) => string };

function codec(): Codec {
  const win: { CaseBoxCodec?: Codec } = {};
  new Function("window", "document", runtime)(win, undefined);
  return win.CaseBoxCodec!;
}

const { parse, serialize } = codec();

describe("case boxes", () => {
  it("leaves every boxed field of the file's built-in cases unchanged when nothing is edited", () => {
    const html = readFileSync(path.resolve(__dirname, "../../public/so-cot-truyen.html"), "utf8");
    const line = html.split("\n").find((l) => l.startsWith("const CASES="))!;
    const cases = JSON.parse(line.slice("const CASES=".length).replace(/;\s*$/, "")) as Record<
      string,
      unknown
    >[];
    let checked = 0;
    for (const c of cases) {
      for (const k of ["ds", "mv", "npc", "nv", "mm", "vc"]) {
        const v = c[k];
        if (typeof v !== "string" || !v.trim()) continue;
        expect(serialize(parse(v, k))).toBe(v.trim());
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it("gives each character in the case list its own box with name, role and appearance", () => {
    const m = parse("Tô Khuyết | cựu chủ Sở Thành | màn 7\nVương Tài | chủ mưu | màn 8", "ds");
    expect(m.rows).toHaveLength(2);
    expect(m.rows![0]!.f).toEqual(["Tô Khuyết", "cựu chủ Sở Thành", "màn 7"]);
  });

  it("splits a task's [type] from its content and writes it back the same way", () => {
    const m = parse("[Phụ] Canh đêm hoa viên | Tiểu Lục nhờ | thấy bóng ma | thưởng: vải trắng", "mv");
    expect(m.rows![0]!.tag).toBe("Phụ");
    expect(m.rows![0]!.f[0]).toBe("Canh đêm hoa viên");
    m.rows![0]!.tag = "Ẩn";
    expect(serialize(m)).toBe("[Ẩn] Canh đêm hoa viên | Tiểu Lục nhờ | thấy bóng ma | thưởng: vải trắng");
  });

  it("gives each clue of a layer its own box and adds new clues to that layer", () => {
    const m = parse("Tầng 1 (hiện trường): chén hai đáy; vết sáp.", "mm");
    expect(m.groups![0]!.t).toBe("Tầng 1 (hiện trường)");
    expect(m.groups![0]!.items).toEqual(["chén hai đáy", "vết sáp"]);
    m.groups![0]!.items.push("tiền mép nhám");
    expect(serialize(m)).toBe("Tầng 1 (hiện trường): chén hai đáy; vết sáp; tiền mép nhám.");
  });

  it("keeps a '|' typed inside a character box from creating an extra column", () => {
    const m = parse("A | b | c", "ds");
    m.rows![0]!.f[1] = "vai | phụ";
    expect(serialize(m)).toBe("A | vai / phụ | c");
  });

  it("stores the new per-case notes one per line, grouped under optional headings", () => {
    const m = parse("", "lu");
    m.groups!.push({ t: "Cần nhớ", items: ["Không để lộ Yến phi sớm", "Hint cho hoàng tử"] });
    expect(serialize(m)).toBe("Cần nhớ:\n- Không để lộ Yến phi sớm\n- Hint cho hoàng tử");
    expect(parse(serialize(m), "lu").groups![0]!.items).toHaveLength(2);
  });
});
