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

/* ─── Slide 1: What is Control Centre ─── */
function SlideOneIllustration() {
  const channels = [
    // { icon: 'restaurant', label: 'Dine-in', color: ACCENT },
    // { icon: 'takeout_dining', label: 'Takeout', color: PURPLE },
    // { icon: 'delivery_dining', label: 'Delivery', color: TEAL },
    // { icon: 'language', label: 'Online', color: GREEN },
    // { icon: 'takeout_dining', label: 'Pickup', color: ACCENT },
    { icon: 'takeout_dining', label: 'Online', color: ACCENT },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 56, height: 56, borderRadius: 2, background: `${ACCENT}10`, border: `2px solid ${ACCENT}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="material-symbols-rounded" style={{ fontSize: 28, color: ACCENT }}>tune</span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: T1, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Control Centre</div>
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

/* ─── Slide 2: Reading the Matrix ─── */
function SlideTwoIllustration() {
  // const items = ['Chicken Tikka', 'Butter Naan', 'Mango Lassi'];
  // const channels = ['Dine-in', 'Delivery', 'Online'];
  // const states: Array<Array<[boolean, boolean]>> = [
  //   [[true, true], [true, true], [true, false]],
  //   [[true, true], [false, false], [true, true]],
  //   [[true, false], [true, false], [false, false]],
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
    <div style={{ borderRadius: 2, border: '1px solid #E6DFD3', overflow: 'hidden', fontSize: 9 }}>
      {/* original grid: gridTemplateColumns: '90px repeat(3, 1fr)' */}
      <div style={{ display: 'grid', gridTemplateColumns: '90px repeat(1, 1fr)', background: '#FFFFFF' }}>
        <div style={{ padding: '6px 8px', fontWeight: 600, color: T2 }}>{/* was: Item */}Product</div>
        {channels.map((ch) => (
          <div key={ch} style={{ padding: '6px 4px', textAlign: 'center', fontWeight: 600, color: T3 }}>{ch}</div>
        ))}
      </div>
      {items.map((item, i) => (
        <div key={item} style={{ display: 'grid', gridTemplateColumns: '90px repeat(1, 1fr)', borderTop: '1px solid #F4F0E8' }}>
          <div style={{ padding: '6px 8px', fontWeight: 500, color: T1 }}>{item}</div>
          {states[i].map(([vis, avail], j) => (
            <div key={j} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 4px' }}>
              {vis ? (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: avail ? TEAL : ORANGE }} />
              ) : (
                <span className="material-symbols-rounded" style={{ fontSize: 12, color: T3, opacity: 0.4 }}>visibility_off</span>
              )}
            </div>
          ))}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', padding: '6px 8px', background: '#FDFCF9', borderTop: '1px solid #F4F0E8' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: TEAL, display: 'inline-block' }} />
          <span style={{ fontSize: 8, color: T2 }}>Available</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: ORANGE, display: 'inline-block' }} />
          <span style={{ fontSize: 8, color: T2 }}>OOS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span className="material-symbols-rounded" style={{ fontSize: 10, color: T3, opacity: 0.4 }}>visibility_off</span>
          <span style={{ fontSize: 8, color: T2 }}>Hidden</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Slide 3: Manage in One Click ─── */
function SlideThreeIllustration() {
  return (
    <div style={{ borderRadius: 2, border: '1px solid #E6DFD3', background: '#fff', padding: 14, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div>
          {/* <div style={{ fontSize: 11, fontWeight: 700, color: T1 }}>Chicken Tikka</div>
          <div style={{ fontSize: 9, color: T3 }}>Delivery</div> */}
          <div style={{ fontSize: 11, fontWeight: 700, color: T1 }}>Classic T-Shirt</div>
          {/* <div style={{ fontSize: 9, color: T3 }}>Pickup</div> */}
          <div style={{ fontSize: 9, color: T3 }}>Online</div>
        </div>
        <span className="material-symbols-rounded" style={{ fontSize: 14, color: T3 }}>close</span>
      </div>
      {/* Availability row */}
      <div style={{ padding: '8px 10px', borderRadius: 2, background: `${TEAL}06`, border: `1px solid ${TEAL}15`, marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: TEAL, textTransform: 'uppercase', marginBottom: 6 }}>Availability</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: TEAL, display: 'inline-block' }} />
            <span style={{ fontSize: 10, color: T1 }}>Available</span>
          </div>
          <span style={{ fontSize: 8, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: `${ORANGE}15`, color: ORANGE }}>Mark OOS</span>
        </div>
      </div>
      {/* Visibility row */}
      <div style={{ padding: '8px 10px', borderRadius: 2, background: `${PURPLE}06`, border: `1px solid ${PURPLE}15` }}>
        <div style={{ fontSize: 9, fontWeight: 600, color: PURPLE, textTransform: 'uppercase', marginBottom: 6 }}>Visibility</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 14, color: PURPLE }}>visibility</span>
            <span style={{ fontSize: 10, color: T1 }}>Visible</span>
          </div>
          <span style={{ fontSize: 8, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: `${PURPLE}15`, color: PURPLE }}>ON</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Slide 4: Filters & Tabs ─── */
function SlideFourIllustration() {
  const steps = [
    // { icon: 'tab', text: 'Switch between Items and Categories using the tabs at the top' },
    { icon: 'tab', text: 'Switch between Products and Categories using the tabs at the top' },
    // { icon: 'search', text: 'Search by name to quickly find an item or category' },
    { icon: 'search', text: 'Search by name to quickly find a product or category' },
    { icon: 'filter_alt', text: 'Use filters — Category, Session, Availability — to focus your view' },
    { icon: 'touch_app', text: 'Click any cell to open the panel and toggle OOS (Out of Stock) or visibility' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 2, background: i === 0 ? `${ACCENT}06` : '#FDFCF9', border: `1px solid ${i === 0 ? `${ACCENT}15` : '#F4F0E8'}` }}>
          <span style={{ width: 22, height: 22, borderRadius: '50%', background: `${ACCENT}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 13, color: ACCENT }}>{s.icon}</span>
          </span>
          <span style={{ fontSize: 10, color: T1, fontWeight: 500 }}>{s.text}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── Slides config ─── */
const CONTROL_CENTRE_SLIDES: TutorialSlide[] = [
  {
    illustration: <SlideOneIllustration />,
    headline: "Your Control Centre",
    // body: "Control Centre gives you a single matrix to see and manage what's visible and available across every channel — Dine-in, Takeout, Delivery, and Online.",
    // body: "Control Centre gives you a single matrix to see and manage what's visible and available for your e-commerce store's Pickup channel.",
    body: "Control Centre gives you a single matrix to see and manage what's visible and available for your e-commerce store's Online channel.",
  },
  {
    illustration: <SlideTwoIllustration />,
    headline: "Reading the Matrix",
    // body: "Each cell shows one indicator: a teal dot means the item is available, an amber dot means OOS (Out of Stock), and a crossed-out eye means the item is hidden on that channel.",
    // body: "Each cell shows one indicator: a teal dot means the item is available, an amber dot means OOS (Out of Stock), and a crossed-out eye means the product is hidden on Pickup.",
    // body: "Each cell shows one indicator: a teal dot means the item is available, an amber dot means OOS (Out of Stock), and a crossed-out eye means the product is hidden on Online.",
    body: "Each cell shows one indicator: a teal dot means the product is available, an amber dot means OOS (Out of Stock), and a crossed-out eye means the product is hidden on Online.",
  },
  {
    illustration: <SlideThreeIllustration />,
    headline: "Manage in One Click",
    // body: "Click any cell to open a panel where you can mark the item OOS (Out of Stock) or restore it, and toggle visibility on or off for that specific channel.",
    body: "Click any cell to open a panel where you can mark the product OOS (Out of Stock) or restore it, and toggle visibility on or off for that specific channel.",
  },
  {
    illustration: <SlideFourIllustration />,
    headline: "Find What You Need",
    // body: "Use the Items and Categories tabs to switch views. Search by name, or apply filters for Category, Session, and Availability to focus on exactly what you need.",
    body: "Use the Products and Categories tabs to switch views. Search by name, or apply filters for Category, Session, and Availability to focus on exactly what you need.",
  },
];

/* ─── Exported component ─── */
interface ControlCentreTutorialProps {
  open: boolean;
  onClose: () => void;
}

export default function ControlCentreTutorial(props: ControlCentreTutorialProps) {
  return <TutorialSlideshow {...props} slides={CONTROL_CENTRE_SLIDES} />;
}
