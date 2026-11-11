import React, { useId, useState, useEffect, useRef } from "react";
import { labelStyle, errorStyle, containerStyle, requiredMarkStyle, handleFocusStyle, handleBlurStyle } from "./formStyles";

interface NumberFieldProps {
  label: string;
  value: number | string;
  onChange: (value: number | string) => void;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  prefix?: string;
  suffix?: string;
  priceFormat?: boolean;
  /** Restrict input to whole numbers (no decimal point) — for quantities, serve counts, etc. */
  integer?: boolean;
}

const NumberField: React.FC<NumberFieldProps> = ({ label, value, onChange, min, max, step, error, required = false, disabled = false, prefix, suffix, priceFormat = false, integer = false }) => {
  const id = useId();
  const isFocusedRef = useRef(false);
  const [localStr, setLocalStr] = useState(value === "" ? "" : String(value));

  useEffect(() => {
    if (!isFocusedRef.current) {
      setLocalStr(value === "" ? "" : String(value));
    }
  }, [value]);

  const effectiveMax = priceFormat ? 9999.99 : max;
  const effectiveStep = step ?? 1;

  const wrapSt: React.CSSProperties = { display: "flex", alignItems: "center", border: error ? "1px solid var(--red, #A63D2F)" : "1px solid var(--card-border, #E6DFD3)", borderRadius: "8px", backgroundColor: disabled ? "var(--hover, #F4F0E8)" : "var(--surface, #FFFFFF)", transition: "border-color 0.15s ease, box-shadow 0.15s ease", overflow: "hidden" };
  const inputSt: React.CSSProperties = { fontSize: "13px", fontFamily: "var(--font-primary, Jost, sans-serif)", color: disabled ? "var(--t3, #9A9084)" : "var(--t1, #453F39)", border: "none", paddingTop: "10px", paddingBottom: "10px", paddingLeft: prefix ? "4px" : "14px", paddingRight: priceFormat ? "28px" : (suffix ? "4px" : "14px"), outline: "none", width: "100%", boxSizing: "border-box" as const, backgroundColor: "transparent", cursor: disabled ? "not-allowed" : "text" };
  const affixSt: React.CSSProperties = { fontSize: "13px", fontWeight: 500, color: "var(--t3, #9A9084)", fontFamily: "var(--font-primary, Jost, sans-serif)", paddingTop: 0, paddingBottom: 0, paddingLeft: "2px", paddingRight: "2px", flexShrink: 0, userSelect: "none" };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const n = Number(localStr);
    if (localStr !== "" && Number.isFinite(n)) {
      setLocalStr(String(n));
    } else if (localStr !== "") {
      setLocalStr(value === "" ? "" : String(value));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") { e.preventDefault(); handleUp(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); handleDown(); }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (priceFormat && raw !== '' && !/^\d{0,4}(\.\d{0,2})?$/.test(raw)) return;
    if (integer && raw !== '' && !/^\d{0,4}$/.test(raw)) return;
    setLocalStr(raw);
    if (raw === "") { onChange(""); return; }
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) onChange(parsed);
  };

  const handleUp = () => {
    const current = value === "" ? (min ?? 0) : Number(value);
    const next = Math.round((current + effectiveStep) * 100) / 100;
    const clamped = effectiveMax !== undefined ? Math.min(next, effectiveMax) : next;
    setLocalStr(String(clamped));
    onChange(clamped);
  };

  const handleDown = () => {
    const current = value === "" ? (min ?? 0) : Number(value);
    const next = Math.round((current - effectiveStep) * 100) / 100;
    const clamped = min !== undefined ? Math.max(next, min) : next;
    setLocalStr(String(clamped));
    onChange(clamped);
  };

  const numVal = value === "" ? null : Number(value);
  const canUp = !disabled && (effectiveMax === undefined || numVal === null || numVal < effectiveMax);
  const canDown = !disabled && (min === undefined || numVal === null || numVal > min);

  return (
    <div style={containerStyle}>
      <label htmlFor={id} style={labelStyle}>
        {label}
        {required && <span style={requiredMarkStyle}>*</span>}
      </label>
      <div style={wrapSt} onFocus={(e) => handleFocusStyle(e, error)} onBlur={(e) => handleBlurStyle(e, error)}>
        {prefix && <span style={{ ...affixSt, paddingLeft: "12px", paddingRight: "2px" }}>{prefix}</span>}
        {priceFormat ? (
          <div className="age-spinner-wrapper">
            <input
              id={id}
              type="text"
              inputMode="decimal"
              value={localStr}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              className="age-custom-input"
              min={min} max={effectiveMax} step={step} disabled={disabled} required={required} style={inputSt} />
            <div className="age-spinner-btns">
              <button type="button" tabIndex={-1} disabled={!canUp} onMouseDown={(e) => e.preventDefault()} onClick={handleUp}
                className="age-spinner-btn age-spinner-btn--up">
                <span className="material-symbols-rounded">arrow_drop_up</span>
              </button>
              <button type="button" tabIndex={-1} disabled={!canDown} onMouseDown={(e) => e.preventDefault()} onClick={handleDown}
                className="age-spinner-btn">
                <span className="material-symbols-rounded">arrow_drop_down</span>
              </button>
            </div>
          </div>
        ) : (
          <input
            id={id}
            type="text"
            inputMode="decimal"
            value={localStr}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            min={min} max={max} step={step} disabled={disabled} required={required} style={inputSt} />
        )}
        {suffix && <span style={{ ...affixSt, paddingLeft: "2px", paddingRight: "12px" }}>{suffix}</span>}
      </div>
      {error && <p style={{ ...errorStyle, marginTop: "4px" }}>{error}</p>}
    </div>
  );
};

export default NumberField;
