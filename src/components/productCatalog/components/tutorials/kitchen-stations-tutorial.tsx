import React from "react";
import { Plus, Package, CheckCircle } from "lucide-react";
import TutorialSlideshow, { type TutorialSlide } from "./tutorial-slideshow";

/* ─── Slide 1: What is a Kitchen Station? ─── */
function SlideOneIllustration() {
  const stations = [
    { name: "Grill Station", icon: "🔥", color: "#B07A2A", item: "Burger" },
    { name: "Wok Station", icon: "🍳", color: "#B89550", item: "Noodles" },
    { name: "Bar", icon: "🍸", color: "#7D8F69", item: "Mojito" },
    { name: "Dessert", icon: "🍰", color: "#8C6A7A", item: "Tiramisu" },
  ];

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#FFFFFF", borderRadius: 2, padding: "4px 10px", border: "1px solid #ECE5D8" }}>
          <span style={{ fontSize: 12 }}>🧾</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#453F39" }}>Order #42</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {stations.map((s) => (
          <div
            key={s.name}
            style={{ background: `${s.color}08`, border: `1.5px solid ${s.color}30`, borderRadius: 2, padding: "8px 10px", textAlign: "center" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 4 }}>
              <span style={{ fontSize: 14 }}>{s.icon}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: s.color }}>{s.name}</span>
            </div>
            <span style={{ fontSize: 8, color: "#9A9084" }}>{s.item}</span>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 8, fontSize: 9, color: "#6E665D", fontWeight: 500 }}>
        Each station receives only its items — grill cook only sees grill items.
      </div>
    </div>
  );
}

/* ─── Slide 2: One Item, One Station ─── */
function SlideTwoIllustration() {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 10 }}>
        <div style={{ background: "#fff", borderRadius: 2, border: "1px solid #ECE5D8", padding: "10px 14px", textAlign: "center" }}>
          <div style={{ fontSize: 18, marginBottom: 2 }}>🍕</div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#453F39" }}>Margherita Pizza</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ width: 40, height: 2, background: "#7F9770" }} />
          <span style={{ fontSize: 7, color: "#7F9770", fontWeight: 600, marginTop: 2 }}>ASSIGNED</span>
        </div>
        <div style={{ background: "#D9770610", borderRadius: 2, border: "1.5px solid #D9770640", padding: "10px 14px", textAlign: "center" }}>
          <span style={{ fontSize: 14 }}>🔥</span>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#B07A2A" }}>Grill Station</div>
          <div style={{ fontSize: 14, color: "#7F9770", marginTop: 2 }}>✓</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 8 }}>
        {[{ name: "Bar", icon: "🍸" }, { name: "Dessert", icon: "🍰" }].map((s) => (
          <div key={s.name} style={{ opacity: 0.35, background: "#F4F0E8", borderRadius: 2, padding: "6px 12px", textAlign: "center", border: "1px dashed #D6CCBB" }}>
            <span style={{ fontSize: 12 }}>{s.icon}</span>
            <div style={{ fontSize: 9, color: "#9A9084" }}>{s.name}</div>
            <div style={{ fontSize: 12, color: "#B89550" }}>✗</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#FFFFFF", borderRadius: 2, padding: "6px 10px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 9, color: "#6E665D", fontWeight: 500 }}>Kitchen Station:</span>
        <span style={{ fontSize: 9, fontWeight: 600, color: "#453F39", background: "#fff", padding: "3px 8px", borderRadius: 4, border: "1px solid #E6DFD3" }}>Grill Station ▾</span>
      </div>
    </div>
  );
}

/* ─── Slide 3: Master Station Safety Net ─── */
function SlideThreeIllustration() {
  return (
    <div>
      <div style={{ background: "#3B82F608", border: "1.5px solid #3B82F630", borderRadius: 2, padding: "10px 14px", textAlign: "center", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 14 }}>🛡️</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#7D8F69" }}>Master Station (Default)</span>
        </div>
        <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
          {["🔴", "🟢", "🔵", "🟣", "🟡", "🟠", "🟤", "⚫"].map((dot, i) => (
            <span key={i} style={{ fontSize: 10, opacity: i >= 6 ? 1 : 0.3 }}>{dot}</span>
          ))}
        </div>
        <div style={{ fontSize: 8, color: "#7D8F69", marginTop: 4 }}>2 items still here — safe</div>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 20, marginBottom: 4 }}>
        {[1, 2, 3].map((i) => (
          <div key={i} style={{ width: 1, height: 14, borderLeft: "2px dashed #D6CCBB" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        {[
          { name: "Grill", dots: "🔴🟢🔵", count: 3, color: "#B07A2A" },
          { name: "Bar", dots: "🟣🟡", count: 2, color: "#7D8F69" },
          { name: "Dessert", dots: "🟠", count: 1, color: "#8C6A7A" },
        ].map((s) => (
          <div key={s.name} style={{ flex: 1, background: `${s.color}08`, borderRadius: 2, border: `1px solid ${s.color}25`, padding: "8px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: s.color, marginBottom: 3 }}>{s.name}</div>
            <div style={{ fontSize: 10 }}>{s.dots}</div>
            <div style={{ fontSize: 8, color: "#9A9084", marginTop: 2 }}>{s.count} items moved</div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 8, fontSize: 9, color: "#6E665D", fontWeight: 500 }}>
        You can always reassign later. Nothing gets lost.
      </div>
    </div>
  );
}

/* ─── Slide 4: Getting Started ─── */
function SlideFourIllustration() {
  const steps = [
    { num: 1, text: "Create stations for your prep areas — Grill, Bar, Wok", icon: Plus },
    { num: 2, text: "Assign items to stations from the item form or in bulk", icon: Package },
    { num: 3, text: "Items are now routed to the right station on every order", icon: CheckCircle },
  ];

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.num}
              style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 2, padding: "8px 12px", border: "1px solid #ECE5D8" }}
            >
              <span style={{ width: 22, height: 22, borderRadius: 2, background: "#B89550", color: "#fff", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {s.num}
              </span>
              <Icon className="w-3.5 h-3.5" style={{ color: "#9A9084", flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: "#453F39" }}>{s.text}</span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 10, padding: "8px 12px", background: "#EDF3EB", borderRadius: 2, border: "1px solid #CFDCC6" }}>
        <span style={{ fontSize: 9, color: "#7D8F69", fontWeight: 600 }}>Tip: </span>
        <span style={{ fontSize: 9, color: "#4F6144" }}>
          Set a default station on a category (e.g., all &lsquo;Beverages&rsquo; default to &lsquo;Bar&rsquo;). New items in that category are auto-assigned.
        </span>
      </div>
    </div>
  );
}

/* ─── Slide definitions ─── */
const KITCHEN_STATION_SLIDES: TutorialSlide[] = [
  {
    headline: "What is a Kitchen Station?",
    body: "A kitchen station is a prep area — the grill, the bar, the dessert counter. When a customer orders, each item is routed to the station that prepares it. The grill cook only sees grill items.",
    illustration: <SlideOneIllustration />,
  },
  {
    headline: "One Item, One Station",
    body: "Every item belongs to exactly one station. This keeps routing clean — no duplicates, no confusion. You pick the station when creating or editing the item.",
    illustration: <SlideTwoIllustration />,
  },
  {
    headline: "Master Station — Your Safety Net",
    body: "Every outlet starts with a Master Station. All new items land here by default. As you create specialized stations, move items out. Anything you forget stays safe at Master.",
    illustration: <SlideThreeIllustration />,
  },
  {
    headline: "Getting Started",
    body: "Your Master Station is already set up. Create stations that match your kitchen layout, then assign items. You can also assign a default station to an entire category.",
    illustration: <SlideFourIllustration />,
  },
];

/* ─── KitchenStationsTutorial wrapper ─── */
interface KitchenStationsTutorialProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function KitchenStationsTutorial(props: KitchenStationsTutorialProps) {
  return <TutorialSlideshow {...props} slides={KITCHEN_STATION_SLIDES} />;
}
