import React, { useState } from "react";

interface Column { key: string; label: string; sortable?: boolean; render?: (value: any, row: any) => React.ReactNode; align?: "left" | "center" | "right"; mono?: boolean; }
interface DataTableProps { columns: Column[]; data: any[]; onRowClick?: (row: any) => void; emptyMessage?: string; }

const DataTable: React.FC<DataTableProps> = ({ columns, data, onRowClick, emptyMessage = "No data available" }) => {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);

  const handleSort = (key: string) => {
    if (sortKey === key) { setSortDir(sortDir === "asc" ? "desc" : "asc"); }
    else { setSortKey(key); setSortDir("asc"); }
  };

  const sorted = sortKey ? [...data].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av == null) return 1; if (bv == null) return -1;
    const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  }) : data;

  const thSt: React.CSSProperties = { fontSize: 10.5, fontWeight: 500, color: "var(--bv-gold-deep, #8A6D33)", background: "var(--bv-sand, #F4F0E8)", fontFamily: "var(--font-primary)", textTransform: "uppercase" as const, letterSpacing: "0.22em", padding: "14px 16px", borderBottom: "1px solid var(--divider, #ECE5D8)", userSelect: "none" as const, whiteSpace: "nowrap" as const };
  const tdSt: React.CSSProperties = { fontSize: 14, color: "var(--t1, #453F39)", fontFamily: "var(--font-primary)", padding: "12px 14px", borderBottom: "1px solid var(--divider, #ECE5D8)", verticalAlign: "middle" };

  if (data.length === 0) {
    return (<div style={{ textAlign: "center", padding: "48px 20px", color: "var(--t3, #9A9084)", fontSize: 13, fontFamily: "var(--font-primary)" }}>{emptyMessage}</div>);
  }

  return (
    <div style={{ overflowX: "auto" as const, borderRadius: 2, border: "1px solid var(--card-border, #E6DFD3)", backgroundColor: "var(--surface, #FFF)" }}>
      <table style={{ width: "100%", minWidth: columns.length > 3 ? 560 : undefined, borderCollapse: "collapse" as const, borderSpacing: 0 }}>
        <thead>
          <tr>{columns.map((col) => (
            <th key={col.key} style={{ ...thSt, textAlign: col.align || "left", cursor: col.sortable ? "pointer" : "default" }} onClick={() => col.sortable && handleSort(col.key)}>
              {col.label}{col.sortable && sortKey === col.key && (<span style={{ marginLeft: 4 }}>{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>)}
            </th>
          ))}</tr>
        </thead>
        <tbody>{sorted.map((row, i) => (
          <tr key={i} onClick={() => onRowClick && onRowClick(row)} onMouseEnter={() => setHoveredRow(i)} onMouseLeave={() => setHoveredRow(null)} style={{ backgroundColor: hoveredRow === i ? "var(--hover, #F4F0E8)" : "transparent", cursor: onRowClick ? "pointer" : "default", transition: "background-color 0.1s ease" }}>
            {columns.map((col) => (
              <td key={col.key} style={{ ...tdSt, textAlign: col.align || "left", fontFamily: col.mono ? "var(--font-mono, SF Mono, monospace)" : "var(--font-primary)" }}>
                {col.render ? col.render(row[col.key], row) : row[col.key]}
              </td>
            ))}
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
};

export default DataTable;
