import runtime from "./case-boxes.runtime.js?raw";

/**
 * Tags appended to the book's <head>: the box view for characters, tasks, clues and the
 * per-case "Lưu ý" section in "Chi tiết án". `readonly` draws the boxes without edit controls.
 */
export function caseBoxesHead(readonly: boolean): string {
  return `<script>window.__cbRO=${readonly ? "true" : "false"};${runtime}</script>`;
}
