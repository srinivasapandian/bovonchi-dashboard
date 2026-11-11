import { useState, type CSSProperties } from 'react';
import type { KitchenPrintOutletDefault } from '../../data/types';
import type { OutletOrderType } from '../../utils/outletOrderTypes';
import { describeOutletExclusions } from '../../utils/kitchenPrintRouting';
import { Button } from './Button';
import { OutletKitchenPrintModal } from './OutletKitchenPrintModal';

interface OutletKitchenPrintCardProps {
  orderTypes: OutletOrderType[];
  outletDefault?: KitchenPrintOutletDefault;
  /** Excluded order-type ids; `null` = every order type prints. */
  onSave: (excludedOrderTypeIds: string[] | null) => void;
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  background: 'var(--surface, #FFFFFF)',
  border: '1px solid var(--card-border, #E6DFD3)',
  borderRadius: 'var(--radius-card, 14px)',
  padding: '12px 16px',
  marginBottom: 16,
};

const iconWrapStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: '50%',
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--accent-soft, rgba(184,149,80,0.08))',
  color: 'var(--accent, #B89550)',
};

/** Outlet-wide kitchen printing: one-line summary + Edit (opens OutletKitchenPrintModal). */
export function OutletKitchenPrintCard({ orderTypes, outletDefault, onSave }: OutletKitchenPrintCardProps) {
  const [editing, setEditing] = useState(false);

  return (
    <section aria-label="Kitchen printing" style={rowStyle}>
      <span style={iconWrapStyle} aria-hidden="true">
        <span className="material-symbols-rounded" style={{ fontSize: 20 }}>print</span>
      </span>
      <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-primary)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1, #453F39)' }}>Kitchen printing</div>
        <div style={{ fontSize: 13, color: 'var(--t2, #6E665D)' }}>
          {orderTypes.length === 0 ? 'This outlet has no order types set up.' : describeOutletExclusions(outletDefault, orderTypes)}
        </div>
      </div>
      {orderTypes.length > 0 && (
        <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
      )}
      {editing && (
        <OutletKitchenPrintModal
          open
          onClose={() => setEditing(false)}
          orderTypes={orderTypes}
          outletDefault={outletDefault}
          onSave={onSave}
        />
      )}
    </section>
  );
}
