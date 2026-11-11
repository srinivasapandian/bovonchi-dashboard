import type React from "react";

export const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--t2, #6E665D)",
  fontFamily: "var(--font-primary, Jost, sans-serif)",
  lineHeight: "16px",
};

export const errorStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  color: "var(--red, #A63D2F)",
  fontFamily: "var(--font-primary, Jost, sans-serif)",
  margin: 0,
};

export const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  width: "100%",
};

export const requiredMarkStyle: React.CSSProperties = {
  color: "var(--accent, #B89550)",
  marginLeft: "2px",
};

/** Shared base input styles (fontSize, fontFamily, border, padding, transitions). */
export function getInputBaseStyle(opts: {
  disabled?: boolean;
  error?: string;
}): React.CSSProperties {
  return {
    fontSize: "13px",
    fontFamily: "var(--font-primary, Jost, sans-serif)",
    color: opts.disabled ? "var(--t3, #9A9084)" : "var(--t1, #453F39)",
    backgroundColor: opts.disabled ? "var(--hover, #F4F0E8)" : "var(--surface, #FFFFFF)",
    border: opts.error
      ? "1px solid var(--red, #A63D2F)"
      : "1px solid var(--card-border, #E6DFD3)",
    borderRadius: "8px",
    padding: "10px 14px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box" as const,
    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    cursor: opts.disabled ? "not-allowed" : "text",
  };
}

/** Apply focus ring — box-shadow only; border is owned by error state, never overridden here */
export function handleFocusStyle(e: { currentTarget: HTMLElement }, error?: string) {
  e.currentTarget.style.boxShadow = error
    ? "0 0 0 3px rgba(184,149,80, 0.15)"
    : "0 0 0 3px rgba(99, 102, 241, 0.15)";
}

/** Remove focus ring on blur */
export function handleBlurStyle(e: { currentTarget: HTMLElement }, _error?: string) {
  e.currentTarget.style.boxShadow = "none";
}
