import type { CSSProperties, MouseEvent } from 'react';

/** Icon size (px) for edit / clone / delete on catalog list rows */
export const CATALOG_LIST_ACTION_ICON_PX = 18;

/** Shared 32×32 ghost icon button for catalog list rows */
export const catalogListActionButtonStyle: CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--t3, #9A9084)',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background 0.15s ease, color 0.15s ease',
};

export function catalogListActionEnterDefault(e: MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = 'var(--hover, #F4F0E8)';
  e.currentTarget.style.color = 'var(--t1, #453F39)';
}

export function catalogListActionLeaveDefault(e: MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = 'transparent';
  e.currentTarget.style.color = 'var(--t3, #9A9084)';
}

export function catalogListActionEnterDanger(e: MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = 'var(--red-soft, rgba(166,61,47,0.08))';
  e.currentTarget.style.color = 'var(--red, #A63D2F)';
}

export function catalogListActionLeaveDanger(e: MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = 'transparent';
  e.currentTarget.style.color = 'var(--t3, #9A9084)';
}

/**
 * Label for a duplicated entity, e.g. "Wings" → "Wings - copy".
 * Avoids appending twice if the name already ends with " - copy".
 */
export function withCloneNameLabel(name: string, fallback = 'Untitled'): string {
  const raw = name.trim() || fallback;
  if (/\s-\s*copy\s*$/i.test(raw)) return raw;
  return `${raw} - copy`;
}
export function generateCopyName(
  originalName: string,
  existingNames: string[],
  maxLength?: number,
): string {
  const base = originalName.trim().replace(/\s*\(Copy(?:\s+\d+)?\)\s*$/i, '').trim();
  const taken = new Set(existingNames.map((n) => n.trim().toLowerCase()));

  const build = (suffix: string): string => {
    if (!maxLength) return `${base}${suffix}`;
    const full = `${base}${suffix}`;
    if (full.length <= maxLength) return full;
    return `${base.slice(0, maxLength - suffix.length)}${suffix}`;
  };

  const first = build(' (Copy)');
  if (!taken.has(first.toLowerCase())) return first;

  for (let i = 2; i < 200; i++) {
    const candidate = build(` (Copy ${i})`);
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return first; // fallback (extremely unlikely)
}
