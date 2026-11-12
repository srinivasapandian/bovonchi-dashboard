import React from "react";
import {
  Check,
  X as XIcon,
  Edit,
  Globe,
  Package,
  Layers,
  ChevronRight,
} from "lucide-react";
import TutorialSlideshow, { type TutorialSlide } from "./tutorial-slideshow";

/* ─── Slide 1: What is a Category? ─── */

function Slide1Illustration() {
  const menuSections = [
    { title: "Starters", items: ["Garlic Bread", "Bruschetta"] },
    { title: "Pizzas", items: ["Margherita", "Pepperoni"] },
    { title: "Drinks", items: ["Mojito", "Lemonade"] },
  ];

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {/* Paper menu */}
      <div
        style={{
          flex: 1,
          background: "#fff",
          borderRadius: 2,
          border: "1px solid #ECE5D8",
          padding: 10,
          boxShadow: "2px 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#B89550",
            textAlign: "center",
            marginBottom: 8,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Menu
        </div>
        {menuSections.map((section) => (
          <div key={section.title} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "#453F39", marginBottom: 2 }}>
              {section.title}
            </div>
            {section.items.map((item) => (
              <div key={item} style={{ fontSize: 8, color: "#9A9084", paddingLeft: 6 }}>
                {item}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Arrow */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <div style={{ width: 24, height: 1, background: "#B89550" }} />
        <ChevronRight className="w-3 h-3" style={{ color: "#B89550", marginLeft: 6 }} />
      </div>

      {/* UI accordion rows */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        {menuSections.map((section) => (
          <div
            key={section.title}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "#fff",
              borderRadius: 2,
              padding: "6px 10px",
              border: "1px solid #ECE5D8",
            }}
          >
            <ChevronRight className="w-3 h-3" style={{ color: "#9A9084" }} />
            <span style={{ fontSize: 9, fontWeight: 600, color: "#453F39", flex: 1 }}>
              {section.title}
            </span>
            <span style={{ fontSize: 8, color: "#9A9084" }}>{section.items.length}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Slide 2: Parent & Child Categories ─── */

function Slide2Illustration() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Tree */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {/* Parent */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "#fff",
            borderRadius: 2,
            padding: "8px 12px",
            border: "1px solid #ECE5D8",
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 5,
              background: "#B89550",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
            }}
          >
            🍕
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#453F39" }}>Pizzas</span>
          <span
            style={{
              fontSize: 8,
              fontWeight: 600,
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(184,149,80,0.08)",
              color: "#B89550",
              marginLeft: "auto",
            }}
          >
            Parent
          </span>
        </div>

        {/* Connector lines + children */}
        <div style={{ marginLeft: 20, borderLeft: "2px solid #E6DFD3", paddingLeft: 12, marginTop: 4 }}>
          {[
            { name: "Vegetarian Pizzas", items: "Margherita, Garden Special" },
            { name: "Non-Veg Pizzas", items: "Pepperoni, BBQ Chicken" },
          ].map((child) => (
            <div
              key={child.name}
              style={{
                background: "#fff",
                borderRadius: 2,
                padding: "6px 10px",
                border: "1px solid #ECE5D8",
                marginBottom: 4,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: "#453F39" }}>
                {child.name}
              </div>
              <div style={{ fontSize: 8, color: "#9A9084", marginTop: 2 }}>
                {child.items}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rules row */}
      <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              background: "rgba(95,122,85,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Check className="w-2.5 h-2.5" style={{ color: "#5F7A55" }} />
          </div>
          <span style={{ fontSize: 9, fontWeight: 600, color: "#5F7A55" }}>
            Parent &rarr; Child
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              background: "rgba(166,61,47,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <XIcon className="w-2.5 h-2.5" style={{ color: "#A63D2F" }} />
          </div>
          <span style={{ fontSize: 9, fontWeight: 600, color: "#A63D2F" }}>
            No deeper nesting
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Slide 3: Items Can Be Anywhere ─── */

function Slide3Illustration() {
  const examples = [
    {
      item: "Garlic Bread",
      categories: [{ name: "Sides", dotted: false }],
      label: "One category",
      labelColor: "#5F7A55",
    },
    {
      item: "Truffle Fries",
      categories: [
        { name: "Sides", dotted: false },
        { name: "Bar Snacks", dotted: false },
      ],
      label: "Multiple",
      labelColor: "#B07A2A",
    },
    {
      item: "Daily Special",
      categories: [{ name: "Uncategorized", dotted: true }],
      label: "No category",
      labelColor: "#9A9084",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {examples.map((ex) => (
        <div
          key={ex.item}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#fff",
            borderRadius: 2,
            padding: "8px 12px",
            border: "1px solid #ECE5D8",
          }}
        >
          <span style={{ fontSize: 10, fontWeight: 600, color: "#453F39", width: 80 }}>
            {ex.item}
          </span>
          <div style={{ width: 16, height: 1, background: "#E6DFD3" }} />
          <div style={{ display: "flex", gap: 4, flex: 1 }}>
            {ex.categories.map((cat) => (
              <span
                key={cat.name}
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: 5,
                  background: cat.dotted ? "transparent" : "rgba(184,149,80,0.08)",
                  color: cat.dotted ? "#9A9084" : "#B89550",
                  border: cat.dotted ? "1px dashed #D6CCBB" : "1px solid rgba(184,149,80,0.15)",
                }}
              >
                {cat.name}
              </span>
            ))}
          </div>
          <span
            style={{
              fontSize: 8,
              fontWeight: 700,
              color: ex.labelColor,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              whiteSpace: "nowrap",
            }}
          >
            {ex.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Slide 4: Visibility Flows Down ─── */

const CHANNEL_COLORS: Record<string, string> = {
  "Dine-in": "#B89550",
  "Delivery": "#5E8C7B",
  "Pickup": "#8C6A7A",
};

function ChannelBadge({ name }: { name: string }) {
  const color = CHANNEL_COLORS[name] ?? "#6E665D";
  return (
    <span style={{
      fontSize: 8, fontWeight: 600, padding: "2px 7px", borderRadius: 4,
      background: `${color}10`, color, border: `1px solid ${color}20`,
    }}>
      {name}
    </span>
  );
}

function VisRow({ name, channels, isChild }: { name: string; channels: string[]; isChild?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, background: "#fff",
      borderRadius: 2, padding: "7px 10px", border: "1px solid #ECE5D8",
      marginLeft: isChild ? 16 : 0,
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: "#453F39", minWidth: 72 }}>{name}</span>
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
        {channels.map((ch) => <ChannelBadge key={ch} name={ch} />)}
      </div>
    </div>
  );
}

function Slide4Illustration() {
  return (
    <div style={{ display: "flex", gap: 14 }}>
      {/* Before */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#5F7A55", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, textAlign: "center" }}>Before</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <VisRow name="Pizzas" channels={["Dine-in", "Delivery", "Pickup"]} />
          <VisRow name="Veg Pizzas" isChild channels={["Dine-in", "Delivery", "Pickup"]} />
        </div>
      </div>

      {/* After */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: "#A63D2F", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, textAlign: "center" }}>After</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <VisRow name="Pizzas" channels={["Dine-in", "Pickup"]} />
          <VisRow name="Veg Pizzas" isChild channels={["Dine-in", "Pickup"]} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
          <div style={{ width: 14, height: 1, background: "#A63D2F" }} />
          <span style={{ fontSize: 8, fontWeight: 600, color: "#A63D2F" }}>Veg Pizzas follows parent automatically</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Slide 5: Getting Started ─── */

function Slide5Illustration() {
  const steps = [
    { num: 1, text: "Name it", icon: Edit },
    { num: 2, text: "Choose channels", icon: Globe },
    // { num: 3, text: "Add items", icon: Package },
    { num: 3, text: "Add products", icon: Package },
    { num: 4, text: "Set a parent", icon: Layers, optional: true },
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
            {s.optional && (
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 600,
                  color: "#9A9084",
                  marginLeft: "auto",
                }}
              >
                (optional)
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Slide definitions ─── */

const CATEGORIES_SLIDES: TutorialSlide[] = [
  {
    headline: "What is a Category?",
    // body: "A category is a group for your items \u2014 like sections on a menu. \u2018Pizzas\u2019, \u2018Starters\u2019, \u2018Beverages\u2019 \u2014 each holds items that belong together.",
    body: "A category is a group for your products — like sections in a store. ‘Earrings’, ‘Rings’, ‘Bracelets’ — each holds products that belong together.",
    illustration: <Slide1Illustration />,
  },
  {
    headline: "Parent & Child Categories",
    body: "Need more detail? Create subcategories. \u2018Pizzas\u2019 can have \u2018Vegetarian\u2019 and \u2018Non-Veg\u2019 inside it. One level of nesting \u2014 simple and clean.",
    illustration: <Slide2Illustration />,
  },
  {
    // headline: "Items Can Be Anywhere",
    headline: "Products Can Be Anywhere",
    // body: "An item can belong to one category, multiple categories, or none at all. Uncategorized items appear in a separate group.",
    body: "A product can belong to one category, multiple categories, or none at all. Uncategorized products appear in a separate group.",
    illustration: <Slide3Illustration />,
  },
  {
    headline: "Visibility Flows Down",
    body: "Control where each category appears \u2014 Dine-in, Delivery, Kiosk. Turn off a parent and all subcategories follow automatically.",
    illustration: <Slide4Illustration />,
  },
  {
    headline: "Getting Started",
    // body: "Create your first category in seconds. Name it, pick channels, add items \u2014 or add items later.",
    body: "Create your first category in seconds. Name it, pick channels, add products — or add products later.",
    illustration: <Slide5Illustration />,
  },
];

/* ─── CategoriesTutorial wrapper ─── */

interface CategoriesTutorialProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function CategoriesTutorial(props: CategoriesTutorialProps) {
  return <TutorialSlideshow {...props} slides={CATEGORIES_SLIDES} />;
}
