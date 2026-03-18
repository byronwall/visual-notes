let lockCount = 0;
let previousBodyOverflow: string | null = null;

export function acquireBodyScrollLock() {
  if (typeof document === "undefined") {
    return () => {};
  }

  if (lockCount === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }

  lockCount += 1;

  let released = false;
  return () => {
    if (released || typeof document === "undefined") return;
    released = true;
    lockCount = Math.max(0, lockCount - 1);
    if (lockCount === 0) {
      document.body.style.overflow = previousBodyOverflow ?? "";
      previousBodyOverflow = null;
    }
  };
}
