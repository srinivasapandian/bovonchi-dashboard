import React from "react";
import {
  Monitor,
  Tablet,
  Edit,
  Layers,
  CheckCircle,
} from "lucide-react";
import TutorialSlideshow, { type TutorialSlide } from "./tutorial-slideshow";

/* ─── Slide illustrations ─── */

function SlideOneIllustration() {
  const menus = [
    {
      title: "Food Menu",
      bg: "#F6E9E5",
      bar: "#B89550",
      items: ["Pizza", "Burger", "Salad"],
    },
    {
      title: "Drinks Menu",
      bg: "#EDF3EB",
      bar: "#5F7A55",
      items: ["Mojito", "Coffee", "Juice"],
    },
    {
      title: "Desserts",
      bg: "#F7EFDF",
      bar: "#B07A2A",
      items: ["Tiramisu", "Cake", "Ice Cream"],
    },
  ];

  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
      {menus.map((m) => (
        <div
          key={m.title}
          style={{
            flex: "1 1 0",
            maxWidth: 130,
            borderRadius: 2,
            overflow: "hidden",
            background: m.bg,
          }}
        >
          <div style={{ height: 4, background: m.bar }} />
          <div style={{ padding: "10px 8px 10px" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#453F39",
                marginBottom: 6,
              }}
            >
              {m.title}
            </div>
            {m.items.map((item) => (
              <div
                key={item}
                style={{
                  fontSize: 10,
                  color: "#6E665D",
                  padding: "2px 0",
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SlideTwoIllustration() {
  const deviceList = [
    { name: "Main POS", menu: "Food Menu", color: "#B89550", icon: Monitor },
    { name: "Bar Tablet", menu: "Drinks Menu", color: "#5F7A55", icon: Tablet },
    { name: "Coffee Station", menu: "Coffee Menu", color: "#B07A2A", icon: Tablet },
    { name: "Kiosk", menu: "Full Menu", color: "#B89550", icon: Monitor },
  ];

  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
      {deviceList.map((d) => {
        const Icon = d.icon;
        return (
          <div
            key={d.name}
            style={{
              flex: "1 1 0",
              maxWidth: 110,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 0,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Icon className="w-4 h-4" style={{ color: "#6E665D" }} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#453F39",
                  textAlign: "center",
                }}
              >
                {d.name}
              </span>
            </div>
            <div
              style={{
                width: 1,
                height: 16,
                borderLeft: "2px dotted #D6CCBB",
                margin: "4px 0",
              }}
            />
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 2,
                background: `${d.color}14`,
                color: d.color,
                whiteSpace: "nowrap",
              }}
            >
              {d.menu}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SlideThreeIllustration() {
  const segments = [
    { label: "Breakfast", time: "7\u201311 AM", color: "#B07A2A" },
    { label: "Lunch", time: "11:30\u20133 PM", color: "#5F7A55" },
    { label: "Dinner", time: "5\u201310 PM", color: "#B89550" },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          borderRadius: 2,
          overflow: "hidden",
          gap: 2,
        }}
      >
        {segments.map((s) => (
          <div
            key={s.label}
            style={{
              flex: 1,
              background: `${s.color}26`,
              padding: "10px 6px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: s.color }}>
              {s.label}
            </div>
            <div
              style={{ fontSize: 9, color: s.color, opacity: 0.8, marginTop: 2 }}
            >
              {s.time}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          marginTop: 12,
        }}
      >
        <Tablet className="w-3.5 h-3.5" style={{ color: "#9A9084" }} />
        <span style={{ fontSize: 10, color: "#9A9084", fontWeight: 500 }}>
          Same device, automatic switching
        </span>
      </div>
    </div>
  );
}

function SlideFourIllustration() {
  const channels = [
    { name: "Dine-in", menus: "Food + Drinks + Desserts" },
    { name: "Delivery", menus: "Food + Desserts only" },
    { name: "Kiosk", menus: "Full Menu" },
    { name: "Online", menus: "Food + Drinks" },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
      }}
    >
      {channels.map((ch) => (
        <div
          key={ch.name}
          style={{
            background: "#fff",
            borderRadius: 2,
            padding: "10px 12px",
            textAlign: "left",
            border: "1px solid #ECE5D8",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#453F39",
              marginBottom: 3,
            }}
          >
            {ch.name}
          </div>
          <div style={{ fontSize: 10, color: "#9A9084" }}>{ch.menus}</div>
        </div>
      ))}
    </div>
  );
}

function SlideFiveIllustration() {
  const steps = [
    { num: 1, text: "Name your menu", icon: Edit },
    { num: 2, text: "Pick categories", icon: Layers },
    { num: 3, text: "Assign devices & channels", icon: Monitor },
    { num: 4, text: "Set to Live", icon: CheckCircle },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {steps.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.num}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              background: "#fff",
              borderRadius: 2,
              padding: "9px 12px",
              border: "1px solid #ECE5D8",
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 2,
                background: "#B89550",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {s.num}
            </span>
            <Icon
              className="w-3.5 h-3.5"
              style={{ color: "#9A9084", flexShrink: 0 }}
            />
            <span style={{ fontSize: 12, fontWeight: 500, color: "#453F39" }}>
              {s.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Slide definitions ─── */

const MENU_SLIDES: TutorialSlide[] = [
  {
    headline: "What is a Menu?",
    body: "A Menu is a custom grouping of your catalog \u2014 like a playlist for your restaurant. Instead of showing every item everywhere, you choose exactly what appears where.",
    illustration: <SlideOneIllustration />,
  },
  {
    headline: "Assign to Devices & Stations",
    body: "Each device or station gets its own menu. A coffee station shows only coffee items. The bar tablet shows only drinks. No clutter, no confusion.",
    illustration: <SlideTwoIllustration />,
  },
  {
    headline: "Menus Change by Session",
    body: "A waiter\u2019s tablet can automatically switch menus throughout the day \u2014 Breakfast in the morning, Lunch at noon, Dinner in the evening.",
    illustration: <SlideThreeIllustration />,
  },
  {
    headline: "Control Online Channels",
    body: "Choose which menus appear on delivery apps, online ordering, or kiosks. Your delivery menu can exclude dine-in-only items.",
    illustration: <SlideFourIllustration />,
  },
  {
    headline: "Getting Started",
    body: "Create your first menu in under a minute. Pick a name, select categories, assign devices \u2014 done.",
    illustration: <SlideFiveIllustration />,
  },
];

/* ─── MenuTutorial wrapper ─── */

interface MenuTutorialProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function MenuTutorial(props: MenuTutorialProps) {
  return <TutorialSlideshow {...props} slides={MENU_SLIDES} />;
}
