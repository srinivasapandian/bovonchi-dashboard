import React, { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export interface TutorialSlide {
  headline: string;
  body: string;
  illustration: React.ReactNode;
}

interface TutorialSlideshowProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
  slides: TutorialSlide[];
}

export default function TutorialSlideshow({
  open,
  onClose,
  onComplete,
  slides,
}: TutorialSlideshowProps) {
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("right");
  const [animating, setAnimating] = useState(false);

  const totalSlides = slides.length;

  useEffect(() => {
    if (open) {
      setCurrent(0);
      setDirection("right");
    }
  }, [open]);

  const goTo = useCallback(
    (idx: number) => {
      if (idx === current || animating) return;
      setDirection(idx > current ? "right" : "left");
      setAnimating(true);
      setCurrent(idx);
      setTimeout(() => setAnimating(false), 220);
    },
    [current, animating]
  );

  const next = useCallback(() => {
    if (current < totalSlides - 1) goTo(current + 1);
  }, [current, totalSlides, goTo]);

  const back = useCallback(() => {
    if (current > 0) goTo(current - 1);
  }, [current, goTo]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, next, back]);

  if (!open) return null;

  const slide = slides[current];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.4)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 520,
          maxHeight: "85vh",
          background: "#fff",
          borderRadius: 2,
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* Progress bar */}
        <div style={{ display: "flex", gap: 4, padding: "0 20px", paddingTop: 12 }}>
          {Array.from({ length: totalSlides }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: i <= current ? "#B89550" : "#F4F0E8",
                transition: "background 200ms ease-out",
              }}
            />
          ))}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 28,
            height: 28,
            borderRadius: 2,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#9A9084",
            zIndex: 2,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#F4F0E8")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <X className="w-4 h-4" />
        </button>

        {/* Slide content area */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          <div
            style={{
              transition: "transform 200ms ease-out, opacity 200ms ease-out",
              transform: animating
                ? direction === "right"
                  ? "translateX(-20px)"
                  : "translateX(20px)"
                : "translateX(0)",
              opacity: animating ? 0.7 : 1,
            }}
          >
            <div style={{ padding: "20px 28px 8px", textAlign: "center" }}>
              {/* Step indicator */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#B89550",
                  marginBottom: 8,
                }}
              >
                {current + 1} of {totalSlides}
              </div>

              {/* Headline */}
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#453F39",
                  fontFamily: "'Jost', sans-serif",
                  margin: 0,
                  marginBottom: 8,
                }}
              >
                {slide.headline}
              </h2>

              {/* Body */}
              <p
                style={{
                  fontSize: 13,
                  color: "#6E665D",
                  lineHeight: 1.6,
                  maxWidth: 400,
                  margin: "0 auto 18px",
                }}
              >
                {slide.body}
              </p>

              {/* Illustration container */}
              <div
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #ECE5D8",
                  borderRadius: 2,
                  padding: 16,
                }}
              >
                {slide.illustration}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px 18px",
            borderTop: "1px solid #F4F0E8",
          }}
        >
          {/* Back button */}
          <button
            onClick={back}
            disabled={current === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "7px 14px",
              borderRadius: 2,
              border: "1px solid #E6DFD3",
              background: "#fff",
              fontSize: 12,
              fontWeight: 600,
              color: "#6E665D",
              cursor: current === 0 ? "default" : "pointer",
              opacity: current === 0 ? 0.4 : 1,
              transition: "opacity 150ms",
            }}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Back
          </button>

          {/* Dot indicators */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {Array.from({ length: totalSlides }).map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                style={{
                  width: i === current ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === current ? "#B89550" : "#E6DFD3",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  transition: "all 200ms ease-out",
                }}
              />
            ))}
          </div>

          {/* Next / Got it button */}
          {current < totalSlides - 1 ? (
            <button
              onClick={next}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "7px 14px",
                borderRadius: 2,
                border: "1px solid #E6DFD3",
                background: "#fff",
                fontSize: 12,
                fontWeight: 600,
                color: "#6E665D",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#FFFFFF")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={() => {
                onComplete?.();
                onClose();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 18px",
                borderRadius: 2,
                border: "none",
                background: "#B89550",
                fontSize: 12,
                fontWeight: 700,
                color: "#fff",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#8A6D33")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#B89550")}
            >
              Got it, let&apos;s go!
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
