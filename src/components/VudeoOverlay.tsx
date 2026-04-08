import { useEffect, useState } from "react";

export type VudeoSlideType = "intro" | "outro";

interface Props {
  type: VudeoSlideType;
  onComplete?: () => void;
  onFadeStart?: () => void;
  isStatic?: boolean;
}

const INTRO_HOLD_MS = 10_000;
const OUTRO_HOLD_MS = 5_000;
const INTRO_FADE_MS = 600;
const OUTRO_FADE_MS = 1_200;

export default function VudeoOverlay({
  type,
  onComplete,
  onFadeStart,
  isStatic = false,
}: Props) {
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (isStatic) {
      setOpacity(1);
      return;
    }

    const holdMs = type === "intro" ? INTRO_HOLD_MS : OUTRO_HOLD_MS;
    const fadeMs = type === "intro" ? INTRO_FADE_MS : OUTRO_FADE_MS;
    const fadeTimer = window.setTimeout(() => {
      onFadeStart?.();
      setOpacity(0);
    }, holdMs);
    const completeTimer = window.setTimeout(() => onComplete?.(), holdMs + fadeMs);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(completeTimer);
    };
  }, [isStatic, onComplete, onFadeStart, type]);

  if (type === "intro" && isStatic) {
    return (
      <div
        data-testid="vudeo-overlay-intro-prompt"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "#020617",
        }}
      />
    );
  }

  const fadeMs = type === "intro" ? INTRO_FADE_MS : OUTRO_FADE_MS;
  const title = type === "intro" ? "Vudeo intro screen" : "Vudeo outro screen";
  const src = type === "intro" ? "/intro.html" : "/outro.html";

  return (
    <div
      data-testid={`vudeo-overlay-${type}`}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#020617",
      }}
    >
      <iframe
        title={title}
        src={src}
        style={{
          width: "100%",
          height: "100%",
          border: 0,
          display: "block",
          background: "#020617",
          opacity,
          transition: `opacity ${fadeMs}ms ease-in-out`,
        }}
      />
    </div>
  );
}
