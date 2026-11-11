import React from "react";
import { ShoppingBag, Layers, Filter, TrendingUp, Zap } from "lucide-react";
import TutorialSlideshow, { type TutorialSlide } from "./tutorial-slideshow";

/* ─── Slide 1: What is a Combo? ─── */
function SlideOneIllustration() {
  const items = [
    { name: "Burger", price: "$8.99", color: "#B89550" },
    { name: "Fries", price: "$3.99", color: "#B07A2A" },
    { name: "Drink", price: "$2.99", color: "#7D8F69" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
        {items.map((it) => (
          <div key={it.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderRadius: 2, background: `${it.color}10`, border: `1px solid ${it.color}30` }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: it.color }}>{it.name}</span>
            <span style={{ fontSize: 11, color: "#6E665D" }}>{it.price}</span>
          </div>
        ))}
        <div style={{ fontSize: 10, color: "#9A9084", textAlign: "center" }}>Total: $15.97</div>
      </div>
      <div style={{ fontSize: 18, color: "#9A9084" }}>→</div>
      <div style={{ flex: 1, padding: 12, borderRadius: 2, background: "#16A34A10", border: "1.5px solid #16A34A40", textAlign: "center" }}>
        <ShoppingBag className="w-5 h-5" style={{ color: "#5F7A55", margin: "0 auto 4px" }} />
        <div style={{ fontSize: 13, fontWeight: 700, color: "#5F7A55" }}>Happy Meal</div>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#453F39" }}>$9.99</div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#5F7A55", marginTop: 2 }}>Save $5.98</div>
      </div>
    </div>
  );
}

/* ─── Slide 2: Slots = Choices ─── */
function SlideTwoIllustration() {
  const slots = [
    { name: "Burger", count: 3, color: "#B89550" },
    { name: "Side", count: 2, color: "#B07A2A" },
    { name: "Drink", count: 5, color: "#7D8F69" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {slots.map((s) => (
        <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 80, padding: "6px 10px", borderRadius: 2, background: `${s.color}10`, border: `1px solid ${s.color}30`, fontSize: 11, fontWeight: 600, color: s.color, textAlign: "center" }}>{s.name}</div>
          <div style={{ display: "flex", gap: 4, flex: 1 }}>
            {Array.from({ length: s.count }).map((_, i) => (
              <div key={i} style={{ flex: 1, height: 24, borderRadius: 4, background: i === 0 ? `${s.color}25` : "#F4F0E8", border: `1px solid ${i === 0 ? `${s.color}50` : "#E6DFD3"}` }} />
            ))}
          </div>
          <Layers className="w-3 h-3" style={{ color: "#9A9084" }} />
        </div>
      ))}
    </div>
  );
}

/* ─── Slide 3: Subset, Not Everything ─── */
function SlideThreeIllustration() {
  const all = Array.from({ length: 12 }, (_, i) => i);
  const selected = [1, 4, 7, 9, 11];
  return (
    <div>
      <div style={{ fontSize: 9, color: "#9A9084", fontWeight: 600, textTransform: "uppercase", marginBottom: 6 }}>
        <Filter className="w-3 h-3" style={{ display: "inline", verticalAlign: "middle", marginRight: 3 }} />
        Drinks Category (12 items)
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
        {all.map((i) => {
          const isSel = selected.includes(i);
          return <div key={i} style={{ height: 22, borderRadius: 4, background: isSel ? "#E5233320" : "#F4F0E8", border: `1.5px solid ${isSel ? "#B89550" : "#E6DFD3"}` }} />;
        })}
      </div>
      <div style={{ fontSize: 9, color: "#6E665D", textAlign: "center", marginTop: 6, fontStyle: "italic" }}>5 of 12 curated for this combo slot</div>
    </div>
  );
}

/* ─── Slide 4: Premium Upgrades ─── */
function SlideFourIllustration() {
  const drinks = [
    { name: "Coke", badge: "Included", color: "#5F7A55" },
    { name: "Sprite", badge: "Included", color: "#5F7A55" },
    { name: "OJ", badge: "+$1.00", color: "#B07A2A" },
    { name: "Lemonade", badge: "+$1.50", color: "#B89550" },
  ];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
        {drinks.map((d) => (
          <div key={d.name} style={{ padding: "8px 10px", borderRadius: 2, background: "#fff", border: "1px solid #E6DFD3", textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#453F39" }}>{d.name}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: d.color, marginTop: 2 }}>{d.badge}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 2, background: "#FFFFFF", display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <span style={{ color: "#6E665D" }}>Base: $9.99</span>
        <span style={{ color: "#B07A2A", fontWeight: 600 }}>+ $1.00</span>
        <span style={{ fontWeight: 700, color: "#453F39" }}>= $10.99</span>
      </div>
    </div>
  );
}

/* ─── Slide 5: Getting Started ─── */
function SlideFiveIllustration() {
  const steps = [
    { num: 1, label: "Name it", icon: "✏️" },
    { num: 2, label: "Set price", icon: "💰" },
    { num: 3, label: "Add slots", icon: "📦" },
    { num: 4, label: "Pick items", icon: "🍔" },
    { num: 5, label: "Publish", icon: "🚀" },
  ];
  return (
    <div>
      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        {steps.map((s) => (
          <div key={s.num} style={{ textAlign: "center", flex: 1 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#E5233310", border: "1.5px solid #E5233340", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 4px", fontSize: 14 }}>{s.icon}</div>
            <div style={{ fontSize: 9, fontWeight: 600, color: "#6E665D" }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 2, background: "#F7EFDF", border: "1px solid #E9D8B5", display: "flex", alignItems: "center", gap: 6 }}>
        <TrendingUp className="w-3.5 h-3.5" style={{ color: "#B07A2A", flexShrink: 0 }} />
        <span style={{ fontSize: 10, color: "#8A6D33" }}>Tip: Start with your best seller — 80% of combos are built around one hero item.</span>
      </div>
    </div>
  );
}

/* ─── Slides ─── */
const COMBO_SLIDES: TutorialSlide[] = [
  { headline: "What is a Combo?", body: "Bundle items at a single discounted price. Customers get a great deal, you boost average order value. Everyone wins.", illustration: <SlideOneIllustration /> },
  { headline: "Slots = Choices", body: "Each slot gives the customer options. A burger slot, a side slot, a drink slot — they pick one from each. You control exactly which items appear.", illustration: <SlideTwoIllustration /> },
  { headline: "Subset, Not Everything", body: "Pick exactly which items go in each slot — not your whole menu. Curate the choices to drive the right mix of items.", illustration: <SlideThreeIllustration /> },
  { headline: "Premium Upgrades", body: "Some items are included in the base price, others add a supplement. Orange Juice +$1.00, Fresh Lemonade +$1.50. Dynamic pricing keeps it flexible.", illustration: <SlideFourIllustration /> },
  { headline: "Getting Started", body: "Name it, set a price, add component slots, pick eligible items, and publish. Start with your best-selling combo and expand from there.", illustration: <SlideFiveIllustration /> },
];

/* ─── ComboTutorial wrapper ─── */
interface ComboTutorialProps { open: boolean; onClose: () => void; onComplete?: () => void; }
export default function ComboTutorial(props: ComboTutorialProps) {
  return <TutorialSlideshow {...props} slides={COMBO_SLIDES} />;
}
