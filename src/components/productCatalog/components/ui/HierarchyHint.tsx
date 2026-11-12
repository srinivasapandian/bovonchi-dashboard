/**
 * PCF-19.5: Shared hierarchy hint component.
 * Renders a one-line contextual hint below section headers.
 * Purple hints = visibility (structural). Teal hints = availability (operational).
 */

const VISIBILITY_COLOR = '#8C6A7A';  // purple
const AVAILABILITY_COLOR = '#5E8C7B'; // teal

export type HintLayer = 'visibility' | 'availability';

const HINTS: Record<string, { text: string; layer: HintLayer }> = {
  // Menu
  'menu.channel_assignment': { text: "This menu is the ceiling — products can only appear on channels you enable here." /* was: "This menu is the ceiling — items can only appear on channels you enable here." */, layer: 'visibility' },
  'menu.session_scope': { text: "This menu is only active during selected sessions. Outside these times, devices show their default menu.", layer: 'visibility' },
  // Category
  'category.channel_visibility': { text: "This is a parent control. Turning a channel OFF here blocks all products in this category from that channel." /* was: "This is a parent control. Turning a channel OFF here blocks all items in this category from that channel." */, layer: 'visibility' },
  'subcategory.channel_visibility': { text: "Constrained by parent category. You can narrow further but not widen.", layer: 'visibility' },
  // Item
  'item.channel_visibility': { text: "Choose which channels this item appears on. This narrows within what your category and menu allow.", layer: 'visibility' },
  'item.session_assignment': { text: "Controls when this item appears. Only orderable during assigned sessions.", layer: 'visibility' },
  'item.status': { text: "Controls whether this item is available right now. For permanent channel changes, use Channel Visibility above.", layer: 'availability' },
  // Combo / Set Menu
  'combo.channel_visibility': { text: "Choose which channels this combo appears on.", layer: 'visibility' },
  'combo.status': { text: "Draft combos are not visible. Publish to make available.", layer: 'availability' },
  'set_menu.channel_visibility': { text: "Choose which channels this set menu appears on.", layer: 'visibility' },
  // Modifier
  'modifier.stock': { text: "Operational — mark out of stock temporarily.", layer: 'availability' },
  'modifier.online': { text: "Structural — controls whether this appears on online channels.", layer: 'visibility' },
  // Variation
  'variation.available': { text: "Turn OFF to temporarily remove this size from ordering.", layer: 'availability' },
  // POS
  'pos.86_action': { text: "This is temporary — the product will come back. To permanently remove from a channel, use the Back Office." /* was: "This is temporary — the item will come back. To permanently remove from a channel, use the Back Office." */, layer: 'availability' },
};

interface HierarchyHintProps {
  hintKey: string;
  /** Override the parent category name for subcategory hint */
  parentName?: string;
}

export default function HierarchyHint({ hintKey, parentName }: HierarchyHintProps) {
  const entry = HINTS[hintKey];
  if (!entry) return null;

  const accentColor = entry.layer === 'visibility' ? VISIBILITY_COLOR : AVAILABILITY_COLOR;
  let text = entry.text;
  if (parentName && hintKey === 'subcategory.channel_visibility') {
    text = `Constrained by parent category '${parentName}'. You can narrow further but not widen.`;
  }

  return (
    <p style={{
      fontSize: 11,
      color: 'var(--t3, #9A9084)',
      margin: '0 0 10px',
      fontFamily: 'var(--font-primary)',
      lineHeight: 1.5,
      paddingLeft: 10,
      borderLeft: `2px solid ${accentColor}30`,
    }}>
      {text}
    </p>
  );
}

/** Section header with purple (visibility) or teal (availability) accent */
export function SectionHeader({ label, layer, icon }: { label: string; layer: HintLayer; icon?: string }) {
  const color = layer === 'visibility' ? VISIBILITY_COLOR : AVAILABILITY_COLOR;
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color, textTransform: 'uppercase',
      letterSpacing: '0.04em', marginBottom: 6, fontFamily: 'var(--font-primary)',
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {icon && <span className="material-symbols-rounded" style={{ fontSize: 16, color }}>{icon}</span>}
      <span style={{ borderBottom: `2px solid ${color}20`, paddingBottom: 2 }}>{label}</span>
    </div>
  );
}
