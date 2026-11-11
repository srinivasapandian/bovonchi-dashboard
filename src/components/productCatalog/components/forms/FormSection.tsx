import React from "react";

interface FormSectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

const FormSection: React.FC<FormSectionProps> = ({ title, subtitle, children }) => {
  return (
    <div style={{ borderBottom: "1px solid var(--divider, #ECE5D8)", paddingBottom: "24px", marginBottom: "24px" }}>
      <div style={{ marginBottom: "16px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 600, color: "var(--t1, #453F39)", fontFamily: "var(--font-primary, Jost, sans-serif)", margin: 0, lineHeight: "20px" }}>{title}</h3>
        {subtitle && <p style={{ fontSize: "12px", color: "var(--t3, #9A9084)", fontFamily: "var(--font-primary, Jost, sans-serif)", margin: "4px 0 0 0", lineHeight: "16px" }}>{subtitle}</p>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>{children}</div>
    </div>
  );
};

export default FormSection;
