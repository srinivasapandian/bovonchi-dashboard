import React from "react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, placeholder = "Search..." }) => {
  const containerSt: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    backgroundColor: value ? "var(--surface, #FFFFFF)" : "var(--hover, #F4F0E8)",
    border: "1px solid var(--card-border, #E6DFD3)",
    borderRadius: "20px",
    padding: "8px 14px",
    transition: "all 0.15s ease",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box" as const,
  };
  /** flex:1 + minWidth:0 so width stays stable when the clear control mounts/unmounts */
  const inputSt: React.CSSProperties = {
    fontSize: "13px",
    fontFamily: "var(--font-primary, Jost, sans-serif)",
    color: "var(--t1, #453F39)",
    border: "none",
    outline: "none",
    flex: 1,
    minWidth: 0,
    width: "auto",
    backgroundColor: "transparent",
    padding: 0,
  };
  const iconSt: React.CSSProperties = { flexShrink: 0, color: "var(--t3, #9A9084)" };
  const clearSt: React.CSSProperties = { flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--t3, #9A9084)", borderRadius: "50%" };

  return (
    <div style={containerSt} onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent, #B89550)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-soft, rgba(184,149,80, 0.1))"; e.currentTarget.style.backgroundColor = "var(--surface, #FFFFFF)"; }} onBlur={(e) => { e.currentTarget.style.borderColor = "var(--card-border, #E6DFD3)"; e.currentTarget.style.boxShadow = "none"; if (!value) e.currentTarget.style.backgroundColor = "var(--hover, #F4F0E8)"; }}>
      <svg style={iconSt} width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputSt} />
      {value && (
        <button type="button" onClick={() => onChange("")} style={clearSt} aria-label="Clear search">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M4 4L10 10M10 4L4 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
};

export default SearchInput;
