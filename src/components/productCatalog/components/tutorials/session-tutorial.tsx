import React from "react";
import { Clock, Calendar, CheckCircle, Layers, Eye } from "lucide-react";
import TutorialSlideshow, { type TutorialSlide } from "./tutorial-slideshow";

/* ─── Slide 1: What is a Session? ─── */
function SlideOneIllustration() {
  // Horizontal day timeline with three colored blocks and visible gaps
  const blocks = [
    // { label: "Breakfast", time: "7–11 AM", color: "#B07A2A", left: "8%", width: "22%" },
    { label: "Morning Drop", time: "7–11 AM", color: "#B07A2A", left: "8%", width: "22%" },
    // { label: "Lunch", time: "11:30–2:30", color: "#7F9770", left: "33%", width: "17%" },
    { label: "Flash Sale", time: "11:30–2:30", color: "#7F9770", left: "33%", width: "17%" },
    // { label: "Dinner", time: "5–10 PM", color: "#7D8F69", left: "56%", width: "28%" },
    { label: "Evening Drop", time: "5–10 PM", color: "#7D8F69", left: "56%", width: "28%" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
        <Clock className="w-3.5 h-3.5" style={{ color: "#9A9084" }} />
        <span style={{ fontSize: 9, color: "#9A9084", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>6 AM → 11 PM</span>
      </div>
      {/* Timeline bar */}
      <div style={{ position: "relative", height: 44, background: "#F4F0E8", borderRadius: 2 }}>
        {blocks.map((b) => (
          <div
            key={b.label}
            style={{
              position: "absolute", left: b.left, width: b.width, top: 4, bottom: 4,
              background: `${b.color}25`, border: `1.5px solid ${b.color}60`,
              borderRadius: 2, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Clock className="w-3 h-3" style={{ color: b.color, marginBottom: 1 }} />
            <div style={{ fontSize: 10, fontWeight: 700, color: b.color }}>{b.label}</div>
            <div style={{ fontSize: 8, color: b.color, opacity: 0.8 }}>{b.time}</div>
          </div>
        ))}
        {/* Gap indicators */}
        <div style={{ position: "absolute", left: "31%", top: "50%", transform: "translateY(-50%)", fontSize: 8, color: "#D6CCBB" }}>gap</div>
        <div style={{ position: "absolute", left: "51%", top: "50%", transform: "translateY(-50%)", fontSize: 8, color: "#D6CCBB" }}>gap</div>
      </div>
      {/* Time axis */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, padding: "0 2px" }}>
        {["6am", "8am", "10am", "12pm", "2pm", "4pm", "6pm", "8pm", "10pm"].map((t) => (
          <span key={t} style={{ fontSize: 8, color: "#D6CCBB" }}>{t}</span>
        ))}
      </div>
      {/* Note */}
      <div style={{ marginTop: 8, textAlign: "center", fontSize: 9, color: "#9A9084", fontStyle: "italic" }}>
        {/* was: Items not in any session are unavailable — your &lsquo;All Day&rsquo; session covers everything by default. */}Products not in any session are unavailable — your &lsquo;All Day&rsquo; session covers everything by default.
      </div>
    </div>
  );
}

/* ─── Slide 2: Flexible Time Slots ─── */
function SlideTwoIllustration() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div>
      {/* Weekly grid — single session "Happy Hour" with two slot blocks */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {days.map((day) => {
          const isWeekend = day === "Sat" || day === "Sun";
          // Weekday: 4-7pm = ~53%-73% of a 6am-11pm range. Weekend: 2-7pm = ~47%-76%
          const slotLeft = isWeekend ? "47%" : "59%";
          const slotWidth = isWeekend ? "29%" : "18%";
          return (
            <div key={day} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 28, fontSize: 10, fontWeight: 600, color: "#6E665D", textAlign: "right" }}>{day}</span>
              <div style={{ flex: 1, height: 18, background: "#F4F0E8", borderRadius: 4, position: "relative" }}>
                <div
                  style={{
                    position: "absolute", left: slotLeft, width: slotWidth, height: "100%",
                    background: "#F59E0B30", border: "1.5px solid #F59E0B70",
                    borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <span style={{ fontSize: 7, fontWeight: 700, color: "#B07A2A" }}>{/* was: Happy Hour */}Flash Sale</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Callout */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 }}>
        <div style={{ width: 1, height: 12, borderLeft: "2px solid #B89550" }} />
        <span style={{ fontSize: 9, color: "#6E665D", fontWeight: 500 }}>Same session, different hours by day</span>
      </div>
      {/* Legend */}
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "#B89550" }} />
          <span style={{ color: "#6E665D" }}>Mon–Fri 4–7 PM</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: "#B89550" }} />
          <span style={{ color: "#6E665D" }}>Sat–Sun 2–7 PM</span>
        </div>
      </div>
      {/* Overnight note */}
      <div style={{ marginTop: 6, textAlign: "center", fontSize: 8, color: "#9A9084", fontStyle: "italic" }}>
        Overnight works too — a Late Night session from 10 PM to 2 AM spans midnight automatically.
      </div>
    </div>
  );
}

/* ─── Slide 3: Items Appear and Disappear ─── */
function SlideThreeIllustration() {
  const breakfastItems = [
    // { name: "Breakfast Burrito", emoji: "🌯" },
    { name: "Pearl Studs", emoji: "✨" },
    // { name: "Pancakes", emoji: "🥞" },
    { name: "Gold Hoops", emoji: "⭕" },
    // { name: "Fresh Juice", emoji: "🧃" },
    { name: "Ear Cuffs", emoji: "💎" },
  ];
  const lunchItems = [
    // { name: "Caesar Salad", emoji: "🥗" },
    { name: "Silver Chain", emoji: "📿" },
    // { name: "Club Sandwich", emoji: "🥪" },
    { name: "Charm Bracelet", emoji: "📿" },
    // { name: "Soup of the Day", emoji: "🍲" },
    { name: "Solitaire Ring", emoji: "💍" },
  ];

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
      {/* Left panel: 9:15 AM */}
      <div style={{ flex: 1, background: "#fff", borderRadius: 2, border: "1px solid #ECE5D8", padding: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#B07A2A", background: "#D9770615", padding: "2px 6px", borderRadius: 4 }}>{/* was: Breakfast */}Morning Drop</span>
          <span style={{ fontSize: 8, color: "#9A9084" }}>9:15 AM</span>
        </div>
        {breakfastItems.map((item) => (
          <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
            <span style={{ fontSize: 14 }}>{item.emoji}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#453F39" }}>{item.name}</span>
          </div>
        ))}
      </div>

      {/* Arrow */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
        <span style={{ fontSize: 18, color: "#B89550" }}>→</span>
        <span style={{ fontSize: 7, color: "#9A9084", fontWeight: 600, textTransform: "uppercase" }}>Auto</span>
      </div>

      {/* Right panel: 11:30 AM */}
      <div style={{ flex: 1, background: "#fff", borderRadius: 2, border: "1px solid #ECE5D8", padding: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#7F9770", background: "#10B98115", padding: "2px 6px", borderRadius: 4 }}>{/* was: Lunch */}Flash Sale</span>
          <span style={{ fontSize: 8, color: "#9A9084" }}>11:30 AM</span>
        </div>
        {lunchItems.map((item) => (
          <div key={item.name} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0" }}>
            <span style={{ fontSize: 14 }}>{item.emoji}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: "#453F39" }}>{item.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Slide 4: Menus Switch Automatically ─── */
function SlideFourIllustration() {
  const screens = [
    // { time: "8:00 AM", menu: "Breakfast Menu", color: "#B07A2A" },
    { time: "8:00 AM", menu: "Morning Drop", color: "#B07A2A" },
    // { time: "12:30 PM", menu: "Lunch Menu", color: "#7F9770" },
    { time: "12:30 PM", menu: "Flash Sale", color: "#7F9770" },
    // { time: "6:00 PM", menu: "Dinner Menu", color: "#7D8F69" },
    { time: "6:00 PM", menu: "Evening Drop", color: "#7D8F69" },
  ];

  return (
    <div>
      {/* Three tablets in sequence */}
      <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center" }}>
        {screens.map((s, i) => (
          <React.Fragment key={s.menu}>
            <div
              style={{
                width: 120, background: `${s.color}10`, borderRadius: 2, padding: "10px 8px",
                border: `1.5px solid ${s.color}40`, textAlign: "center",
              }}
            >
              <div style={{ fontSize: 8, color: "#9A9084", marginBottom: 3 }}>{s.time}</div>
              <div style={{ width: 32, height: 40, background: `${s.color}20`, borderRadius: 4, margin: "0 auto 4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 16 }}>📱</span>
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: s.color }}>{s.menu}</div>
            </div>
            {i < screens.length - 1 && (
              <span style={{ fontSize: 14, color: "#D6CCBB" }}>→</span>
            )}
          </React.Fragment>
        ))}
      </div>
      {/* Timeline bar below */}
      <div style={{ display: "flex", gap: 2, marginTop: 10, borderRadius: 2, overflow: "hidden" }}>
        {screens.map((s) => (
          <div key={s.menu} style={{ flex: 1, height: 6, background: `${s.color}60` }} />
        ))}
      </div>
      <div style={{ textAlign: "center", marginTop: 6, fontSize: 9, color: "#9A9084", fontWeight: 500 }}>
        {/* was: Same device, three menus, zero effort. */}Same store, three drops, zero effort.
      </div>
    </div>
  );
}

/* ─── Slide 5: Getting Started ─── */
function SlideFiveIllustration() {
  const steps = [
    // { num: 1, text: "Click 'Create Session' and name it — e.g., Happy Hour", icon: Clock },
    { num: 1, text: "Click 'Create Session' and name it — e.g., Flash Sale", icon: Clock },
    { num: 2, text: "Pick days and set start/end times", icon: Calendar },
    // { num: 3, text: "Assign items from your catalog", icon: Layers },
    { num: 3, text: "Assign products from your catalog", icon: Layers },
    { num: 4, text: "Preview the weekly timeline and save", icon: Eye },
  ];

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.num}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "#fff", borderRadius: 2, padding: "8px 12px",
                border: "1px solid #ECE5D8",
              }}
            >
              <span
                style={{
                  width: 22, height: 22, borderRadius: 2, background: "#B89550",
                  color: "#fff", fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {s.num}
              </span>
              <Icon className="w-3.5 h-3.5" style={{ color: "#9A9084", flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 500, color: "#453F39" }}>{s.text}</span>
            </div>
          );
        })}
      </div>
      {/* Tip box */}
      <div style={{ marginTop: 10, padding: "8px 12px", background: "#EDF3EB", borderRadius: 2, border: "1px solid #CFDCC6" }}>
        <span style={{ fontSize: 9, color: "#7D8F69", fontWeight: 600 }}>Tip: </span>
        <span style={{ fontSize: 9, color: "#4F6144" }}>
          {/* was: Every new item gets the &lsquo;All Day&rsquo; session by default. You only need custom sessions for items with restricted hours. */}Every new product gets the &lsquo;All Day&rsquo; session by default. You only need custom sessions for products with restricted hours.
        </span>
      </div>
    </div>
  );
}

/* ─── Slide definitions ─── */
const SESSION_SLIDES: TutorialSlide[] = [
  {
    headline: "What is a Session?",
    // body: "A session is a time window — Breakfast from 7 to 11 AM, Happy Hour from 4 to 7 PM. Items assigned to a session only appear on your menus during that window.",
    body: "A session is a time window — Morning Drop from 7 to 11 AM, Flash Sale from 4 to 7 PM. Products assigned to a session only appear in your store during that window.",
    illustration: <SlideOneIllustration />,
  },
  {
    headline: "Flexible Time Slots",
    // body: "One session can have different hours on different days. Happy Hour could run 4–7 PM on weekdays but 2–7 PM on weekends. Add as many slots as you need.",
    body: "One session can have different hours on different days. Flash Sale could run 4–7 PM on weekdays but 2–7 PM on weekends. Add as many slots as you need.",
    illustration: <SlideTwoIllustration />,
  },
  {
    // headline: "Items Appear and Disappear",
    headline: "Products Appear and Disappear",
    // body: "Assign items to a session and they show up when it starts and vanish when it ends. A Breakfast Burrito appears at 7 AM and disappears at 11 AM — no manual switching.",
    body: "Assign products to a session and they show up when it starts and vanish when it ends. A Morning Drop piece appears at 7 AM and disappears at 11 AM — no manual switching.",
    illustration: <SlideThreeIllustration />,
  },
  {
    // headline: "Menus Switch Automatically",
    headline: "Your Store Switches Automatically",
    // body: "A waiter's tablet can show a different menu for each session — Breakfast Menu in the morning, Lunch Menu at noon, Dinner Menu in the evening. The switch happens automatically.",
    body: "Your online store can show different products for each session — Morning Drop in the morning, Flash Sale at noon, Evening Drop at night. The switch happens automatically.",
    illustration: <SlideFourIllustration />,
  },
  {
    headline: "Getting Started",
    // body: "Create a session in 30 seconds. Pick a name, set the days and times, assign items. Your 'All Day' session already covers everything — custom sessions are for when you want more control.",
    body: "Create a session in 30 seconds. Pick a name, set the days and times, assign products. Your 'All Day' session already covers everything — custom sessions are for when you want more control.",
    illustration: <SlideFiveIllustration />,
  },
];

/* ─── SessionTutorial wrapper ─── */
interface SessionTutorialProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function SessionTutorial(props: SessionTutorialProps) {
  return <TutorialSlideshow {...props} slides={SESSION_SLIDES} />;
}
