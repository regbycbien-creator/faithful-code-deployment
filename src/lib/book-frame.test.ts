import { describe, expect, it } from "vitest";
import { bookFrameHead, chooseStartingCopy } from "./book-frame";

const pub = { nodes: [1], groups: [1], tag: "public" };
const local = JSON.stringify({ nodes: [2], groups: [2], tag: "device" });

describe("new account's private copy", () => {
  it("starts from the public book when one has been published", () => {
    expect(chooseStartingCopy(pub, local)).toEqual(pub);
  });
  it("falls back to this device's earlier copy when nothing is published", () => {
    expect(chooseStartingCopy(null, local)).toEqual(JSON.parse(local));
  });
  it("uses the built-in sample when there is neither", () => {
    expect(chooseStartingCopy(null, null)).toBeNull();
    expect(chooseStartingCopy(null, "not json")).toBeNull();
  });
});

describe("book frame", () => {
  it("public view blocks editing", () => {
    expect(bookFrameHead({ ns: null, readonly: true })).toContain("beforeinput");
  });
  it("private copy stays editable", () => {
    expect(bookFrameHead({ ns: ":u1", readonly: false })).not.toContain("beforeinput");
  });
});
