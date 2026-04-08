import { useCallback, useEffect, useRef, useState } from "react";
import { useT, useLocale, LOCALE_NAMES, BUILT_IN_LOCALES } from "../i18n";

const FLAG_EMOJI: Record<string, string> = {
  en: "\u{1F1EC}\u{1F1E7}",
  zh: "\u{1F1E8}\u{1F1F3}",
  hi: "\u{1F1EE}\u{1F1F3}",
};

const FLAG_STYLE: React.CSSProperties = {
  fontFamily: '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif',
  fontSize: "1.55rem",
  lineHeight: 1,
};

export default function LanguageSwitcher() {
  const t = useT();
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  const handleSelect = useCallback((code: string) => {
    setLocale(code);
    setOpen(false);
  }, [setLocale]);
  const allLangs = Object.keys(BUILT_IN_LOCALES);

  return (
    <div ref={dropdownRef} className="relative">
      {/* Globe button */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); }}
        title={t("lang.label")}
        aria-label={t("lang.label")}
        className="social-launcher arcade-button h-12 w-12 p-2 shadow-[0_14px_30px_rgba(2,6,23,0.42)]"
      >
        <svg viewBox="0 0 24 24" fill="none" className="w-full h-full" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <ellipse cx="12" cy="12" rx="4" ry="10" />
          <path d="M2 12h20" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute left-0 top-full mt-3 z-[100] w-[min(calc(100vw-1rem),22rem)] rounded-[1.8rem] p-4"
          style={{
            background: "rgba(15,23,42,0.985)",
            border: "4px solid rgba(36,127,186,0.78)",
            boxShadow: "0 22px 44px rgba(2,6,23,0.52)",
          }}
        >
          {allLangs.map(code => {
            const isActive = code === locale;
            const name = LOCALE_NAMES[code] || code;
            const flag = FLAG_EMOJI[code] || "\u{1F310}";
            return (
              <button
                key={code}
                type="button"
                onClick={() => handleSelect(code)}
                className="w-full flex items-center gap-4 rounded-2xl px-4 py-3.5 text-left transition-colors hover:bg-slate-800/55"
                style={{
                  color: isActive ? "#67e8f9" : "#e2e8f0",
                  fontWeight: isActive ? 800 : 500,
                  fontSize: "1rem",
                }}
              >
                <span aria-hidden="true" style={FLAG_STYLE}>{flag}</span>
                <span className="flex-1 font-i18n">{name}</span>
                {isActive && <span className="text-cyan-400">&#10003;</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
