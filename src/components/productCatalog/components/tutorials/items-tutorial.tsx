import React from "react";
import {
  Camera,
  SlidersHorizontal,
  Clock,
  Tag,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import TutorialSlideshow, { type TutorialSlide } from "./tutorial-slideshow";

/* ─── Slide 1: What is an Item? ─── */

function Slide1Illustration() {
  return (
    <div style={{ position: "relative" }}>
      {/* Item card */}
      <div
        style={{
          background: "#fff",
          borderRadius: 2,
          border: "1px solid #ECE5D8",
          overflow: "hidden",
          maxWidth: 260,
          margin: "0 auto",
        }}
      >
        {/* Image area */}
        <div
          style={{
            height: 64,
            background: "linear-gradient(135deg, #F6E9E5 0%, #F7EFDF 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 28 }}>🍕</span>
        </div>
        <div style={{ padding: "10px 12px" }}>
          {/* Name row + arrow */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#453F39" }}>
              Margherita Pizza
            </span>
            <span
              style={{
                fontSize: 8,
                fontWeight: 600,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(95,122,85,0.08)",
                color: "#5F7A55",
              }}
            >
              Active
            </span>
          </div>
          {/* Category badge + arrow */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 4,
                background: "rgba(184,149,80,0.08)",
                color: "#B89550",
              }}
            >
              Pizzas
            </span>
          </div>
          {/* Description */}
          <p style={{ fontSize: 9, color: "#9A9084", margin: 0, marginBottom: 6, lineHeight: 1.4 }}>
            Classic tomato sauce, fresh mozzarella, basil
          </p>
          {/* Price */}
          <div style={{ fontSize: 14, fontWeight: 700, color: "#453F39" }}>
            $12.99
          </div>
        </div>
      </div>

      {/* Labeled arrows */}
      <div
        style={{
          position: "absolute",
          top: 76,
          right: 20,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        {["Name", "Category", "Price"].map((label) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <div
              style={{
                width: 20,
                height: 1,
                background: "#B89550",
              }}
            />
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: "#B89550",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Slide 2: Items Live Inside Categories ─── */

function Slide2Illustration() {
  const rows = [
    { name: "Pizzas", count: 3, expanded: false },
    {
      name: "Beverages",
      count: 2,
      expanded: true,
      items: [
        { name: "Mojito", price: "$10.50" },
        { name: "Fresh Juice", price: "$6.99" },
      ],
    },
    { name: "Desserts", count: 1, expanded: false },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {rows.map((row) => (
        <div key={row.name}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#fff",
              borderRadius: 2,
              padding: "8px 12px",
              border: "1px solid #ECE5D8",
              cursor: "pointer",
            }}
          >
            {row.expanded ? (
              <ChevronDown className="w-3.5 h-3.5" style={{ color: "#B89550" }} />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" style={{ color: "#9A9084" }} />
            )}
            <span style={{ fontSize: 11, fontWeight: 600, color: "#453F39", flex: 1 }}>
              {row.name}
            </span>
            <span style={{ fontSize: 10, color: "#9A9084" }}>
              {row.count} items
            </span>
          </div>
          {/* Expanded items */}
          {row.expanded && row.items && (
            <div style={{ marginLeft: 24, marginTop: 4, display: "flex", flexDirection: "column", gap: 3 }}>
              {row.items.map((item) => (
                <div
                  key={item.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "#fff",
                    borderRadius: 2,
                    padding: "6px 10px",
                    border: "1px solid #ECE5D8",
                  }}
                >
                  <span style={{ fontSize: 10, color: "#453F39", fontWeight: 500 }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: 10, color: "#6E665D", fontWeight: 600 }}>
                    {item.price}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {/* Arrow label */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          marginTop: 4,
        }}
      >
        <div style={{ width: 14, height: 1, background: "#B89550" }} />
        <span style={{ fontSize: 9, fontWeight: 600, color: "#B89550" }}>
          Click to expand
        </span>
      </div>
    </div>
  );
}

/* ─── Slide 3: Quick Create vs. Full Detail ─── */

function Slide3Illustration() {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {/* Left: Basic */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "#5F7A55",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 6,
          }}
        >
          Basic (always visible)
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: 2,
            border: "1px solid #ECE5D8",
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {["Product Name" /* was: "Item Name" */, "Category", "Price"].map((field) => (
            <div
              key={field}
              style={{
                background: "#FFFFFF",
                borderRadius: 5,
                padding: "5px 8px",
                fontSize: 9,
                color: "#9A9084",
                border: "1px solid #ECE5D8",
              }}
            >
              {field}
            </div>
          ))}
          <div
            style={{
              background: "#B89550",
              color: "#fff",
              borderRadius: 5,
              padding: "5px 0",
              textAlign: "center",
              fontSize: 9,
              fontWeight: 700,
              marginTop: 2,
            }}
          >
            Save
          </div>
        </div>
      </div>
      {/* Right: Advanced */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: "#B07A2A",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: 6,
          }}
        >
          Advanced (expand when needed)
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: 2,
            border: "1px solid #ECE5D8",
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {[
            { icon: Camera, label: "Images" },
            // { icon: SlidersHorizontal, label: "Modifiers" },
            { icon: SlidersHorizontal, label: "Product Options" },
            { icon: Clock, label: "Availability" },
            { icon: Tag, label: "Allergens & Labels" },
          ].map((section) => {
            const Icon = section.icon;
            return (
              <div
                key={section.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#FFFFFF",
                  borderRadius: 5,
                  padding: "5px 8px",
                  border: "1px solid #ECE5D8",
                }}
              >
                <Icon className="w-3 h-3" style={{ color: "#9A9084" }} />
                <span style={{ fontSize: 9, color: "#6E665D", fontWeight: 500 }}>
                  {section.label}
                </span>
                <ChevronRight className="w-3 h-3" style={{ color: "#9A9084", marginLeft: "auto" }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


/* ─── Slide definitions ─── */

const ITEMS_SLIDES: TutorialSlide[] = [
  {
    // headline: "What is an Item?",
    headline: "What is a Product?",
    // body: "An item is anything your customers can order \u2014 a Margherita Pizza, a Mojito, a slice of Tiramisu. Each item has a name, a price, and lives inside a category.",
    body: "A product is anything your customers can buy — a pair of earrings, a ring, a bracelet. Each product has a name, a price, and lives inside a category.",
    illustration: <Slide1Illustration />,
  },
  {
    // headline: "Items Live Inside Categories",
    headline: "Products Live Inside Categories",
    // body: "Your items are grouped by category \u2014 Pizzas, Drinks, Desserts. On the Items page, categories appear as expandable rows. Click to see items inside.",
    body: "Your products are grouped by category — Earrings, Rings, Bracelets. On the Products page, categories appear as expandable rows. Click to see products inside.",
    illustration: <Slide2Illustration />,
  },
  {
    headline: "Quick Create vs. Full Detail",
    body: "You only need a name and a price to create an item. Everything else \u2014 images, allergens, modifiers \u2014 is optional and hidden until you need it.",
    illustration: <Slide3Illustration />,
  },
];

/* ─── ItemsTutorial wrapper ─── */

interface ItemsTutorialProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function ItemsTutorial(props: ItemsTutorialProps) {
  return <TutorialSlideshow {...props} slides={ITEMS_SLIDES} />;
}
