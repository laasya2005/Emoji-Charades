declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(name: string, params?: Record<string, string | number>): void {
  try {
    if (typeof window === "undefined") return;
    if (process.env.NEXT_PUBLIC_GA_ENABLED !== "true") return;
    if (!window.gtag) return;
    window.gtag("event", name, params);
  } catch {
    // Analytics must never break gameplay
  }
}
