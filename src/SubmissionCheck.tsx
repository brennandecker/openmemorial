import { useEffect, useRef, useState } from "react";

type WidgetAPI = { render: (element: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void };
declare global { interface Window { turnstile?: WidgetAPI } }
let widgetScript: Promise<void> | undefined;
function loadWidget() {
  if (window.turnstile) return Promise.resolve();
  if (!widgetScript) widgetScript = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true; script.defer = true;
    script.onload = () => resolve(); script.onerror = () => { script.remove(); widgetScript = undefined; reject(new Error("Verification could not load.")); };
    document.head.appendChild(script);
  });
  return widgetScript;
}
export function SubmissionCheck({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); let widget: string | undefined;
    onToken(""); setError("");
    void (async () => {
      const response = await fetch("/api/config", { signal: controller.signal });
      if (!response.ok) throw new Error("Verification is unavailable.");
      const config = await response.json() as { turnstileSitekey: string };
      if (!config.turnstileSitekey) throw new Error("Verification is unavailable.");
      await loadWidget();
      if (controller.signal.aborted || !container.current || !window.turnstile) return;
      widget = window.turnstile.render(container.current, { sitekey: config.turnstileSitekey, action: "share_memory", theme: "light", size: "flexible", appearance: "interaction-only", callback: (token: string) => { onToken(token); setError(""); }, "expired-callback": () => { onToken(""); }, "error-callback": () => { onToken(""); setError("Verification couldn’t finish. Please retry."); } });
    })().catch(() => { if (!controller.signal.aborted) setError("Verification couldn’t load. Please retry."); });
    return () => { controller.abort(); if (widget && window.turnstile) window.turnstile.remove(widget); };
  }, [attempt, onToken]);
  return <div className="note-verification"><div ref={container} />{error && <p className="note-error" role="alert">{error} <button type="button" onClick={() => setAttempt(value => value + 1)}>Retry verification</button></p>}</div>;
}
