import { useState, useMemo } from 'react';
import { useItemsStore, useCategoriesStore, useMenusStore, useSessionsStore, useMenuPricesStore, useToastStore } from '../../../../redux/productCatalog/productCatalogHooks';
import { Modal } from '../../components/ui/Modal';

const ACCENT = '#B89550';
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_PRESETS = [
  { label: 'Weekdays', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] },
  { label: 'Weekends', days: ['Sat', 'Sun'] },
  { label: 'Every Day', days: [...DAYS] },
];

interface HappyHourWizardProps { open: boolean; onClose: () => void; onComplete?: () => void; }

export default function HappyHourWizard({ open, onClose, onComplete }: HappyHourWizardProps) {
  const { items } = useItemsStore();
  const { categories } = useCategoriesStore();
  const { addMenu } = useMenusStore();
  const { addSession } = useSessionsStore();
  const { bulkAdjust } = useMenuPricesStore();
  const { addToast } = useToastStore();

  const [step, setStep] = useState(1);
  // Step 1
  const [name, setName] = useState('Happy Hour');
  const [days, setDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [startTime, setStartTime] = useState('16:00');
  const [endTime, setEndTime] = useState('19:00');
  // Step 2
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  // Step 3
  const [pricingMode, setPricingMode] = useState<'percentage' | 'fixed' | 'custom'>('percentage');
  const [pctOff, setPctOff] = useState(30);
  const [fixedPrices, setFixedPrices] = useState<Record<string, number>>({});

  const allSelectedItemIds = useMemo(() => {
    const ids = new Set(selectedItems);
    selectedCats.forEach((catId) => {
      items.filter((it) => it.categoryIds.includes(catId) && it.status === 'active').forEach((it) => ids.add(it.id));
    });
    return ids;
  }, [selectedCats, selectedItems, items]);

  const selectedItemsList = useMemo(() => items.filter((it) => allSelectedItemIds.has(it.id)), [items, allSelectedItemIds]);

  const handleLaunch = (asDraft: boolean) => {
    // Create session
    const sessionId = `session-hh-${Date.now()}`;
    addSession({
      name, slots: [{ id: `slot-${Date.now()}`, days: [...days], startTime, endTime }],
      assignedItemCount: allSelectedItemIds.size,
    } as any);

    // Create menu
    const menuId = `menu-hh-${Date.now()}`;
    const catIds = Array.from(selectedCats);
    addMenu({
      name,
      status: asDraft ? 'draft' : 'live',
      categoryIds: catIds,
      deviceIds: [],
      lastUpdated: new Date().toISOString(),
      sessionIds: [sessionId],
      individualItemIds: Array.from(selectedItems),
    } as any);

    // Set prices
    if (pricingMode === 'percentage') {
      const basePrices: Record<string, number> = {};
      selectedItemsList.forEach((it) => { basePrices[it.id] = it.basePrice; });
      bulkAdjust(menuId, Array.from(allSelectedItemIds), basePrices, { mode: 'percentage', value: pctOff });
    } else if (pricingMode === 'fixed') {
      const basePrices: Record<string, number> = {};
      selectedItemsList.forEach((it) => { basePrices[it.id] = it.basePrice; });
      // Apply fixed price per category
      Object.entries(fixedPrices).forEach(([catId, price]) => {
        const catItemIds = selectedItemsList.filter((it) => it.categoryIds.includes(catId)).map((it) => it.id);
        const bp: Record<string, number> = {};
        catItemIds.forEach((iid) => { bp[iid] = price; });
        bulkAdjust(menuId, catItemIds, bp, { mode: 'fixed', value: price });
      });
    }

    addToast(`'${name}' ${asDraft ? 'saved as draft' : 'is live'}! Active ${days.join(', ')} from ${startTime} to ${endTime}.`, 'success');
    onClose();
    onComplete?.();
  };

  if (!open) return null;

  return (
    <Modal open={open} onClose={onClose} title="" width={540}>
      <div style={{ fontFamily: 'var(--font-primary)' }}>
        {/* Progress */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
          {[1, 2, 3, 4].map((s) => (
            <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= step ? ACCENT : '#E6DFD3', transition: 'background 0.2s' }} />
          ))}
        </div>

        {/* Step 1: Name & Schedule */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: '0 0 4px' }}>Name & Schedule</h2>
            <p style={{ fontSize: 12, color: '#6E665D', margin: '0 0 16px' }}>When does your happy hour run?</p>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#6E665D', display: 'block', marginBottom: 6 }}>Happy Hour Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ fontSize: 13, padding: '10px 12px', border: '1px solid #E6DFD3', borderRadius: 2, width: '100%', outline: 'none', marginBottom: 16, boxSizing: 'border-box' as const }} />

            <label style={{ fontSize: 12, fontWeight: 500, color: '#6E665D', display: 'block', marginBottom: 8 }}>Days</label>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              {DAY_PRESETS.map((p) => (
                <button key={p.label} type="button" onClick={() => setDays([...p.days])}
                  style={{ padding: '4px 10px', borderRadius: 2, fontSize: 11, fontWeight: 600, border: JSON.stringify(days.sort()) === JSON.stringify(p.days.sort()) ? `1.5px solid ${ACCENT}` : '1px solid #E6DFD3', background: '#fff', color: '#6E665D', cursor: 'pointer' }}>{p.label}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
              {DAYS.map((d) => (
                <button key={d} type="button" onClick={() => setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d])}
                  style={{ width: 42, padding: '6px 0', borderRadius: 2, fontSize: 11, fontWeight: 600, border: days.includes(d) ? `1.5px solid ${ACCENT}` : '1px solid #E6DFD3', background: days.includes(d) ? `${ACCENT}08` : '#fff', color: days.includes(d) ? ACCENT : '#6E665D', cursor: 'pointer' }}>{d}</button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#6E665D', display: 'block', marginBottom: 6 }}>Start Time</label>
                <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={{ fontSize: 13, padding: '8px 12px', border: '1px solid #E6DFD3', borderRadius: 2, width: '100%', outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#6E665D', display: 'block', marginBottom: 6 }}>End Time</label>
                <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={{ fontSize: 13, padding: '8px 12px', border: '1px solid #E6DFD3', borderRadius: 2, width: '100%', outline: 'none', boxSizing: 'border-box' as const }} />
              </div>
            </div>
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 2, background: '#FFFFFF', fontSize: 12, color: '#6E665D' }}>
              {days.join(', ')}, {startTime} – {endTime}
            </div>
          </div>
        )}

        {/* Step 2: Select Items */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: '0 0 4px' }}>Select Items</h2>
            <p style={{ fontSize: 12, color: '#6E665D', margin: '0 0 16px' }}>Which items are included in your happy hour? ({allSelectedItemIds.size} selected)</p>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#9A9084', textTransform: 'uppercase', marginBottom: 8 }}>By Category <span style={{ fontSize: 9, color: '#5F7A55', background: '#16A34A15', padding: '1px 6px', borderRadius: 4, marginLeft: 4 }}>Recommended</span></p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {categories.filter((c) => items.some((it) => it.categoryIds.includes(c.id))).map((cat) => (
                <button key={cat.id} type="button" onClick={() => {
                  const next = new Set(selectedCats);
                  next.has(cat.id) ? next.delete(cat.id) : next.add(cat.id);
                  setSelectedCats(next);
                }} style={{
                  padding: '6px 12px', borderRadius: 2, fontSize: 12, fontWeight: 600,
                  border: selectedCats.has(cat.id) ? `1.5px solid ${ACCENT}` : '1px solid #E6DFD3',
                  background: selectedCats.has(cat.id) ? `${ACCENT}08` : '#fff',
                  color: selectedCats.has(cat.id) ? ACCENT : '#6E665D', cursor: 'pointer',
                }}>{cat.name} ({items.filter((it) => it.categoryIds.includes(cat.id)).length})</button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Set Pricing */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: '0 0 4px' }}>Set Pricing</h2>
            <p style={{ fontSize: 12, color: '#6E665D', margin: '0 0 16px' }}>How should happy hour prices work?</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {([['percentage', '% Off'], ['fixed', 'Fixed Price'], ['custom', 'Custom']] as const).map(([m, label]) => (
                <button key={m} type="button" onClick={() => setPricingMode(m as any)}
                  style={{ padding: '8px 16px', borderRadius: 2, fontSize: 12, fontWeight: 600, border: pricingMode === m ? `1.5px solid ${ACCENT}` : '1px solid #E6DFD3', background: pricingMode === m ? `${ACCENT}08` : '#fff', color: pricingMode === m ? ACCENT : '#6E665D', cursor: 'pointer' }}>{label}</button>
              ))}
            </div>
            {pricingMode === 'percentage' && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: '#6E665D', display: 'block', marginBottom: 6 }}>Percentage off</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="number" min={1} max={99} value={pctOff} onChange={(e) => setPctOff(Number(e.target.value))} style={{ fontSize: 14, padding: '8px 12px', border: '1px solid #E6DFD3', borderRadius: 2, width: 80, outline: 'none' }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#6E665D' }}>% off all {allSelectedItemIds.size} items</span>
                </div>
              </div>
            )}
            {pricingMode === 'fixed' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Array.from(selectedCats).map((catId) => {
                  const cat = categories.find((c) => c.id === catId);
                  return (
                    <div key={catId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#453F39', width: 120 }}>{cat?.name}</span>
                      <span style={{ fontSize: 12, color: '#9A9084' }}>$</span>
                      <input type="number" min={0} step={1} value={fixedPrices[catId] ?? ''} onChange={(e) => setFixedPrices({ ...fixedPrices, [catId]: Number(e.target.value) })}
                        placeholder="0.00" style={{ fontSize: 13, padding: '6px 10px', border: '1px solid #E6DFD3', borderRadius: 2, width: 80, outline: 'none' }} />
                    </div>
                  );
                })}
              </div>
            )}
            {/* Preview */}
            {selectedItemsList.length > 0 && pricingMode === 'percentage' && (
              <div style={{ marginTop: 16, padding: 12, borderRadius: 2, background: '#FDFCF9', border: '1px solid #E6DFD3' }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: '#9A9084', margin: '0 0 8px' }}>PREVIEW</p>
                {selectedItemsList.slice(0, 5).map((it) => {
                  const newPrice = Math.round(it.basePrice * (1 - pctOff / 100) * 100) / 100;
                  return (
                    <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '4px 0' }}>
                      <span style={{ color: '#453F39' }}>{it.name}</span>
                      <span><span style={{ textDecoration: 'line-through', color: '#9A9084', marginRight: 6 }}>${it.basePrice.toFixed(2)}</span><span style={{ fontWeight: 600, color: '#5F7A55' }}>${newPrice.toFixed(2)}</span></span>
                    </div>
                  );
                })}
                {selectedItemsList.length > 5 && <div style={{ fontSize: 11, color: '#9A9084', marginTop: 4 }}>and {selectedItemsList.length - 5} more...</div>}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Review & Launch */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#453F39', margin: '0 0 16px' }}>Review & Launch</h2>
            <div style={{ padding: 16, borderRadius: 2, background: '#FDFCF9', border: '1px solid #E6DFD3', marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#453F39', marginBottom: 8 }}>{name}</div>
              <div style={{ fontSize: 12, color: '#6E665D', marginBottom: 4 }}>{days.join(', ')}, {startTime} – {endTime}</div>
              <div style={{ fontSize: 12, color: '#6E665D', marginBottom: 4 }}>{allSelectedItemIds.size} items</div>
              <div style={{ fontSize: 12, color: '#6E665D' }}>
                {pricingMode === 'percentage' ? `${pctOff}% off all items` : pricingMode === 'fixed' ? 'Fixed prices per category' : 'Custom prices'}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          <button type="button" onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            style={{ padding: '8px 16px', borderRadius: 2, border: 'none', background: '#F4F0E8', color: '#6E665D', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step === 4 && (
              <button type="button" onClick={() => handleLaunch(true)}
                style={{ padding: '8px 16px', borderRadius: 2, border: '1px solid #E6DFD3', background: '#fff', color: '#6E665D', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Save as Draft
              </button>
            )}
            <button type="button"
              onClick={() => step < 4 ? setStep(step + 1) : handleLaunch(false)}
              disabled={step === 2 && allSelectedItemIds.size === 0}
              style={{ padding: '8px 20px', borderRadius: 2, border: 'none', background: (step === 2 && allSelectedItemIds.size === 0) ? '#E6DFD3' : ACCENT, color: '#fff', fontSize: 13, fontWeight: 600, cursor: (step === 2 && allSelectedItemIds.size === 0) ? 'not-allowed' : 'pointer' }}>
              {step === 4 ? 'Launch Happy Hour' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
