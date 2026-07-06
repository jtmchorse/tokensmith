/**
 * SettingsCard — WITH tokensmith
 *
 * Prompt given to the model:
 *   "Build a React settings card for the 'Meridian' app (same structure as
 *    before). Use the design system via the tokensmith MCP tools — resolve
 *    every color, spacing, radius, and type value from a token; do not guess."
 *
 * Every literal below was resolved live through mcp__tokensmith__resolve_token /
 * list_tokens against the Meridian token set. The token path that produced each
 * value is named in the comment beside it. Aliases were followed to their
 * computed value (e.g. color.action.primary -> brand.primary -> base.blue-600).
 *
 * In a real build these would compile to CSS variables; they are inlined here
 * so the demo is self-contained and every value is traceable to a token.
 */
import React from "react";

export function SettingsCard() {
  return (
    <div
      style={{
        background: "#f7f8fa", // color.surface.raised -> base.gray-50
        border: "1px solid #c6ccd4", // color.border.default -> base.gray-300
        borderRadius: 16, // radius.lg
        padding: 16, // space.inset.card -> space.4
        maxWidth: 420,
        // type.family.sans
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 20, // type.size.lg
          fontWeight: 700, // type.weight.bold
          color: "#161a21", // color.text.default -> base.gray-900
        }}
      >
        Account
      </h2>
      <p
        style={{
          margin: "4px 0 0", // space.1
          fontSize: 14, // type.size.sm
          fontWeight: 400, // type.weight.regular
          color: "#5b6472", // color.text.muted -> base.gray-600
        }}
      >
        Manage the email and security settings for your Meridian account.
      </p>

      <hr
        style={{
          border: 0,
          borderTop: "1px solid #c6ccd4", // color.border.default
          margin: "16px 0", // space.4
        }}
      />

      <label
        style={{
          display: "block",
          fontSize: 12, // type.size.xs
          fontWeight: 500, // type.weight.medium
          color: "#5b6472", // color.text.muted
          marginBottom: 4, // space.1
        }}
      >
        Email
      </label>
      <input
        defaultValue="jt@meridian.app"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: 8, // space.inset.control -> space.2
          fontSize: 14, // type.size.sm
          border: "1px solid #c6ccd4", // color.border.default
          borderRadius: 8, // radius.interactive -> radius.md
          color: "#161a21", // color.text.default
        }}
      />

      <div style={{ display: "flex", gap: 12, marginTop: 24 /* space.6 */, alignItems: "center" }}>
        <button
          style={{
            background: "#2557c7", // color.action.primary -> brand.primary -> base.blue-600
            color: "#ffffff", // color.text.on-action -> base.gray-0
            border: 0,
            borderRadius: 8, // radius.interactive
            padding: 8, // space.inset.control
            paddingLeft: 16, // space.4
            paddingRight: 16, // space.4
            fontSize: 14, // type.size.sm
            fontWeight: 500, // type.weight.medium
            cursor: "pointer",
          }}
          // hover -> color.action.primary-hover (#1a419c)
        >
          Save changes
        </button>
        <a
          href="#"
          style={{
            color: "#c92c3d", // color.text.danger -> action.destructive -> base.red-600
            fontSize: 14, // type.size.sm
            fontWeight: 500, // type.weight.medium
            textDecoration: "none",
          }}
        >
          Delete account
        </a>
      </div>
    </div>
  );
}
