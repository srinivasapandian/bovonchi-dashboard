import React from "react";
import { Check, ChevronRight } from "lucide-react";
import TutorialSlideshow, { type TutorialSlide } from "./tutorial-slideshow";

/* ─── Slide 1: What is Sync History? ─── */

function Slide1Illustration() {
  const events = [
    { time: "2:30 PM", status: "Synced", color: "#5F7A55", icon: "check_circle" },
    { time: "11:15 AM", status: "Pending", color: "#B89550", icon: "schedule" },
    { time: "9:00 AM", status: "Synced", color: "#5F7A55", icon: "check_circle" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {events.map((ev, idx) => (
        <div key={idx} style={{ display: "flex", gap: 10 }}>
          {/* Timeline */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 20 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: ev.color, flexShrink: 0, boxShadow: `0 0 0 3px ${ev.color}22` }} />
            {idx < events.length - 1 && <div style={{ width: 2, flex: 1, background: "#E6DFD3", minHeight: 20 }} />}
          </div>
          {/* Card */}
          <div
            style={{
              flex: 1,
              background: "#fff",
              borderRadius: 2,
              border: "1px solid #ECE5D8",
              padding: "8px 10px",
              marginBottom: 6,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#453F39" }}>{ev.time}</span>
              <span style={{ fontSize: 8, fontWeight: 600, color: ev.color, background: `${ev.color}15`, padding: "2px 6px", borderRadius: 999 }}>
                {ev.status}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Slide 2: Devices & Integrations ─── */

function Slide2Illustration() {
  const devices = [
    { name: "POS Terminal 1", type: "pos", icon: "monitor", status: "synced" },
    { name: "Kitchen Display", type: "kds", icon: "tv", status: "synced" },
    { name: "Self-Order Kiosk", type: "kiosk", icon: "tablet", status: "pending" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: "#6E665D", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
        Device Status
      </div>
      {devices.map((d) => (
        <div
          key={d.name}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "#fff",
            borderRadius: 2,
            padding: "7px 10px",
            border: "1px solid #ECE5D8",
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 16, color: "#9A9084" }}>{d.icon}</span>
          <span style={{ flex: 1, fontSize: 10, fontWeight: 500, color: "#453F39" }}>{d.name}</span>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.status === "synced" ? "#5F7A55" : "#B89550" }} />
        </div>
      ))}
    </div>
  );
}

/* ─── Slide 3: Sync Statuses ─── */

function Slide3Illustration() {
  const statuses = [
    { label: "Synced", color: "#5F7A55", desc: "All devices are up to date" },
    { label: "Pending", color: "#B89550", desc: "Changes waiting to be pushed" },
    { label: "Failed", color: "#A63D2F", desc: "Sync error \u2014 resync to retry" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {statuses.map((s) => (
        <div
          key={s.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "#fff",
            borderRadius: 2,
            padding: "8px 12px",
            border: "1px solid #ECE5D8",
            borderLeft: `3px solid ${s.color}`,
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: s.color }}>{s.label}</div>
            <div style={{ fontSize: 9, color: "#6E665D" }}>{s.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Slide 4: Resync & Troubleshoot ─── */

function Slide4Illustration() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Failed card */}
      <div
        style={{
          background: "#fff",
          borderRadius: 2,
          border: "1px solid #ECE5D8",
          borderLeft: "3px solid #A63D2F",
          padding: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: "#453F39" }}>2:30 PM Today</span>
          <span style={{ fontSize: 8, fontWeight: 600, color: "#A63D2F", background: "rgba(166,61,47,0.08)", padding: "2px 6px", borderRadius: 999 }}>
            Failed
          </span>
        </div>
        <div style={{ fontSize: 9, color: "#6E665D", marginBottom: 8 }}>1/3 devices synced</div>
        {/* Resync button */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            borderRadius: 2,
            background: "rgba(184,149,80,0.08)",
            fontSize: 9,
            fontWeight: 600,
            color: "#B89550",
          }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 12 }}>refresh</span>
          Resync
        </div>
      </div>
      {/* Hint */}
      <div style={{ textAlign: "center", fontSize: 9, color: "#9A9084", fontWeight: 500 }}>
        Click Resync to retry failed devices
      </div>
    </div>
  );
}

/* ─── Slide 5: Getting Started ─── */

function Slide5Illustration() {
  const steps = [
    { num: 1, text: "Edit items, menus, or categories" },
    { num: 2, text: "Changes are tracked automatically" },
    { num: 3, text: "Click Sync Now for pending changes" },
    { num: 4, text: "Monitor device status here" },
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

const SYNC_HISTORY_SLIDES: TutorialSlide[] = [
  {
    headline: "What is Sync History?",
    body: "Sync History shows every time your catalog changes were pushed to devices and integrations. Each event is timestamped so you can track exactly when updates went live.",
    illustration: <Slide1Illustration />,
  },
  {
    headline: "Devices & Integrations",
    body: "Each sync event shows which devices (POS, KDS, Kiosk) and integrations received the update. Expand any event to see individual device status at a glance.",
    illustration: <Slide2Illustration />,
  },
  {
    headline: "Understanding Statuses",
    body: "Green means synced and up to date. Yellow means changes are pending and waiting to be pushed. Red means something went wrong \u2014 use Resync to retry.",
    illustration: <Slide3Illustration />,
  },
  {
    headline: "Resync & Troubleshoot",
    body: "If a sync fails, click the Resync button to retry. Failed syncs usually resolve on retry. If issues persist, check your device connectivity.",
    illustration: <Slide4Illustration />,
  },
  {
    headline: "Getting Started",
    body: "Sync events are created automatically when you edit your catalog. Visit this page anytime to check if all your devices are running the latest version.",
    illustration: <Slide5Illustration />,
  },
];

/* ─── SyncHistoryTutorial wrapper ─── */

interface SyncHistoryTutorialProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function SyncHistoryTutorial(props: SyncHistoryTutorialProps) {
  return <TutorialSlideshow {...props} slides={SYNC_HISTORY_SLIDES} />;
}
