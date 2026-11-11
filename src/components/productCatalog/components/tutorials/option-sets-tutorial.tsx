import React from "react";
import { Edit, Layers, CheckCircle, Package, ToggleRight } from "lucide-react";
import TutorialSlideshow, { type TutorialSlide } from "./tutorial-slideshow";

/* ─── Slide 1: Variations vs. Modifiers ─── */
function SlideOneIllustration() {
  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        {/* Left: Variations */}
        <div style={{ flex: 1, borderRadius: 2, overflow: "hidden", border: "1px solid #ECE5D8" }}>
          <div style={{ height: 3, background: "#7D8F69" }} />
          <div style={{ padding: "10px 10px 8px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#7D8F69", marginBottom: 6 }}>Variations</div>
            <div style={{ textAlign: "center", fontSize: 18, marginBottom: 6 }}>☕</div>
            {[
              { name: "Small", price: "$3.99" },
              { name: "Medium", price: "$4.99" },
              { name: "Large", price: "$5.99" },
            ].map((v) => (
              <div key={v.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#453F39", padding: "2px 0" }}>
                <span>{v.name}</span>
                <span style={{ fontWeight: 600 }}>{v.price}</span>
              </div>
            ))}
            <div style={{ fontSize: 8, color: "#9A9084", marginTop: 6, lineHeight: 1.3 }}>Choose one before ordering. Each has its own price.</div>
          </div>
        </div>

        {/* Plus */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ fontSize: 16, color: "#D6CCBB", fontWeight: 700 }}>+</span>
        </div>

        {/* Right: Modifiers */}
        <div style={{ flex: 1, borderRadius: 2, overflow: "hidden", border: "1px solid #ECE5D8" }}>
          <div style={{ height: 3, background: "#7F9770" }} />
          <div style={{ padding: "10px 10px 8px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#7F9770", marginBottom: 6 }}>Modifiers</div>
            <div style={{ textAlign: "center", fontSize: 18, marginBottom: 6 }}>☕</div>
            {[
              { name: "Oat Milk", price: "+$0.50" },
              { name: "Vanilla Shot", price: "+$0.75" },
              { name: "Extra Hot", price: "free" },
            ].map((m) => (
              <div key={m.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#453F39", padding: "2px 0" }}>
                <span>{m.name}</span>
                <span style={{ fontWeight: 600, color: "#7F9770" }}>{m.price}</span>
              </div>
            ))}
            <div style={{ fontSize: 8, color: "#9A9084", marginTop: 6, lineHeight: 1.3 }}>Add-ons chosen during ordering. Stack as many as you want.</div>
          </div>
        </div>
      </div>

      {/* Ordering flow */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 }}>
        {[
          { step: "1", label: "Pick size", color: "#7D8F69" },
          { step: "2", label: "Add extras", color: "#7F9770" },
          { step: "3", label: "Add to cart", color: "#B89550" },
        ].map((s, i) => (
          <React.Fragment key={s.step}>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: s.color, color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{s.step}</span>
              <span style={{ fontSize: 8, color: "#6E665D", fontWeight: 500 }}>{s.label}</span>
            </div>
            {i < 2 && <span style={{ fontSize: 10, color: "#D6CCBB" }}>→</span>}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ─── Slide 2: What is an Variation Set? ─── */
function SlideTwoIllustration() {
  const items = ["Latte", "Smoothie", "Fresh Juice"];

  return (
    <div>
      {/* Option set card */}
      <div style={{ background: "#fff", borderRadius: 2, border: "1.5px solid #3B82F660", padding: "10px 14px", textAlign: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#7D8F69", marginBottom: 6 }}>Sizes</div>
        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
          {["Small", "Medium", "Large"].map((s) => (
            <span key={s} style={{ fontSize: 9, fontWeight: 600, color: "#453F39", background: "#F4F0E8", padding: "3px 8px", borderRadius: 4 }}>{s}</span>
          ))}
        </div>
      </div>

      {/* Arrows down to items */}
      <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 4 }}>
        {items.map(() => (
          <div key={Math.random()} style={{ width: 1, height: 16, borderLeft: "2px dashed #D6CCBB" }} />
        ))}
      </div>

      {/* Item cards */}
      <div style={{ display: "flex", gap: 8 }}>
        {items.map((item) => (
          <div key={item} style={{ flex: 1, background: "#fff", borderRadius: 2, border: "1px solid #ECE5D8", padding: "8px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#453F39", marginBottom: 4 }}>{item}</div>
            <div style={{ fontSize: 8, color: "#9A9084" }}>S: $_.__ M: $_.__ L: $_.__</div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: 8, fontSize: 9, color: "#6E665D", fontWeight: 500 }}>
        One set → many items. Prices are set per item.
      </div>
    </div>
  );
}

/* ─── Slide 3: Cross-Product Magic ─── */
function SlideThreeIllustration() {
  const sizes = ["Small", "Medium", "Large"];
  const milks = ["Regular", "Oat", "Almond"];

  return (
    <div>
      {/* Two option sets with × */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ background: "#3B82F610", borderRadius: 2, padding: "6px 10px", border: "1px solid #3B82F630" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#7D8F69", marginBottom: 3 }}>Sizes</div>
          <div style={{ display: "flex", gap: 3 }}>
            {sizes.map((s) => <span key={s} style={{ fontSize: 8, color: "#453F39", background: "#fff", padding: "2px 5px", borderRadius: 3 }}>{s}</span>)}
          </div>
        </div>
        <span style={{ fontSize: 16, fontWeight: 700, color: "#B89550" }}>×</span>
        <div style={{ background: "#10B98110", borderRadius: 2, padding: "6px 10px", border: "1px solid #10B98130" }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: "#7F9770", marginBottom: 3 }}>Milk Type</div>
          <div style={{ display: "flex", gap: 3 }}>
            {milks.map((m) => <span key={m} style={{ fontSize: 8, color: "#453F39", background: "#fff", padding: "2px 5px", borderRadius: 3 }}>{m}</span>)}
          </div>
        </div>
      </div>

      {/* Arrow */}
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: "#D6CCBB" }}>↓</span>
      </div>

      {/* 3×3 Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
        {sizes.flatMap((size) =>
          milks.map((milk) => {
            const isExcluded = size === "Small" && milk === "Almond";
            return (
              <div
                key={`${size}-${milk}`}
                style={{
                  fontSize: 8, fontWeight: 500, textAlign: "center",
                  padding: "4px 2px", borderRadius: 4,
                  background: isExcluded ? "#F6E9E5" : "#FFFFFF",
                  color: isExcluded ? "#B89550" : "#453F39",
                  textDecoration: isExcluded ? "line-through" : "none",
                  border: isExcluded ? "1px dashed #E6C3BA" : "1px solid transparent",
                }}
              >
                {size[0]}-{milk}
              </div>
            );
          })
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 8, fontSize: 9, color: "#6E665D", fontWeight: 500 }}>
        9 variations from 2 sets — uncheck what you don&apos;t offer.
      </div>
    </div>
  );
}

/* ─── Slide 4: Each Variation Has Its Own Price ─── */
function SlideFourIllustration() {
  const rows = [
    { name: "Small", price: "$3.99", code: "1042-01", on: true },
    { name: "Medium", price: "$4.99", code: "1042-02", on: true },
    { name: "Large", price: "$5.99", code: "1042-03", on: false },
  ];

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#453F39", marginBottom: 6 }}>Latte — Variations</div>
      <div style={{ background: "#fff", borderRadius: 2, border: "1px solid #ECE5D8", overflow: "hidden" }}>
        {rows.map((r, i) => (
          <div
            key={r.name}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "8px 10px",
              borderTop: i > 0 ? "1px solid #F4F0E8" : "none",
              opacity: r.on ? 1 : 0.5,
            }}
          >
            <div style={{ width: 8, cursor: "grab", color: "#D6CCBB", fontSize: 10 }}>⠿</div>
            <span style={{ flex: 1, fontSize: 10, fontWeight: 600, color: "#453F39" }}>{r.name}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#453F39", width: 40 }}>{r.price}</span>
            <span style={{ fontSize: 8, color: "#9A9084", width: 50 }}>{r.code}</span>
            <div style={{ width: 28, height: 14, borderRadius: 7, background: r.on ? "#7F9770" : "#B89550", position: "relative" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: r.on ? 16 : 2, transition: "left 200ms" }} />
            </div>
            {!r.on && <span style={{ fontSize: 8, color: "#B89550", fontWeight: 600 }}>Unavailable</span>}
          </div>
        ))}
      </div>
      {/* Note */}
      <div style={{ marginTop: 8, padding: "6px 10px", background: "#FFFFFF", borderRadius: 2 }}>
        <span style={{ fontSize: 8, color: "#6E665D" }}>On the Items page, you&apos;ll see the price as a range: </span>
        <span style={{ fontSize: 8, color: "#453F39", fontWeight: 700 }}>$3.99 – $5.99</span>
      </div>
    </div>
  );
}

/* ─── Slide 5: Getting Started ─── */
function SlideFiveIllustration() {
  return (
    <div>
      <div style={{ display: "flex", gap: 10 }}>
        {/* Manual path */}
        <div style={{ flex: 1, background: "#fff", borderRadius: 2, border: "1px solid #ECE5D8", padding: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
            <Edit className="w-3.5 h-3.5" style={{ color: "#7D8F69" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#7D8F69" }}>Manual</span>
          </div>
          {["Edit item, toggle Variations ON", "Add names and prices", "Save"].map((step, i) => (
            <div key={step} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: "#7D8F69", color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 9, color: "#453F39" }}>{step}</span>
            </div>
          ))}
        </div>

        {/* Variation Set path */}
        <div style={{ flex: 1, background: "#fff", borderRadius: 2, border: "1px solid #ECE5D8", padding: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
            <Layers className="w-3.5 h-3.5" style={{ color: "#7F9770" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#7F9770" }}>Variation Set</span>
          </div>
          {["Create set — e.g., 'Sizes'", "Apply to any item", "Set prices per item and save"].map((step, i) => (
            <div key={step} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 0" }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: "#7F9770", color: "#fff", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 9, color: "#453F39" }}>{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tip box */}
      <div style={{ marginTop: 10, padding: "8px 12px", background: "#EDF3EB", borderRadius: 2, border: "1px solid #CFDCC6" }}>
        <span style={{ fontSize: 9, color: "#7D8F69", fontWeight: 600 }}>Tip: </span>
        <span style={{ fontSize: 9, color: "#4F6144" }}>
          If you have 5+ items with the same sizes, create an option set — it&apos;ll save you minutes.
        </span>
      </div>
    </div>
  );
}

/* ─── Slide definitions ─── */
const VARIATION_SET_SLIDES: TutorialSlide[] = [
  {
    headline: "Variations vs. Modifiers",
    body: "Variations are fixed forms of an item — Small, Medium, Large. Each has its own price. Modifiers are add-ons chosen during ordering — Extra Cheese, No Onions. Use both together.",
    illustration: <SlideOneIllustration />,
  },
  {
    headline: "What is a Variation Set?",
    body: "A variation set is a reusable template — create 'Sizes' once with Small, Medium, Large, then apply it to every coffee, smoothie, and juice in your menu. No re-typing.",
    illustration: <SlideTwoIllustration />,
  },
  {
    headline: "Combine Sets Automatically",
    body: "Apply two variation sets to one item and the system generates all combinations. Sizes × Milk Types = 9 variations created in one click. Uncheck any you don't need.",
    illustration: <SlideThreeIllustration />,
  },
  {
    headline: "Price Each Variation Independently",
    body: "Every variation gets its own price, item code, and availability toggle. A Large costs more than a Small. Turn off a variation without removing it — it reappears when you're ready.",
    illustration: <SlideFourIllustration />,
  },
  {
    headline: "Getting Started",
    body: "Two ways to create variations: manually add them on any item, or create a reusable variation set and apply it across your menu.",
    illustration: <SlideFiveIllustration />,
  },
];

/* ─── VariationSetsTutorial wrapper ─── */
interface VariationSetsTutorialProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function VariationSetsTutorial(props: VariationSetsTutorialProps) {
  return <TutorialSlideshow {...props} slides={VARIATION_SET_SLIDES} />;
}
