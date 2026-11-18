import runtime from "./json-sync.runtime.js?raw";

/** Script appended to the book's <head>: keeps the "Xuất/Nhập JSON" box on the latest content. */
export function jsonSyncHead(): string {
  return `<script>${runtime}</script>`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** File name for a downloaded copy, stamped with the local date and time. */
export function jsonFileName(d = new Date()): string {
  return `so-cot-truyen-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

/** The file's `claude.use("downloads")` API: saves the book JSON as a file on this device. */
export const downloadsApi = {
  async save({ data }: { filename?: string; data: string }) {
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = jsonFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  },
};
