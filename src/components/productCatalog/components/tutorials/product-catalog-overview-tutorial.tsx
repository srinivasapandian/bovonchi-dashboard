import React from "react";
import TutorialSlideshow, { type TutorialSlide } from "./tutorial-slideshow";

const ACCENT = '#B89550';
const PURPLE = '#8C6A7A';
const TEAL = '#5E8C7B';
const GREEN = '#5F7A55';
const ORANGE = '#B07A2A';
const T1 = '#453F39';
const T2 = '#6E665D';
const T3 = '#9A9084';

/* ─── Slide 1: Your Digital Menu, One Place ─── */
function SlideOneIllustration() {
  const channels = [
    // { icon: 'point_of_sale', label: 'POS', color: ACCENT },
    // { icon: 'tablet_android', label: 'Kiosk', color: PURPLE },
    // { icon: 'delivery_dining', label: 'Delivery', color: TEAL },
    // { icon: 'language', label: 'Online', color: GREEN },
    { icon: 'language', label: 'Online Store', color: ACCENT },
    // { icon: 'takeout_dining', label: 'Pickup', color: TEAL },
    { icon: 'takeout_dining', label: 'Online', color: TEAL },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 56, height: 56, borderRadius: 2, background: `${ACCENT}10`, border: `2px solid ${ACCENT}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="material-symbols-rounded" style={{ fontSize: 28, color: ACCENT }}>storefront</span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: T1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Product Catalog</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        {channels.map((ch) => (
          <div key={ch.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 40, height: 40, borderRadius: 2, background: `${ch.color}10`, border: `1px solid ${ch.color}25`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-rounded" style={{ fontSize: 20, color: ch.color }}>{ch.icon}</span>
            </div>
            <span style={{ fontSize: 8, fontWeight: 600, color: ch.color }}>{ch.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Slide 2: The Building Blocks ─── */
function SlideTwoIllustration() {
  const blocks = [
    { icon: 'schedule', label: 'Sessions', desc: 'When', color: PURPLE },
    { icon: 'category', label: 'Categories', desc: 'Where', color: ACCENT },
    { icon: 'countertops', label: 'Kitchen Stations', desc: 'Routing', color: TEAL },
    { icon: 'tune', label: 'Modifiers', desc: 'Customisation', color: ORANGE },
    { icon: 'inventory_2', label: 'Items', desc: 'Your products', color: ACCENT },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
        {blocks.map((b) => (
          <div key={b.label} style={{
            width: 'calc(33% - 4px)', padding: '8px 6px', borderRadius: 2, textAlign: 'center',
            background: `${b.color}06`, border: `1px solid ${b.color}20`,
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: 18, color: b.color, display: 'block', marginBottom: 2 }}>{b.icon}</span>
            <div style={{ fontSize: 9, fontWeight: 700, color: b.color }}>{b.label}</div>
            <div style={{ fontSize: 7, color: T3, marginTop: 1 }}>{b.desc}</div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', fontSize: 8, color: T3, fontStyle: 'italic', marginTop: 2 }}>
        Set these up first. Items depend on all of them.
      </div>
    </div>
  );
}

/* ─── Slide 3: Items — The Heart of Everything ─── */
function SlideThreeIllustration() {
  const connections = [
    // { icon: 'category', label: 'Pizzas', color: ACCENT },
    // { icon: 'schedule', label: 'Lunch & Dinner', color: PURPLE },
    // { icon: 'countertops', label: 'Pizza Oven', color: TEAL },
    // { icon: 'tune', label: '8 toppings', color: ORANGE },
    { icon: 'category', label: 'T-Shirts', color: ACCENT },
    { icon: 'schedule', label: 'Weekdays', color: PURPLE },
    { icon: 'countertops', label: 'Packing Station', color: TEAL },
    { icon: 'tune', label: '4 sizes', color: ORANGE },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ padding: '10px 20px', borderRadius: 2, background: '#fff', border: `2px solid ${ACCENT}30`, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', textAlign: 'center' }}>
        {/* <div style={{ fontSize: 12, fontWeight: 700, color: T1 }}>Margherita Pizza</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>$9.50</div> */}
        <div style={{ fontSize: 12, fontWeight: 700, color: T1 }}>Classic T-Shirt</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>$19.50</div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {connections.map((c) => (
          <div key={c.label} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 2,
            background: `${c.color}08`, border: `1px solid ${c.color}20`,
          }}>
            <span className="material-symbols-rounded" style={{ fontSize: 12, color: c.color }}>{c.icon}</span>
            <span style={{ fontSize: 8, fontWeight: 600, color: c.color }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Slide 4: Control Center ─── */
function SlideFourIllustration() {
  // const items = ['Margherita', 'Caesar Salad', 'Fish & Chips'];
  // const channels = ['Dine-in', 'Delivery', 'Online'];
  // const states: Array<Array<[boolean, boolean]>> = [
  //   [[true, true], [true, true], [true, true]],
  //   [[true, true], [true, false], [true, true]],
  //   [[true, true], [true, true], [false, false]],
  // ];
  const items = ['Classic T-Shirt', 'Canvas Tote Bag', 'Ceramic Mug'];
  // const channels = ['Pickup'];
  const channels = ['Online'];
  const states: Array<Array<[boolean, boolean]>> = [
    [[true, true]],
    [[true, false]],
    [[false, false]],
  ];
  return (
    <div style={{ borderRadius: 2, border: '1px solid #E6DFD3', overflow: 'hidden', fontSize: 8 }}>
      {/* original grid: gridTemplateColumns: '70px repeat(3, 1fr)' (3 channels) */}
      <div style={{ display: 'grid', gridTemplateColumns: '70px repeat(1, 1fr)', background: '#FFFFFF' }}>
        <div style={{ padding: '5px 6px', fontWeight: 600, color: T2 }}>Item</div>
        {channels.map((ch) => (
          <div key={ch} style={{ padding: '5px 4px', textAlign: 'center', fontWeight: 600, color: T3 }}>{ch}</div>
        ))}
      </div>
      {items.map((item, i) => (
        <div key={item} style={{ display: 'grid', gridTemplateColumns: '70px repeat(1, 1fr)', borderTop: '1px solid #F4F0E8' }}>
          <div style={{ padding: '5px 6px', fontWeight: 500, color: T1, fontSize: 8 }}>{item}</div>
          {states[i].map(([vis, avail], j) => (
            <div key={j} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '5px 4px' }}>
              {vis ? (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: avail ? TEAL : ORANGE }} />
              ) : (
                <span className="material-symbols-rounded" style={{ fontSize: 11, color: T3, opacity: 0.4 }}>visibility_off</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ─── Slide 5: Where to Start ─── */
function SlideFiveIllustration() {
  const steps = [
    { num: 1, icon: 'schedule', label: 'Sessions', desc: 'Set trading hours', color: PURPLE },
    { num: 2, icon: 'countertops', label: 'Kitchen Stations', desc: 'Define prep areas', color: TEAL },
    // { num: 3, icon: 'category', label: 'Categories', desc: 'Organise menu sections', color: ACCENT },
    { num: 3, icon: 'category', label: 'Categories', desc: 'Organise store sections', color: ACCENT },
    { num: 4, icon: 'tune', label: 'Modifiers', desc: 'Set up customisation', color: ORANGE },
    { num: 5, icon: 'inventory_2', label: 'Items', desc: 'Add your products', color: ACCENT },
    // { num: 6, icon: 'rocket_launch', label: 'Go Live', desc: 'Sync and serve', color: GREEN },
    { num: 6, icon: 'rocket_launch', label: 'Go Live', desc: 'Sync and sell', color: GREEN },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {steps.map((s) => (
        <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
            background: `${s.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: s.color,
          }}>{s.num}</span>
          <span className="material-symbols-rounded" style={{ fontSize: 14, color: s.color }}>{s.icon}</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 9, fontWeight: 600, color: T1 }}>{s.label}</span>
            <span style={{ fontSize: 8, color: T3, marginLeft: 4 }}>{s.desc}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Slides config ─── */
const OVERVIEW_SLIDES: TutorialSlide[] = [
  {
    illustration: <SlideOneIllustration />,
    headline: "Your Digital Menu, One Place",
    // body: "Everything your customers see on every channel — POS, kiosks, delivery apps, online ordering — is built and managed from this single section. Build once, serve everywhere.",
    // body: "Everything your shoppers see on your e-commerce site — and available for Pickup — is built and managed from this single section. Build once, sell everywhere.",
    body: "Everything your shoppers see on your e-commerce site — on the Online channel — is built and managed from this single section. Build once, sell everywhere.",
  },
  {
    illustration: <SlideTwoIllustration />,
    headline: "The Building Blocks",
    body: "Four foundational entities power your catalog: Sessions (when), Categories (where), Kitchen Stations (routing), and Modifiers (customisation). Set these up first, then add your items.",
  },
  {
    illustration: <SlideThreeIllustration />,
    headline: "Items — The Heart of Everything",
    body: "Every item connects to categories, sessions, kitchen stations, and modifiers. Name it, price it, categorise it, assign it — and it appears everywhere.",
  },
  {
    illustration: <SlideFourIllustration />,
    headline: "Control Centre — See Everything",
    // body: "The Control Centre shows what's visible and available on every channel in a single matrix. A dot means the item is visible — teal for available, amber for OOS (Out of Stock). A crossed-out eye means hidden.",
    // body: "The Control Centre shows what's visible and available for Pickup in a single matrix. A dot means the item is visible — teal for available, amber for OOS (Out of Stock). A crossed-out eye means hidden.",
    body: "The Control Centre shows what's visible and available for Online in a single matrix. A dot means the item is visible — teal for available, amber for OOS (Out of Stock). A crossed-out eye means hidden.",
  },
  {
    illustration: <SlideFiveIllustration />,
    headline: "Where to Start",
    body: "Follow this order: Sessions → Kitchen Stations → Categories → Modifiers → Items → Go Live. Start with Sessions and work your way down.",
  },
];

/* ─── Exported component ─── */
interface ProductCatalogOverviewTutorialProps {
  open: boolean;
  onClose: () => void;
  onStartWizard?: () => void;
}

export default function ProductCatalogOverviewTutorial({ open, onClose, onStartWizard }: ProductCatalogOverviewTutorialProps) {
  return <TutorialSlideshow open={open} onClose={onClose} slides={OVERVIEW_SLIDES} />;
}
