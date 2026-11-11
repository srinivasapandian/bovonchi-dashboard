import React from "react";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

const Pagination: React.FC<PaginationProps> = ({ page, pageSize, total, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = Math.min((page - 1) * pageSize + 1, total);
  const end = Math.min(page * pageSize, total);

  const btnSt = (disabled: boolean): React.CSSProperties => ({
    fontSize: 12, fontWeight: 500, fontFamily: "var(--font-primary)", color: disabled ? "var(--t3, #9A9084)" : "var(--t1, #453F39)", backgroundColor: "var(--surface, #FFF)", border: "1px solid var(--card-border, #E6DFD3)", borderRadius: 2, padding: "6px 12px", cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.15s ease", opacity: disabled ? 0.5 : 1,
  });
  const pageBtnSt = (active: boolean): React.CSSProperties => ({
    fontSize: 12, fontWeight: active ? 600 : 400, fontFamily: "var(--font-primary)", color: active ? "var(--surface, #FFF)" : "var(--t1, #453F39)", backgroundColor: active ? "var(--accent, #B89550)" : "var(--surface, #FFF)", border: active ? "1px solid var(--accent, #B89550)" : "1px solid var(--card-border, #E6DFD3)", borderRadius: 2, padding: "6px 10px", cursor: "pointer", transition: "all 0.15s ease", minWidth: 32, textAlign: "center" as const,
  });

  const getPages = (): (number | "...")[] => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) { for (let i = 1; i <= totalPages; i++) pages.push(i); }
    else {
      pages.push(1);
      if (page > 3) pages.push("...");
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
      if (page < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", fontFamily: "var(--font-primary)" }}>
      <span style={{ fontSize: 12, color: "var(--t2, #6E665D)" }}>Showing {start}-{end} of {total}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} style={btnSt(page <= 1)}>Prev</button>
        {getPages().map((p, i) => p === "..." ? <span key={`e${i}`} style={{ padding: "0 4px", color: "var(--t3, #9A9084)" }}>...</span> : <button key={p} onClick={() => onPageChange(p as number)} style={pageBtnSt(p === page)}>{p}</button>)}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} style={btnSt(page >= totalPages)}>Next</button>
      </div>
    </div>
  );
};

export default Pagination;
