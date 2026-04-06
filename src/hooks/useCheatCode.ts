import { useEffect, useRef } from "react";

const BUFFER_MAX = 12;
const PASSTHROUGH_KEYS = new Set([
  "Shift",
  "Control",
  "Alt",
  "Meta",
  "CapsLock",
  "Tab",
  "NumLock",
]);

export function useCheatCodes(handlers: Record<string, () => void>): void {
  const handlersRef = useRef(handlers);
  const bufferRef = useRef("");

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key >= "0" && event.key <= "9") {
        bufferRef.current = (bufferRef.current + event.key).slice(-BUFFER_MAX);
        for (const code of Object.keys(handlersRef.current)) {
          if (bufferRef.current.endsWith(code)) {
            bufferRef.current = "";
            event.stopImmediatePropagation();
            event.preventDefault();
            handlersRef.current[code]();
            return;
          }
        }
      } else if (!PASSTHROUGH_KEYS.has(event.key)) {
        bufferRef.current = "";
      }
    }

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);
}
