import { useCallback, useEffect, useRef, useState } from "react";
import { useT, useLocale, LOCALE_NAMES, BUILT_IN_LOCALES, getCustomLangs, saveCustomLang, cacheTranslation } from "../i18n";
import en from "../i18n/en";
import type { Translations } from "../i18n/types";

const FLAG_EMOJI: Record<string, string> = {
  en: "\u{1F1EC}\u{1F1E7}",
  zh: "\u{1F1E8}\u{1F1F3}",
  es: "\u{1F1EA}\u{1F1F8}",
  ru: "\u{1F1F7}\u{1F1FA}",
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
        className="social-launcher arcade-button"
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
          className="absolute right-0 top-full mt-1.5 z-[100] min-w-[180px] rounded-xl overflow-hidden"
          style={{
            background: "rgba(15,23,42,0.97)",
            border: "2px solid rgba(56,189,248,0.35)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.6), 0 0 12px rgba(56,189,248,0.15)",
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
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm leading-none transition-colors hover:bg-slate-700/60"
                    style={{
                      color: isActive ? "#67e8f9" : "#e2e8f0",
                      fontWeight: isActive ? 800 : 500,
                    }}
                  >
                    <span className="text-base">{flag}</span>
                    <span className="flex-1">{name}</span>
                    {isActive && <span className="text-cyan-400">&#10003;</span>}
                  </button>
                );
              })}
              <div style={{ borderTop: "1px solid rgba(148,163,184,0.15)" }} />
              <button
                type="button"
                onClick={() => setShowPrompt(true)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-sm text-slate-300 hover:bg-slate-700/60 transition-colors"
              >
                <span className="text-base">{"\u{1F310}"}</span>
                <span>{t("lang.other")}</span>
              </button>
            </>
          ) : (
            <div className="p-3.5 flex flex-col gap-2.5">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {t("lang.promptTitle")}
              </div>
              <input
                type="text"
                value={langInput}
                onChange={e => { setLangInput(e.target.value); setError(null); }}
                onKeyDown={e => { if (e.key === "Enter") handleTranslate(); }}
                placeholder={t("lang.promptPlaceholder")}
                autoFocus
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-cyan-400"
              />
              {error && <div className="text-xs text-rose-400 font-semibold">{error}</div>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setShowPrompt(false); setError(null); }}
                  className="flex-1 rounded-lg border border-slate-600 px-3 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  {t("lang.cancel")}
                </button>
                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={translating || !langInput.trim()}
                  className="flex-1 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
