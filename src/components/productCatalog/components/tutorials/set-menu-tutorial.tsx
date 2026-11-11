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

/* ─── Slide 1: What is a Set Menu? ─── */
function SlideOneIllustration() {
  const courses = [
    { label: 'Starter', items: ['Soup', 'Bruschetta', 'Prawn Cocktail'], color: ORANGE },
    { label: 'Main Course', items: ['Roast Beef', 'Salmon', 'Chicken', 'Veggie Wellington'], color: ACCENT },
    { label: 'Dessert', items: ['Sticky Toffee', 'Cheesecake', 'Sorbet'], color: PURPLE },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div style={{ padding: '6px 14px', borderRadius: 2, background: `${ACCENT}10`, border: `1px solid ${ACCENT}20`, textAlign: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>Sunday Roast — 3 Courses</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T1 }}>$35.00</div>
      </div>
      {courses.map((c, i) => (
        <React.Fragment key={c.label}>
          {i > 0 && <span className="material-symbols-rounded" style={{ fontSize: 14, color: T3 }}>arrow_downward</span>}
          <div style={{ width: '100%', padding: '6px 10px', borderRadius: 2, background: `${c.color}06`, border: `1px solid ${c.color}15` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: c.color, textTransform: 'uppercase' }}>{c.label}</span>
              <span style={{ fontSize: 8, color: T3 }}>Pick 1</span>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {c.items.map((it) => (
                <span key={it} style={{ fontSize: 8, padding: '2px 6px', borderRadius: 4, background: '#fff', border: `1px solid ${c.color}15`, color: T2 }}>{it}</span>
              ))}
            </div>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

/* ─── Slide 2: Courses — Not Slots ─── */
function SlideTwoIllustration() {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {/* Combo side */}
      <div style={{ flex: 1, padding: '8px 10px', borderRadius: 2, background: `${ACCENT}04`, border: `1px solid ${ACCENT}15` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: ACCENT, marginBottom: 8, textAlign: 'center' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 16, display: 'block', marginBottom: 2 }}>fastfood</span>
          Combo
        </div>
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 6 }}>
          {['Burger', 'Side', 'Drink'].map((s) => (
            <span key={s} style={{ fontSize: 8, padding: '3px 6px', borderRadius: 4, background: `${ACCENT}10`, color: ACCENT, fontWeight: 600 }}>{s}</span>
          ))}
        </div>
        <div style={{ fontSize: 8, color: T3, textAlign: 'center', fontStyle: 'italic' }}>Pick all at once</div>
      </div>
      {/* Set Menu side */}
      <div style={{ flex: 1, padding: '8px 10px', borderRadius: 2, background: `${PURPLE}04`, border: `1px solid ${PURPLE}15` }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: PURPLE, marginBottom: 8, textAlign: 'center' }}>
          <span className="material-symbols-rounded" style={{ fontSize: 16, display: 'block', marginBottom: 2 }}>restaurant</span>
          Set Menu
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginBottom: 6 }}>
          {['Starter', 'Main', 'Dessert'].map((c, i) => (
            <React.Fragment key={c}>
              {i > 0 && <span className="material-symbols-rounded" style={{ fontSize: 10, color: T3 }}>arrow_downward</span>}
              <span style={{ fontSize: 8, padding: '3px 6px', borderRadius: 4, background: `${PURPLE}10`, color: PURPLE, fontWeight: 600 }}>{c}</span>
            </React.Fragment>
          ))}
        </div>
        <div style={{ fontSize: 8, color: T3, textAlign: 'center', fontStyle: 'italic' }}>One course at a time</div>
      </div>
    </div>
  );
}

/* ─── Slide 3: Supplements ─── */
function SlideThreeIllustration() {
  const items = [
    { name: 'Roast Beef', supp: 'Included', color: GREEN },
    { name: 'Chicken', supp: 'Included', color: GREEN },
    { name: 'Salmon', supp: '+$3.00', color: ORANGE },
    { name: 'Veggie Wellington', supp: '−$2.00', color: TEAL },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: T2, textTransform: 'uppercase', textAlign: 'center' }}>Main Course</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((it) => (
          <div key={it.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 10px', borderRadius: 2, background: '#fff', border: '1px solid #F4F0E8' }}>
            <span style={{ fontSize: 10, fontWeight: 500, color: T1 }}>{it.name}</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: it.color }}>{it.supp}</span>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '6px 10px', borderRadius: 2, background: `${ACCENT}06`, border: `1px solid ${ACCENT}15` }}>
        <span style={{ fontSize: 9, color: T2 }}>Base: $35.00</span>
        <span style={{ fontSize: 9, color: ORANGE }}>+ $3.00</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: ACCENT }}>= $38.00</span>
      </div>
    </div>
  );
}

/* ─── Slide 4: Course Modifiers ─── */
function SlideFourIllustration() {
  const steps = [
    { num: 1, label: 'Select item', desc: 'Roast Beef', color: ACCENT, icon: 'touch_app' },
    { num: 2, label: 'Item modifiers', desc: 'Cooking Level: Medium', color: ORANGE, icon: 'tune' },
    { num: 3, label: 'Course modifiers', desc: 'Wine Pairing: Malbec +$8', color: PURPLE, icon: 'wine_bar' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {steps.map((s) => (
        <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 2, background: `${s.color}06`, border: `1px solid ${s.color}15` }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: `${s.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: s.color, flexShrink: 0 }}>{s.num}</span>
          <span className="material-symbols-rounded" style={{ fontSize: 14, color: s.color }}>{s.icon}</span>
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, color: s.color }}>{s.label}</div>
            <div style={{ fontSize: 8, color: T2 }}>{s.desc}</div>
          </div>
        </div>
      ))}
      <div style={{ textAlign: 'center', padding: '4px 8px', borderRadius: 2, background: '#FFFFFF' }}>
        <span style={{ fontSize: 8, color: T3 }}>Item modifiers follow the item. Course modifiers follow the course.</span>
      </div>
    </div>
  );
}

/* ─── Slide 5: Getting Started ─── */
function SlideFiveIllustration() {
  const steps = [
    { icon: 'edit', label: 'Name it and set the price' },
    { icon: 'format_list_numbered', label: 'Add courses (2–10)' },
    { icon: 'checklist', label: 'Pick items per course' },
    { icon: 'payments', label: 'Set supplements' },
    { icon: 'wine_bar', label: 'Add course modifiers (optional)' },
    { icon: 'publish', label: 'Publish' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderRadius: 2, background: i === 0 ? `${ACCENT}06` : '#FDFCF9', border: `1px solid ${i === 0 ? `${ACCENT}15` : '#F4F0E8'}` }}>
          <span style={{ width: 18, height: 18, borderRadius: '50%', background: `${ACCENT}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span className="material-symbols-rounded" style={{ fontSize: 11, color: ACCENT }}>{s.icon}</span>
          </span>
          <span style={{ fontSize: 9, color: T1, fontWeight: 500 }}>{s.label}</span>
        </div>
      ))}
      <p style={{ fontSize: 8, color: ACCENT, margin: '4px 0 0', textAlign: 'center', fontWeight: 600 }}>
        Start with a classic 3-course dinner. You can always add more courses later.
      </p>
    </div>
  );
}

/* ─── Slides config ─── */
const SET_MENU_SLIDES: TutorialSlide[] = [
  {
    illustration: <SlideOneIllustration />,
    headline: "What is a Set Menu?",
    body: "A structured multi-course dining experience at a fixed price. Customers choose their journey through the meal — one course at a time.",
  },
  {
    illustration: <SlideTwoIllustration />,
    headline: "Courses — Not Slots",
    body: "Combos are for speed — quick bundles picked all at once. Set Menus are for experience — guided course-by-course dining. Choose the right one for your restaurant.",
  },
  {
    illustration: <SlideThreeIllustration />,
    headline: "Supplements — Premium Upgrades",
    body: "Most items are included in the set price. Premium choices add a supplement (+$3 for salmon). Simpler options can even discount (−$2 for veggie). Supplements can go both ways.",
  },
  {
    illustration: <SlideFourIllustration />,
    headline: "Course Modifiers — Pair the Experience",
    body: "Item modifiers (like cooking level) follow the item. Course modifiers (like wine pairing) follow the course — they appear for any item the guest picks in that course.",
  },
  {
    illustration: <SlideFiveIllustration />,
    headline: "Getting Started",
    body: "Name it, set the price, add courses, pick items, set supplements, add course modifiers, and publish. Start with your most popular prix fixe — a classic 3-course dinner.",
  },
];

/* ─── Exported component ─── */
interface SetMenuTutorialProps {
  open: boolean;
  onClose: () => void;
}

export default function SetMenuTutorial(props: SetMenuTutorialProps) {
  return <TutorialSlideshow {...props} slides={SET_MENU_SLIDES} />;
}
