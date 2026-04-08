import { useCallback, useEffect, useRef, useState } from "react";
import { useT, useLocale, LOCALE_NAMES, BUILT_IN_LOCALES, getCustomLangs, saveCustomLang, cacheTranslation } from "../i18n";
import en from "../i18n/en";
import type { Translations } from "../i18n/types";

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
  const [showPrompt, setShowPrompt] = useState(false);
  const [langInput, setLangInput] = useState("");
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowPrompt(false);
        setError(null);
      }
    }
    document.addEventListener("pointerdown", handleClick);
    return () => document.removeEventListener("pointerdown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setShowPrompt(false); setError(null); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  const handleSelect = useCallback((code: string) => {
    setLocale(code);
    setOpen(false);
    setShowPrompt(false);
    setError(null);
  }, [setLocale]);

  const handleTranslate = useCallback(async () => {
    const name = langInput.trim();
    if (!name) return;

    setTranslating(true);
    setError(null);

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLang: name, strings: en }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || t("lang.translateFail"));
      }

      const data = await response.json() as { translations: Translations; langCode: string };
      const code = data.langCode || name.toLowerCase().slice(0, 2);

      cacheTranslation(code, data.translations);
      saveCustomLang(code, name);
      setLocale(code);
      setOpen(false);
      setShowPrompt(false);
      setLangInput("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("lang.translateFail"));
    } finally {
      setTranslating(false);
    }
  }, [langInput, setLocale, t]);

  // Build language list: built-in + custom cached
  const customLangs = getCustomLangs();
  const allLangs = [
    ...Object.keys(BUILT_IN_LOCALES),
    ...Object.keys(customLangs).filter(k => !BUILT_IN_LOCALES[k]),
  ];

  return (
    <div ref={dropdownRef} className="relative">
      {/* Globe button */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setShowPrompt(false); setError(null); }}
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
          className="absolute right-0 top-full mt-3 z-[100] w-[min(82vw,22rem)] rounded-[1.8rem] p-4"
          style={{
            background: "rgba(15,23,42,0.985)",
            border: "4px solid rgba(36,127,186,0.78)",
            boxShadow: "0 22px 44px rgba(2,6,23,0.52)",
          }}
        >
          {!showPrompt ? (
            <>
              {allLangs.map(code => {
                const isActive = code === locale;
                const name = LOCALE_NAMES[code] || customLangs[code] || code;
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
                    {isActive && <span className="text-cyan-400 text-[2rem] leading-none">&#10003;</span>}
                  </button>
                );
              })}
              <div style={{ borderTop: "1px solid rgba(148,163,184,0.15)", margin: "0.5rem 0" }} />
              <button
                type="button"
                onClick={() => setShowPrompt(true)}
                className="w-full flex items-center gap-4 rounded-2xl px-4 py-3.5 text-left text-slate-300 transition-colors hover:bg-slate-800/55"
                style={{ fontSize: "1rem" }}
              >
                <span aria-hidden="true" style={FLAG_STYLE}>{"\u{1F310}"}</span>
                <span className="font-i18n">{t("lang.other")}</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2.5 p-1">
              <div className="font-i18n text-xs font-bold uppercase tracking-wider text-slate-400">
                {t("lang.promptTitle")}
              </div>
              <input
                type="text"
                value={langInput}
                onChange={e => { setLangInput(e.target.value); setError(null); }}
                onKeyDown={e => { if (e.key === "Enter") handleTranslate(); }}
                placeholder={t("lang.promptPlaceholder")}
                autoFocus
                className="font-i18n w-full rounded-xl border border-slate-600 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-400"
              />
              {error && <div className="font-i18n text-xs font-semibold text-rose-400">{error}</div>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowPrompt(false); setError(null); }}
                  className="font-i18n flex-1 rounded-xl border border-slate-600 px-3 py-2 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-700"
                >
                  {t("lang.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={translating || !langInput.trim()}
                  className="font-i18n flex-1 rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {translating ? t("lang.translating") : t("lang.translate")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
