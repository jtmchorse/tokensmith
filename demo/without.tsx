/**
 * SettingsCard — WITHOUT tokensmith
 *
 * Prompt given to the model:
 *   "Build a React settings card for the 'Meridian' app: a raised card with a
 *    title, a muted description, a divider, an email row, a primary 'Save
 *    changes' button, and a destructive 'Delete account' link."
 *
 * No design system was provided. Every color, size, radius, and spacing value
 * below is a GUESS — reasonable-looking defaults pulled from Tailwind muscle
 * memory. They are internally plausible but do not match Meridian's tokens.
 * See ../demo/README.md for the guessed-vs-token contrast.
 */
import React from "react";

export function SettingsCard() {
  return (
    <div
      style={{
        // GUESS: generic white card, thin gray-200 border, 12px corners
        background: "#ffffff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 24, // GUESS: 24px felt "roomy enough"
        maxWidth: 420,
        // GUESS: system font stack, no brand family
        fontFamily: "-apple-system, system-ui, sans-serif",
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 18, // GUESS
          fontWeight: 600, // GUESS: semibold
          color: "#111827", // GUESS: Tailwind gray-900
        }}
      >
        Account
      </h2>
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 14,
          color: "#6b7280", // GUESS: Tailwind gray-500
        }}
      >
        Manage the email and security settings for your Meridian account.
      </p>

      <hr
        style={{
          border: 0,
          borderTop: "1px solid #e5e7eb",
          margin: "20px 0", // GUESS
        }}
      />

      <label
        style={{
          display: "block",
          fontSize: 13,
          fontWeight: 500,
          color: "#374151",
          marginBottom: 6,
        }}
      >
        Email
      </label>
      <input
        defaultValue="jt@meridian.app"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "10px 12px", // GUESS
          fontSize: 14,
          border: "1px solid #d1d5db",
          borderRadius: 6, // GUESS: 6px
          color: "#111827",
        }}
      />

      <div style={{ display: "flex", gap: 12, marginTop: 24, alignItems: "center" }}>
        <button
          style={{
            // GUESS: Tailwind blue-600 for the primary action
            background: "#2563eb",
            color: "#ffffff",
            border: 0,
            borderRadius: 6, // GUESS
            padding: "10px 16px", // GUESS
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Save changes
        </button>
        <a
          href="#"
          style={{
            // GUESS: Tailwind red-500
            color: "#ef4444",
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Delete account
        </a>
      </div>
    </div>
  );
}
