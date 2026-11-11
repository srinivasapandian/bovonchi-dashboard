import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getInputBaseStyle } from "./formStyles";

export type CatalogDropdownOption = { value: string; label: string };

export type CatalogDropdownProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: CatalogDropdownOption[];
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  /** Merged onto the default trigger (form / toolbar) styles */
  triggerStyle?: React.CSSProperties;
  /** When there is no visible <label>, set this for screen readers */
  ariaLabel?: string;
  menuMaxHeight?: number;
  required?: boolean;
  topSlot?: React.ReactNode;
  triggerLabel?: string;
  scrollToValue?: string;
  highlightValue?: string;
};

const MENU_Z = 10050;
const GAP = 4;

const chevronSvg =
  "url(\"data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 viewBox=%270 0 12 12%27%3E%3Cpath d=%27M3 4.5L6 7.5L9 4.5%27 fill=%27none%27 stroke=%27%239CA3B8%27 stroke-width=%271.5%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E\")";

export const CatalogDropdown: React.FC<CatalogDropdownProps> = ({
  id,
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  error,
  triggerStyle,
  ariaLabel,
  menuMaxHeight = 280,
  required = false,
  topSlot,
  triggerLabel,
  scrollToValue,
  highlightValue,
}) => {
  const genId = useId();
  const controlId = id ?? `pc-dd-${genId}`;
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionsScrollRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const optButtonRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const selected = options.find((o) => o.value === value);
  const displayLabel = triggerLabel ?? selected?.label ?? placeholder;
  const mutedDisplay = triggerLabel ? false : !selected;

  const updatePosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ top: r.bottom + GAP, left: r.left, width: r.width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onResize = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!scrollToValue || !open) return;
    const btn = optButtonRefs.current.get(scrollToValue);
    btn?.scrollIntoView({ block: 'nearest' });
  }, [scrollToValue, open]);

  const baseTrigger: React.CSSProperties = {
    ...getInputBaseStyle({ disabled, error }),
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    width: "100%",
    textAlign: "left" as const,
    cursor: disabled ? "not-allowed" : "pointer",
    appearance: "none" as const,
    WebkitAppearance: "none" as const,
    backgroundImage: chevronSvg,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: 36,
    color: mutedDisplay ? "var(--t3, #9A9084)" : "var(--t1, #453F39)",
    border:
      error
        ? "1px solid var(--red, #A63D2F)"
        : `1px solid ${open || focused ? "var(--accent, #B89550)" : "var(--card-border, #E6DFD3)"}`,
    boxShadow:
      !error && (open || focused) ? "0 0 0 3px var(--accent-soft, rgba(184,149,80, 0.1))" : "none",
  };

  const menu = open && !disabled && (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: coords.top,
        left: coords.left,
        width: coords.width,
        minWidth: coords.width,
        maxHeight: menuMaxHeight,
        zIndex: MENU_Z,
        backgroundColor: "var(--surface, #FFFFFF)",
        border: "1px solid var(--card-border, #E6DFD3)",
        borderRadius: 2,
        boxShadow: "0 10px 40px rgba(26, 29, 46, 0.12), 0 2px 8px rgba(26, 29, 46, 0.06)",
        boxSizing: "border-box" as const,
        display: "flex",
        flexDirection: "column" as const,
        overflow: "hidden",
      }}
    >
      {topSlot ? (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            flexShrink: 0,
            padding: "6px 8px 8px",
            borderBottom: "1px solid var(--card-border, #E6DFD3)",
            background: "var(--surface, #FFFFFF)",
          }}
        >
          {topSlot}
        </div>
      ) : null}
      <div
        ref={optionsScrollRef}
        role="listbox"
        id={`${controlId}-listbox`}
        style={{
          flex: 1,
          overflowY: "auto" as const,
          padding: 4,
          minHeight: 0,
          scrollbarWidth: "thin" as const,
        }}
      >
        {options.map((opt, optIdx) => {
          const isOn = opt.value === value;
          const isHighlighted = !isOn && !!highlightValue && opt.value === highlightValue;
          return (
            <button
              key={opt.value !== "" ? opt.value : `empty-${optIdx}`}
              ref={(el) => {
                if (el) optButtonRefs.current.set(opt.value, el);
                else optButtonRefs.current.delete(opt.value);
              }}
              type="button"
              role="option"
              aria-selected={isOn}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
                btnRef.current?.focus();
              }}
              style={{
                display: "block",
                width: "100%",
                border: "none",
                borderRadius: 2,
                margin: 0,
                padding: "8px 10px",
                fontSize: 13,
                fontWeight: isOn || isHighlighted ? 600 : 500,
                fontFamily: "var(--font-primary, Jost, sans-serif)",
                textAlign: "left" as const,
                cursor: "pointer",
                background: isOn
                  ? "rgba(184,149,80, 0.08)"
                  : isHighlighted
                  ? "rgba(184,149,80, 0.05)"
                  : "transparent",
                color: isOn || isHighlighted ? "var(--accent, #B89550)" : "var(--t1, #453F39)",
                outline: isHighlighted ? "1px solid rgba(184,149,80,0.25)" : "none",
                outlineOffset: -1,
                transition: "background 0.12s ease, color 0.12s ease",
              }}
              onMouseEnter={(e) => {
                if (!isOn && !isHighlighted) e.currentTarget.style.background = "var(--hover, #F4F0E8)";
              }}
              onMouseLeave={(e) => {
                if (!isOn && !isHighlighted) e.currentTarget.style.background = "transparent";
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} style={{ width: "100%", position: "relative" }}>
      <button
        ref={btnRef}
        type="button"
        id={controlId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${controlId}-listbox`}
        aria-label={ariaLabel}
        aria-required={required || undefined}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
          if (!open) updatePosition();
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ ...baseTrigger, ...triggerStyle }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap" as const,
            flex: 1,
            minWidth: 0,
          }}
        >
          {displayLabel}
        </span>
      </button>
      {typeof document !== "undefined" && menu ? createPortal(menu, document.body) : null}
    </div>
  );
};
