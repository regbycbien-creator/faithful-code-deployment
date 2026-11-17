import { BOOK_LOCAL_KEY } from "@/lib/autosave";

/**
 * Where a new account's private copy starts: the latest public book; if nothing has
 * been published yet, the copy this device kept before accounts existed; else the
 * file's built-in sample (null).
 */
export function chooseStartingCopy(publicData: unknown, legacyLocal: string | null): unknown {
  if (isBook(publicData)) return publicData;
  if (legacyLocal) {
    try {
      const v = JSON.parse(legacyLocal);
      if (isBook(v)) return v;
    } catch {
      /* ignore broken device copy */
    }
  }
  return null;
}

export function isBook(v: unknown): boolean {
  return !!v && typeof v === "object" && "nodes" in v && "groups" in v;
}

// Buttons and fields that change the book; blocked and hidden in read-only views.
const EDIT_CONTROLS = [
  "#ag",
  "#ac",
  "#ap",
  "#aa",
  "#an",
  "#rs",
  "#jok",
  "[data-up]",
  "[data-dn]",
  "[data-del]",
  "[data-addn]",
  "[data-delg]",
  "[data-lb]",
  "[data-un]",
  "[data-ln]",
  "[data-mv]",
  "[data-gc]",
  "[data-pup]",
  "[data-pdn]",
  "[data-pdel]",
  "[data-pin]",
  "[data-pend]",
  "[data-cm]",
  "[data-cdel]",
  "[data-gen]",
  "[data-aadd]",
  "[data-au]",
  "[data-ad]",
  "[data-ax]",
  "[data-ns]",
  "[data-nx]",
  "[data-delc]",
].join(",");

/**
 * Script placed before the file's own code. `ns` keeps each account's on-device copy
 * apart (null = keep nothing on the device); `readonly` turns the book into a viewer.
 */
export function bookFrameHead(opts: { ns: string | null; readonly: boolean }): string {
  const storage = `(function(){var K=${JSON.stringify(BOOK_LOCAL_KEY)},NS=${JSON.stringify(opts.ns)},p=Storage.prototype,g=p.getItem,s=p.setItem;
p.getItem=function(k){return k===K?(NS?g.call(this,K+NS):null):g.call(this,k)};
p.setItem=function(k,v){if(k===K){if(NS)s.call(this,K+NS,v);return}return s.call(this,k,v)};})();`;
  const readonly = opts.readonly
    ? `(function(){var SEL=${JSON.stringify(EDIT_CONTROLS)};
function stop(e){var t=e.target;if(t&&t.closest&&t.closest(SEL)){e.preventDefault();e.stopImmediatePropagation()}}
window.addEventListener("beforeinput",function(e){if(e.target&&e.target.id!=="q")e.preventDefault()},true);
window.addEventListener("click",stop,true);window.addEventListener("change",stop,true);window.addEventListener("input",stop,true);})();`
    : "";
  const css = opts.readonly
    ? `<style>${EDIT_CONTROLS},.tools,#st{display:none!important}[contenteditable]{caret-color:transparent;cursor:default}</style>`
    : "";
  return `<script>window.claude=parent.__claude;${storage}${readonly}</script>${css}`;
}
