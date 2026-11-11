import React from "react";
import { ChevronRight } from "lucide-react";
import TutorialSlideshow, { type TutorialSlide } from "./tutorial-slideshow";

/* ─── Slide 1: What is a Modifier? ─── */

function Slide1Illustration() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Item card */}
      <div
        style={{
          background: "#fff",
          borderRadius: 2,
          border: "1px solid #ECE5D8",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <span style={{ fontSize: 22 }}>🍔</span>
        <div style={{ flex: 1 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#453F39" }}>Classic Burger</span>
          <div style={{ fontSize: 10, color: "#6E665D" }}>$12.99</div>
        </div>
      </div>
      {/* Arrow */}
      <div style={{ textAlign: "center", fontSize: 9, color: "#B89550", fontWeight: 700 }}>
        ▼ CUSTOMIZE
      </div>
      {/* Modifier options */}
      <div
        style={{
          background: "#fff",
          borderRadius: 2,
          border: "1px solid #ECE5D8",
          padding: 10,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: "#B89550", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Choose your Cheese
        </div>
        {["Cheddar", "Swiss", "Mozzarella"].map((opt, i) => (
          <div
            key={opt}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 8px",
              borderRadius: 2,
              background: i === 0 ? "rgba(184,149,80,0.06)" : "transparent",
              marginBottom: 3,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                border: `1.5px solid ${i === 0 ? "#B89550" : "#D6CCBB"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i === 0 && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#B89550" }} />}
            </div>
            <span style={{ fontSize: 10, color: "#453F39", fontWeight: i === 0 ? 600 : 400 }}>{opt}</span>
            {i === 1 && <span style={{ fontSize: 9, color: "#6E665D", marginLeft: "auto" }}>+$1.00</span>}
          </div>
        ))}
      </div>
    </div>
  );
}


/* ─── Slide 3: Required vs Optional ─── */

function Slide3Illustration() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Required */}
      <div style={{ background: "#fff", borderRadius: 2, border: "1px solid #ECE5D8", padding: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#B89550", textTransform: "uppercase" }}>Required</span>
          <span style={{ fontSize: 8, color: "#B89550" }}>*</span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#453F39", marginBottom: 4 }}>Choose Size</div>
        <div style={{ fontSize: 9, color: "#6E665D" }}>Customer must select one option</div>
      </div>
      {/* Optional */}
      <div style={{ background: "#fff", borderRadius: 2, border: "1px solid #ECE5D8", padding: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#5F7A55", textTransform: "uppercase" }}>Optional</span>
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: "#453F39", marginBottom: 4 }}>Add Extra Toppings</div>
        <div style={{ fontSize: 9, color: "#6E665D" }}>Customer can skip or pick multiple</div>
      </div>
      {/* Multi-select hint */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
        <div style={{ width: 14, height: 1, background: "#B07A2A" }} />
        <span style={{ fontSize: 8, fontWeight: 600, color: "#B07A2A" }}>Multi-select: set min & max</span>
      </div>
    </div>
  );
}

/* ─── Slide 4: Channel Visibility ─── */

function Slide4Illustration() {
  const channels = [
    { label: "Dine In", icon: "🍽️", enabled: true },
    { label: "Takeout", icon: "🥡", enabled: true },
    { label: "Delivery", icon: "🚗", enabled: false },
    { label: "Online", icon: "💻", enabled: true },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#6E665D", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
        Show modifier on these channels
      </div>
      {channels.map((ch) => (
        <div
          key={ch.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#fff",
            borderRadius: 2,
            padding: "6px 10px",
            border: `1px solid ${ch.enabled ? "rgba(95,122,85,0.3)" : "#ECE5D8"}`,
          }}
        >
          <span style={{ fontSize: 14 }}>{ch.icon}</span>
          <span style={{ flex: 1, fontSize: 10, fontWeight: 500, color: "#453F39" }}>{ch.label}</span>
          <div
            style={{
              width: 28,
              height: 16,
              borderRadius: 2,
              background: ch.enabled ? "#5F7A55" : "#D6CCBB",
              position: "relative",
            }}
          >
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#fff",
                position: "absolute",
                top: 2,
                left: ch.enabled ? 14 : 2,
                boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Slide 5: Getting Started ─── */

function Slide5Illustration() {
  const steps = [
    { num: 1, text: "Click Add Modifier" },
    { num: 2, text: "Name it & add your options" },
    { num: 3, text: "Set required / optional & min-max" },
    { num: 4, text: "Apply to your items" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {steps.map((step) => (
        <div
          key={step.num}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#fff",
            borderRadius: 2,
            padding: "8px 12px",
            border: "1px solid #ECE5D8",
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "rgba(184,149,80,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 700,
              color: "#B89550",
              flexShrink: 0,
            }}
          >
            {step.num}
          </div>
          <span style={{ fontSize: 10, fontWeight: 500, color: "#453F39" }}>{step.text}</span>
          <ChevronRight className="w-3 h-3" style={{ color: "#9A9084", marginLeft: "auto" }} />
        </div>
      ))}
    </div>
  );
}

/* ─── Slide definitions ─── */

const MODIFIERS_SLIDES: TutorialSlide[] = [
  {
    headline: "What is a Modifier?",
    body: "A modifier lets customers customize their order \u2014 pick a size, add toppings, or choose extras. Each modifier set can be applied to one or many items.",
    illustration: <Slide1Illustration />,
  },
  {
    headline: "Required vs. Optional",
    body: "Mark a modifier as required to force a selection before checkout. Optional modifiers let customers skip. For multi-select, set min and max selection limits.",
    illustration: <Slide3Illustration />,
  },
  {
    headline: "Channel Visibility",
    body: "Control which order channels see each modifier. Show size options for dine-in but hide them for delivery, or enable special instructions only for online orders.",
    illustration: <Slide4Illustration />,
  },
  {
    headline: "Getting Started",
    body: "Create a modifier, add your options with optional price adjustments, then apply it to items from the item form. Changes sync to all assigned items instantly.",
    illustration: <Slide5Illustration />,
  },
];

/* ─── ModifiersTutorial wrapper ─── */

interface ModifiersTutorialProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function ModifiersTutorial(props: ModifiersTutorialProps) {
  return <TutorialSlideshow {...props} slides={MODIFIERS_SLIDES} />;
}
