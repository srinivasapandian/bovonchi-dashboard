import React, { useId } from "react";
import { labelStyle, errorStyle, containerStyle, requiredMarkStyle } from "./formStyles";
import { CatalogDropdown, type CatalogDropdownOption } from "./CatalogDropdown";

export type { CatalogDropdownOption };

interface SelectProps {
  label?: string;
  /** Used when `label` is omitted (e.g. toolbar filters) */
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
  options: CatalogDropdownOption[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  topSlot?: React.ReactNode;
  triggerLabel?: string;
  scrollToValue?: string;
  highlightValue?: string;
}

const Select: React.FC<SelectProps> = ({
  label,
  ariaLabel,
  value,
  onChange,
  options,
  placeholder = "Select...",
  error,
  required = false,
  disabled = false,
  topSlot,
  triggerLabel,
  scrollToValue,
  highlightValue,
}) => {
  const id = useId();

  return (
    <div style={containerStyle}>
      {label ? (
        <label htmlFor={id} style={labelStyle}>
          {label}
          {required && <span style={requiredMarkStyle}>*</span>}
        </label>
      ) : null}
      <CatalogDropdown
        id={id}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        disabled={disabled}
        error={error}
        required={required}
        ariaLabel={label ? undefined : (ariaLabel ?? (placeholder || "Choose option"))}
        topSlot={topSlot}
        triggerLabel={triggerLabel}
        scrollToValue={scrollToValue}
        highlightValue={highlightValue}
      />
      {error && <p style={{ ...errorStyle, marginTop: "4px" }}>{error}</p>}
    </div>
  );
};

export default Select;
