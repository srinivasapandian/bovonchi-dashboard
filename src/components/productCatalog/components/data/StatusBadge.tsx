import React from "react";

type Status = "active" | "inactive" | "draft" | "scheduled" | "live" | "out_of_stock" | "hidden" | "archived" | "updated" | "pending" | "failed";

interface StatusBadgeProps {
  status: Status;
}

const statusConfig: Record<Status, { label: string; bg: string; color: string }> = {
  active: { label: "Active", bg: "rgba(48, 164, 108, 0.1)", color: "var(--green, #5F7A55)" },
  inactive: { label: "Inactive", bg: "rgba(156, 163, 184, 0.1)", color: "var(--t3, #9A9084)" },
  draft: { label: "Draft", bg: "rgba(156, 163, 184, 0.1)", color: "var(--t2, #6E665D)" },
  scheduled: { label: "Scheduled", bg: "rgba(59, 130, 246, 0.1)", color: "#7D8F69" },
  live: { label: "Live", bg: "rgba(48, 164, 108, 0.1)", color: "var(--green, #5F7A55)" },
  out_of_stock: { label: "Out of Stock", bg: "rgba(184,149,80, 0.1)", color: "var(--orange, #B89550)" },
  hidden: { label: "Hidden", bg: "rgba(156, 163, 184, 0.1)", color: "var(--t3, #9A9084)" },
  archived: { label: "Archived", bg: "rgba(156, 163, 184, 0.1)", color: "var(--t2, #6E665D)" },
  updated: { label: "Updated", bg: "rgba(59, 130, 246, 0.1)", color: "#7D8F69" },
  pending: { label: "Pending", bg: "rgba(184,149,80, 0.1)", color: "var(--orange, #B89550)" },
  failed: { label: "Failed", bg: "rgba(166,61,47, 0.1)", color: "var(--red, #A63D2F)" },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const cfg = statusConfig[status];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 600, fontFamily: "var(--font-primary, Jost, sans-serif)", color: cfg.color, backgroundColor: cfg.bg, padding: "3px 10px", borderRadius: "4px", textTransform: "uppercase" as const, letterSpacing: "0.3px", lineHeight: "16px", whiteSpace: "nowrap" as const }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
};

export default StatusBadge;
