type WakeLockSentinelLike = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
};

export const wakeLockSupported = () =>
  typeof navigator !== "undefined" &&
  Boolean((navigator as WakeLockNavigator).wakeLock);

/**
 * Holds a screen wake lock while active, re-acquiring it when the page comes
 * back to the foreground (the browser drops it whenever the page is hidden).
 */
export function createScreenWakeLock() {
  let sentinel: WakeLockSentinelLike | null = null;
  let wanted = false;

  const acquire = async () => {
    if (!wanted || sentinel || document.visibilityState !== "visible") return;
    try {
      sentinel =
        (await (navigator as WakeLockNavigator).wakeLock?.request("screen")) ??
        null;
    } catch (e) {
      console.warn("[audio-recorder] wake lock refused", e);
    }
  };
  const onVisibility = () => {
    if (document.visibilityState === "visible") {
      sentinel = null;
      void acquire();
    }
  };

  return {
    set(enabled: boolean) {
      wanted = enabled;
      if (enabled) {
        document.addEventListener("visibilitychange", onVisibility);
        void acquire();
        return;
      }
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => undefined);
      sentinel = null;
    },
  };
}
