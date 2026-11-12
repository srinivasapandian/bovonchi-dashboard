import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { KitchenPrintOrderTypesField } from '../forms/KitchenPrintOrderTypesField';
import type { KitchenPrintFormValue } from '../../data/types';
import type { OutletOrderType } from '../../utils/outletOrderTypes';
import { validateKitchenPrintForm } from '../../utils/kitchenPrintRouting';

interface BulkKitchenPrintModalProps {
  open: boolean;
  onClose: () => void;
  itemCount: number;
  /** Selected items with no kitchen station (the setting has no effect until one is assigned). */
  noStationCount: number;
  orderTypes: OutletOrderType[];
  onApply: (value: KitchenPrintFormValue) => void;
}

export function BulkKitchenPrintModal({
  open,
  onClose,
  itemCount,
  noStationCount,
  orderTypes,
  onApply,
}: BulkKitchenPrintModalProps) {
  const [value, setValue] = useState<KitchenPrintFormValue>({ mode: 'all', orderTypeIds: [] });
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    const err = validateKitchenPrintForm(value, orderTypes);
    if (err) {
      setError(err);
      return;
    }
    onApply(value);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Kitchen printing for ${itemCount} item${itemCount === 1 ? '' : 's'}`}
      width={520}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={apply}>Apply</Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {noStationCount > 0 && (
          <p style={{ fontSize: 12, color: 'var(--orange, #B07A2A)', margin: 0, fontFamily: 'var(--font-primary)' }}>
            {/* was: {noStationCount} of these items {noStationCount === 1 ? 'has' : 'have'} no kitchen station; the setting will apply once one is assigned. */}{noStationCount} of these products {noStationCount === 1 ? 'has' : 'have'} no kitchen station; the setting will apply once one is assigned.
          </p>
        )}
        <KitchenPrintOrderTypesField
          orderTypes={orderTypes}
          value={value}
          onChange={(next) => {
            setValue(next);
            setError(null);
          }}
          error={error ?? undefined}
        />
      </div>
    </Modal>
  );
}
