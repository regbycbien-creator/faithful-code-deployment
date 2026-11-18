import runtime from "./json-sync.runtime.js?raw";
import { jsonFileName } from "./json-sync";

type G = typeof globalThis & { S: unknown; JsonSync: { sync: () => void } };
const g = globalThis as G;

function setup(book: unknown) {
  document.body.innerHTML =
    '<button id="js"></button><button id="dl" class="hide"></button>' +
    '<dialog id="dlg"><textarea id="jt"></textarea><div class="bar"><button id="jx"></button></div></dialog>';
  g.S = book;
  new Function(runtime)();
  const dlg = document.getElementById("dlg") as HTMLDialogElement;
  const jt = document.getElementById("jt") as HTMLTextAreaElement;
  const open = () => {
    jt.value = JSON.stringify(g.S, null, 1); // what the file does on "Xuất/Nhập JSON"
    dlg.setAttribute("open", "");
  };
  return { dlg, jt, open };
}

describe("JSON box sync", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("shows the newest book content while the box is open", () => {
    const { jt, open } = setup({ nodes: [{ t: "cũ" }] });
    open();
    g.JsonSync.sync();
    g.S = { nodes: [{ t: "mới" }] };
    g.JsonSync.sync();
    expect(JSON.parse(jt.value)).toEqual({ nodes: [{ t: "mới" }] });
  });

  it("does not overwrite JSON the user is typing into the box", () => {
    const { jt, open } = setup({ nodes: [] });
    open();
    g.JsonSync.sync();
    jt.value = '{"nodes":["dán vào"]}';
    g.S = { nodes: ["khác"] };
    g.JsonSync.sync();
    expect(jt.value).toBe('{"nodes":["dán vào"]}');
  });

  it("picks up the newest content again after closing and reopening", () => {
    const { dlg, jt, open } = setup({ nodes: [] });
    open();
    g.JsonSync.sync();
    jt.value = "đang gõ";
    dlg.removeAttribute("open");
    g.JsonSync.sync();
    g.S = { nodes: ["mới nhất"] };
    open();
    g.JsonSync.sync();
    expect(JSON.parse(jt.value)).toEqual({ nodes: ["mới nhất"] });
  });

  it("names downloaded files with date and time", () => {
    expect(jsonFileName(new Date(2026, 10, 18, 20, 5))).toBe("so-cot-truyen-2026-11-18-2005.json");
  });
});
