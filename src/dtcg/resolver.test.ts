import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadTokensFile, parseTokens } from "./loader.js";
import { resolveAll, resolveToken, TokenResolveError } from "./resolver.js";

const EXAMPLE = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../examples/tokens.json",
);
const set = loadTokensFile(EXAMPLE);

describe("resolveToken (example system)", () => {
  it("resolves a literal with a length-1 chain", () => {
    const r = resolveToken(set, "color.base.blue-600");
    expect(r.value).toBe("#2557c7");
    expect(r.type).toBe("color");
    expect(r.chain).toEqual(["color.base.blue-600"]);
  });

  it("resolves a 2-deep alias", () => {
    const r = resolveToken(set, "color.brand.primary");
    expect(r.value).toBe("#2557c7");
    expect(r.chain).toEqual(["color.brand.primary", "color.base.blue-600"]);
  });

  it("resolves the 3-deep demo chain", () => {
    const r = resolveToken(set, "color.action.primary");
    expect(r.value).toBe("#2557c7");
    expect(r.chain).toEqual([
      "color.action.primary",
      "color.brand.primary",
      "color.base.blue-600",
    ]);
  });

  it("resolves the other 3-deep chain (text.danger)", () => {
    const r = resolveToken(set, "color.text.danger");
    expect(r.value).toBe("#c92c3d");
    expect(r.chain).toEqual([
      "color.text.danger",
      "color.action.destructive",
      "color.base.red-600",
    ]);
  });

  it("keeps the ASKED token's description, not the target's", () => {
    const r = resolveToken(set, "color.action.primary");
    expect(r.description).toMatch(/Default action color/);
  });

  it("resolves dimension aliases across groups", () => {
    const r = resolveToken(set, "space.inset.card");
    expect(r.value).toBe("16px");
    expect(r.type).toBe("dimension");
  });

  it("passes composite values through untouched", () => {
    const r = resolveToken(set, "shadow.raised");
    expect((r.value as Record<string, unknown>).blur).toBe("8px");
    expect(r.chain).toHaveLength(1);
  });
});

describe("type adoption", () => {
  it("typeless alias adopts the target's type", () => {
    const s = parseTokens({
      color: { $type: "color", base: { blue: { $value: "#00f" } } },
      semantic: { info: { $value: "{color.base.blue}" } },
    });
    const r = resolveToken(s, "semantic.info");
    expect(r.type).toBe("color");
    expect(r.value).toBe("#00f");
  });

  it("an alias's own type wins over the target's", () => {
    const s = parseTokens({
      base: { unit: { $type: "dimension", $value: "4px" } },
      weird: { alias: { $type: "string", $value: "{base.unit}" } },
    });
    expect(resolveToken(s, "weird.alias").type).toBe("string");
  });
});

describe("resolveAll", () => {
  it("resolves every token in the example system", () => {
    const all = resolveAll(set);
    expect(all.size).toBe(set.tokens.size);
    // no resolution may terminate on an alias string
    for (const r of all.values()) {
      if (typeof r.value === "string") {
        expect(r.value).not.toMatch(/^\{.+\}$/);
      }
      expect(r.type).toBeTruthy();
    }
  });

  it("resolves all 21 aliases to terminal literals", () => {
    const all = resolveAll(set);
    const aliased = [...set.tokens.values()].filter((t) => t.isAlias);
    expect(aliased).toHaveLength(21);
    for (const t of aliased) {
      expect(all.get(t.path)!.chain.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("failure paths — loud, located, chain-carrying", () => {
  it("unknown token names the path", () => {
    expect(() => resolveToken(set, "color.nope.missing")).toThrow(
      /unknown token "color\.nope\.missing"/,
    );
  });

  it("suggests a near-miss on wrong case", () => {
    expect(() => resolveToken(set, "Color.Action.Primary")).toThrow(
      /did you mean "color\.action\.primary"/,
    );
  });

  it("suggests a near-miss on a unique leaf", () => {
    expect(() => resolveToken(set, "space.control")).toThrow(
      /did you mean "space\.inset\.control"/,
    );
  });

  it("declines to guess when the leaf is ambiguous", () => {
    // "raised" matches color.surface.raised AND shadow.raised — no hint.
    try {
      resolveToken(set, "color.raised");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect((e as Error).message).not.toMatch(/did you mean/);
    }
  });

  it("broken alias target reports the chain so far", () => {
    const s = parseTokens({
      color: { $type: "color", a: { $value: "{color.gone}" } },
    });
    try {
      resolveToken(s, "color.a");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TokenResolveError);
      expect((e as TokenResolveError).chain).toEqual(["color.a", "color.gone"]);
      expect((e as Error).message).toMatch(/alias points at unknown token/);
    }
  });

  it("detects a 2-node cycle and shows the loop", () => {
    const s = parseTokens({
      color: {
        $type: "color",
        a: { $value: "{color.b}" },
        b: { $value: "{color.a}" },
      },
    });
    try {
      resolveToken(s, "color.a");
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(TokenResolveError);
      expect((e as Error).message).toMatch(/cycle/);
      expect((e as TokenResolveError).chain).toEqual([
        "color.a",
        "color.b",
        "color.a",
      ]);
    }
  });

  it("detects a self-referencing alias", () => {
    const s = parseTokens({
      color: { $type: "color", me: { $value: "{color.me}" } },
    });
    expect(() => resolveToken(s, "color.me")).toThrow(/cycle/);
  });

  it("detects a longer cycle entered mid-chain", () => {
    const s = parseTokens({
      t: {
        $type: "string",
        entry: { $value: "{t.a}" },
        a: { $value: "{t.b}" },
        b: { $value: "{t.c}" },
        c: { $value: "{t.a}" },
      },
    });
    expect(() => resolveToken(s, "t.entry")).toThrow(/cycle/);
  });
});
