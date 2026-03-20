"use client";

import { useEffect, useRef, useState } from "react";

interface ProgressBarProps {
  total: number;
  current: number;
  /** Label shown above the bar */
  label?: string;
  /** Show numeric value (e.g. "45 / 100") */
  showValues?: boolean;
  /** Show percentage text inside / beside the bar */
  showPercent?: boolean;
  /** Height of the track in pixels */
  height?: number;
  /** Border radius of the track */
  radius?: number;
  /** Color of the filled portion — any valid CSS color */
  fillColor?: string;
  /** Color of the unfilled track */
  trackColor?: string;
  /** Color of the percentage / value text */
  textColor?: string;
  /** Color of the label */
  labelColor?: string;
  /** Animate the bar on mount */
  animated?: boolean;
}

export default function ProgressBar({
  total,
  current,
  label,
  showValues = true,
  showPercent = true,
  height = 14,
  radius = 999,
  fillColor = "#6366f1",
  trackColor = "#e5e7eb",
  textColor = "#374151",
  labelColor = "#111827",
  animated = true,
}: ProgressBarProps) {
  const percentage = total > 0 ? Math.min(100, Math.max(0, (current / total) * 100)) : 0;
  const [displayWidth, setDisplayWidth] = useState(animated ? 0 : percentage);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!animated) {
      setDisplayWidth(percentage);
      return;
    }

    // Animate from 0 → percentage on mount / when value changes
    let start: number | null = null;
    const duration = 800;
    const from = 0;
    const to = percentage;

    const step = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayWidth(from + (to - from) * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [percentage, animated]);

  const formattedPercent = `${Math.round(percentage)}%`;

  return (
    <div style={{ width: "100%", fontFamily: "inherit" }}>
      <style>{`
        @keyframes pb-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.65; }
        }
      `}</style>
      {/* Top row: label + values */}
      {(label || showValues) && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 6,
          }}
        >
          {label && (
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: labelColor,
                letterSpacing: "-0.01em",
              }}
            >
              {label}
            </span>
          )}
          {showValues && (
            <span
              style={{
                fontSize: 13,
                color: textColor,
                fontVariantNumeric: "tabular-nums",
                marginLeft: "auto",
              }}
            >
              {current.toLocaleString()} / {total.toLocaleString()}
            </span>
          )}
        </div>
      )}

      {/* Track */}
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={label ?? "Progress"}
        style={{
          position: "relative",
          width: "100%",
          height,
          borderRadius: radius,
          backgroundColor: trackColor,
          overflow: "hidden",
        }}
      >
        {/* Fill */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            width: `${displayWidth}%`,
            borderRadius: radius,
            backgroundColor: fillColor,
            transition: animated ? undefined : "width 0.3s ease",
            // Subtle shine overlay
            backgroundImage: `linear-gradient(
              90deg,
              transparent 0%,
              rgba(255,255,255,0.18) 50%,
              transparent 100%
            )`,
            animation: "pb-pulse 2s ease-in-out infinite",
          }}
        />
      </div>

      {/* Percentage below */}
      {showPercent && (
        <div
          style={{
            marginTop: 5,
            textAlign: "right",
            fontSize: 12,
            fontWeight: 500,
            color: textColor,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.02em",
          }}
        >
          {formattedPercent}
        </div>
      )}
    </div>
  );
}