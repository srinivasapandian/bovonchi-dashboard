import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Toggle } from './Toggle';
import type { KitchenPrintOutletDefault } from '../../data/types';
import { getChannelDisplayName, type OutletOrderType } from '../../utils/outletOrderTypes';
import { validateOutletDefault } from '../../utils/kitchenPrintRouting';
import { errorStyle } from '../forms/formStyles';

interface OutletKitchenPrintModalProps {
  open: boolean;
  onClose: () => void;
  orderTypes: OutletOrderType[];
  outletDefault?: KitchenPrintOutletDefault;
  /** Excluded order-type ids; `null` = every order type prints. */
  onSave: (excludedOrderTypeIds: string[] | null) => void;
}

/** Edit window for the outlet-wide kitchen printing setting. Mount only while open so each opening starts from the saved value. */
export function OutletKitchenPrintModal({ open, onClose, orderTypes, outletDefault, onSave }: OutletKitchenPrintModalProps) {
  const [printing, setPrinting] = useState<string[]>(() =>
    orderTypes.filter((ot) => !outletDefault?.excludedOrderTypeIds.includes(ot.id)).map((ot) => ot.id),
  );
  const [error, setError] = useState<string | null>(null);

  const setOn = (id: string, on: boolean) => {
    setError(null);
    setPrinting((prev) => (on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));
  };

  const save = () => {
    const err = validateOutletDefault(printing, orderTypes);
    if (err) {
      setError(err);
      return;
    }
    const excluded = orderTypes.filter((ot) => !printing.includes(ot.id)).map((ot) => ot.id);
    onSave(excluded.length === 0 ? null : excluded);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Kitchen printing"
      width={440}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </>
      }
    >
      <p style={{ fontSize: 13, color: 'var(--t2, #6E665D)', margin: '0 0 12px', fontFamily: 'var(--font-primary)' }}>
        Choose which order types send tickets to kitchen stations.      </p>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {orderTypes.map((ot) => (
          <div
            key={ot.id}
            style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--divider, #F1ECE2)' }}
          >
            <Toggle
              checked={printing.includes(ot.id)}
              onChange={(on) => setOn(ot.id, on)}
              label={getChannelDisplayName(ot.typeName)}
            />
            {ot.typeName.toLowerCase().includes('delivery') && (
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--t3, #9A9084)', fontFamily: 'var(--font-primary)' }}>
                (includes all third-party orders)
              </span>
            )}
          </div>
        ))}
      </div>
      {error && <p style={{ ...errorStyle, marginTop: 10 }}>{error}</p>}
    </Modal>
  );
}
