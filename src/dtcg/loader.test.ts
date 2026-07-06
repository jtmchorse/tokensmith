import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadTokensFile, parseTokens } from "./loader.js";
import { TokenParseError } from "./types.js";

const EXAMPLE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../examples/tokens.json",
);

describe("loadTokensFile (example system)", () => {
  const set = loadTokensFile(EXAMPLE);

  it("loads a realistic number of tokens", () => {
    expect(set.tokens.size).toBeGreaterThanOrEqual(50);
  });

  it("flattens paths with dots", () => {
    expect(set.tokens.has("color.action.primary")).toBe(true);
    expect(set.tokens.has("space.inset.card")).toBe(true);
    expect(set.tokens.has("type.size.2xl")).toBe(true);
  });

  it("detects aliases and their targets, without resolving", () => {
    const t = set.tokens.get("color.action.primary")!;
    expect(t.isAlias).toBe(true);
    expect(t.aliasTarget).toBe("color.brand.primary");
    expect(t.raw).toBe("{color.brand.primary}"); // raw stays as-written
  });

  it("keeps non-aliases as literals", () => {
    const t = set.tokens.get("color.base.blue-600")!;
    expect(t.isAlias).toBe(false);
    expect(t.raw).toBe("#2557c7");
  });

  it("inherits $type from the nearest group", () => {
    expect(set.tokens.get("color.base.gray-0")!.type).toBe("color");
    expect(set.tokens.get("space.inset.card")!.type).toBe("dimension");
  });

  it("own $type wins over inherited", () => {
    expect(set.tokens.get("type.family.sans")!.type).toBe("fontFamily");
    expect(set.tokens.get("type.weight.bold")!.type).toBe("fontWeight");
  });

  it("carries $description through", () => {
    expect(set.tokens.get("color.surface.raised")!.description).toMatch(
      /Cards, popovers/,
    );
  });

  it("handles composite (object) values", () => {
    const t = set.tokens.get("shadow.raised")!;
    expect(t.type).toBe("shadow");
    expect(t.isAlias).toBe(false);
    expect((t.raw as Record<string, unknown>).blur).toBe("8px");
  });
});

describe("parseTokens (error paths — loud and located)", () => {
  it("rejects a non-object root", () => {
    expect(() => parseTokens([1, 2, 3])).toThrow(TokenParseError);
  });

  it("rejects an empty document", () => {
    expect(() => parseTokens({})).toThrow(/no tokens/);
  });

  it("rejects illegal characters in names, naming the path", () => {
    const bad = { color: { "brand.primary": { $value: "#fff", $type: "color" } } };
    expect(() => parseTokens(bad)).toThrow(/illegal character.*"brand\.primary"/s);
  });

  it("rejects a token that is also a group", () => {
    const bad = {
      color: {
        $type: "color",
        brand: { $value: "#fff", nested: { $value: "#000" } },
      },
    };
    expect(() => parseTokens(bad)).toThrow(/cannot also be a group/);
  });

  it("rejects a typeless non-alias token, naming the path", () => {
    const bad = { misc: { orphan: { $value: "12px" } } };
    try {
      parseTokens(bad);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TokenParseError);
      expect((e as TokenParseError).path).toBe("misc.orphan");
    }
  });

  it("allows a typeless ALIAS token (type arrives at resolution, M2)", () => {
    const ok = {
      color: { $type: "color", base: { blue: { $value: "#00f" } } },
      semantic: { info: { $value: "{color.base.blue}" } },
    };
    const set = parseTokens(ok);
    const info = set.tokens.get("semantic.info")!;
    expect(info.isAlias).toBe(true);
    expect(info.type).toBeUndefined();
  });

  it("annotates unreadable files with the file path", () => {
    expect(() => loadTokensFile("/nonexistent/tokens.json")).toThrow(
      /nonexistent/,
    );
  });
});
