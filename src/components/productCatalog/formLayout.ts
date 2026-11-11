import type { CSSProperties } from 'react';

const BORDER = 'var(--card-border, #E6DFD3)';

/** Full-height column for desktop form layouts (matches Item / Menu forms). */
export const formPageOuterStyle: CSSProperties = {
  height: '100%',
  maxHeight: '100%',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: 'var(--bg, #FFFFFF)',
  boxSizing: 'border-box',
};

export const formPageMainScrollStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: 'auto',
  overflowX: 'hidden',
};

/** Bottom actions — scrolls with content unless used as sibling after {@link formPageMainScrollStyle}. */
export const formStickyActionBarStyle: CSSProperties = {
  position: 'sticky',
  bottom: 0,
  marginTop: 24,
  background: 'var(--surface, #FFFFFF)',
  borderTop: `1px solid ${BORDER}`,
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '16px 24px',
  zIndex: 2,
};

/** Pinned footer bar: use as last child of {@link formPageOuterStyle} (same look as Item form). */
export const formStickyActionBarFooterStyle: CSSProperties = {
  ...formStickyActionBarStyle,
  flexShrink: 0,
  marginTop: 0,
};

/** Menu form: Cancel left, actions right. */
export const formStickyActionBarFooterBetweenStyle: CSSProperties = {
  ...formStickyActionBarFooterStyle,
  justifyContent: 'space-between',
};

/** Same as above but flush inside a padded card (negative horizontal margin). */
export const formStickyActionBarInCardStyle: CSSProperties = {
  position: 'sticky',
  bottom: 0,
  background: 'var(--surface, #FFFFFF)',
  borderTop: `1px solid ${BORDER}`,
  padding: '16px 24px',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  zIndex: 2,
  borderRadius: '0 0 14px 14px',
  margin: '24px -24px -24px',
};

/** Ghost Cancel — matches Item form. */
export const formCancelButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 20px',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--t2, #6E665D)',
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-button, 10px)',
  cursor: 'pointer',
};

/** Primary Save — matches Item form. */
export const formSaveButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 20px',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: '#FFFFFF',
  background: 'var(--accent, #B89550)',
  border: 'none',
  borderRadius: 'var(--radius-button, 10px)',
  cursor: 'pointer',
};

/** Secondary outline (e.g. Save Draft, modal cancel). */
export const formOutlineButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 20px',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'var(--font-primary)',
  color: 'var(--t1, #453F39)',
  background: '#fff',
  border: `1px solid ${BORDER}`,
  borderRadius: 'var(--radius-button, 10px)',
  cursor: 'pointer',
};
