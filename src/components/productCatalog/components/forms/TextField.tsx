import React, { useId } from "react";
import { labelStyle, errorStyle, containerStyle, requiredMarkStyle, getInputBaseStyle, handleFocusStyle, handleBlurStyle } from "./formStyles";

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  type?: "text" | "email" | "tel";
  maxLength?: number;
  counterWarnAfter?: number;
  /** Keep the maxLength hard-block but hide the "x/max" character counter. */
  hideCounter?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}

const TextField: React.FC<TextFieldProps> = ({
  label,
  value: rawValue,
  onChange,
  placeholder = "",
  error,
  required = false,
  disabled = false,
  type = "text",
  maxLength,
  counterWarnAfter,
  hideCounter = false,
  inputRef,
  onBlur,
}) => {
  const value = rawValue ?? '';
  const id = useId();
  const clamp = (next: string) =>
    maxLength !== undefined ? next.slice(0, maxLength) : next;
  const inputSt: React.CSSProperties = getInputBaseStyle({ disabled, error });
  const showCounter = maxLength !== undefined && !hideCounter;
  const warnCounter =
    showCounter &&
    counterWarnAfter !== undefined &&
    value.length > counterWarnAfter;
  const cntSt: React.CSSProperties = {
    fontSize: "11px",
    color: warnCounter ? "#B07A2A" : "var(--t3, #9A9084)",
    fontFamily: "var(--font-mono, SF Mono, monospace)",
    marginLeft: "auto",
  };

  return (
    <div style={containerStyle}>
      <label htmlFor={id} style={labelStyle}>
        {label}
        {required && <span style={requiredMarkStyle}>*</span>}
      </label>
      <input
        id={id}
        ref={inputRef}
        type={type}
        value={value}
        onKeyDown={(e) => {
          if (e.key === ' ' && !value.trim()) e.preventDefault();
        }}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData('text');
          if (pasted !== pasted.replace(/^\s+/, '')) {
            e.preventDefault();
            onChange(clamp(value + pasted.replace(/^\s+/, '')));
            return;
          }
          if (maxLength !== undefined && pasted.length > 0) {
            e.preventDefault();
            const input = e.currentTarget;
            const start = input.selectionStart ?? value.length;
            const end = input.selectionEnd ?? value.length;
            const next = value.slice(0, start) + pasted + value.slice(end);
            onChange(clamp(next));
          }
        }}
        onChange={(e) => onChange(clamp(e.target.value))}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={maxLength}
        required={required}
        style={inputSt}
        onFocus={(e) => handleFocusStyle(e, error)}
        onBlur={(e) => {
          handleBlurStyle(e, error);
          onBlur?.(e);
        }}
      />
      {(error || showCounter) && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", minHeight: "16px" }}>
          {error ? <p style={errorStyle}>{error}</p> : <span />}
          {showCounter && <span style={cntSt}>{value.length}/{maxLength}</span>}
        </div>
      )}
    </div>
  );
};

export default TextField;
