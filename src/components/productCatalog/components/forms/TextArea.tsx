import React, { useId } from "react";

interface TextAreaProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  counterWarnAfter?: number;
  rows?: number;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

const TextArea: React.FC<TextAreaProps> = ({ label, value, onChange, placeholder = "", maxLength, counterWarnAfter, rows = 4, error, required = false, disabled = false }) => {
  const id = useId();
  const clamp = (next: string) =>
    maxLength !== undefined ? next.slice(0, maxLength) : next;
  const labelSt: React.CSSProperties = { fontSize: "12px", fontWeight: 500, color: "var(--t2, #6E665D)", fontFamily: "var(--font-primary, Jost, sans-serif)", lineHeight: "16px" };
  const textareaSt: React.CSSProperties = { fontSize: "13px", fontFamily: "var(--font-primary, Jost, sans-serif)", color: disabled ? "var(--t3, #9A9084)" : "var(--t1, #453F39)", backgroundColor: disabled ? "var(--hover, #F4F0E8)" : "var(--surface, #FFFFFF)", border: error ? "1px solid var(--red, #A63D2F)" : "1px solid var(--card-border, #E6DFD3)", borderRadius: "8px", padding: "10px 12px", outline: "none", width: "100%", boxSizing: "border-box" as const, transition: "border-color 0.15s ease, box-shadow 0.15s ease", cursor: disabled ? "not-allowed" : "text", resize: "vertical" as const, lineHeight: "1.5" };
  const errSt: React.CSSProperties = { fontSize: "11px", fontWeight: 500, color: "var(--red, #A63D2F)", margin: 0 };
  const warnCounter =
    maxLength !== undefined &&
    counterWarnAfter !== undefined &&
    value.length > counterWarnAfter;
  const cntSt: React.CSSProperties = {
    fontSize: "11px",
    color: warnCounter ? "#B07A2A" : "var(--t3, #9A9084)",
    fontFamily: "var(--font-mono, SF Mono, monospace)",
    marginLeft: "auto",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
      <label htmlFor={id} style={labelSt}>
        {label}
        {required && <span style={{ color: "var(--accent, #B89550)", marginLeft: "2px" }}>*</span>}
      </label>
      <textarea id={id} value={value} onKeyDown={(e) => { if (e.key === ' ' && !value.trim()) e.preventDefault(); }} onPaste={(e) => { const pasted = e.clipboardData.getData('text'); if (pasted !== pasted.replace(/^\s+/, '')) { e.preventDefault(); onChange(clamp(value + pasted.replace(/^\s+/, ''))); return; } if (maxLength !== undefined && pasted.length > 0) { e.preventDefault(); const input = e.currentTarget; const start = input.selectionStart ?? value.length; const end = input.selectionEnd ?? value.length; const next = value.slice(0, start) + pasted + value.slice(end); onChange(clamp(next)); } }} onChange={(e) => onChange(clamp(e.target.value))} placeholder={placeholder} maxLength={maxLength} rows={rows} disabled={disabled} required={required} style={textareaSt} onFocus={(e) => { e.currentTarget.style.boxShadow = error ? "0 0 0 3px rgba(184,149,80, 0.15)" : "0 0 0 3px rgba(99, 102, 241, 0.15)"; }} onBlur={(e) => { e.currentTarget.style.boxShadow = "none"; }} />
      {(error || maxLength !== undefined) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: "16px" }}>
          {error ? <p style={errSt}>{error}</p> : <span />}
          {maxLength !== undefined && <span style={cntSt}>{value.length}/{maxLength}</span>}
        </div>
      )}
    </div>
  );
};

export default TextArea;
