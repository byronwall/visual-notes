// Text layout report for a page: overflow, clipped text, overlapping and
// undersized targets. Lets an agent check layout without viewing images.

// Runs in the page. Keep it self-contained.
const measureInPage = () => {
  const vw = window.innerWidth;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return (
      r.width > 1 &&
      r.height > 1 &&
      s.visibility !== "hidden" &&
      s.opacity !== "0"
    );
  };
  // Content inside its own scroller (calendar grids, tables) may extend past
  // the viewport on purpose.
  const inScroller = (el) => {
    for (
      let p = el.parentElement;
      p && p !== document.body;
      p = p.parentElement
    ) {
      if (getComputedStyle(p).overflowX !== "visible") return true;
    }
    return false;
  };
  const label = (el) => {
    const name =
      el.getAttribute("aria-label") ||
      el.textContent?.trim().slice(0, 40) ||
      "";
    const cls =
      typeof el.className === "string" ? el.className.split(" ")[0] : "";
    return `${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${name ? ` "${name}"` : ""}`;
  };
  const all = [...document.body.querySelectorAll("*")].filter(visible);
  const offscreen = all
    .filter(
      (el) => el.getBoundingClientRect().right > vw + 1 && !inScroller(el),
    )
    .filter(
      (el) =>
        !all.some(
          (p) =>
            p !== el &&
            p.contains(el) &&
            p.getBoundingClientRect().right > vw + 1,
        ),
    )
    .slice(0, 5)
    .map(label);
  const clipped = all
    .filter(
      (el) => el.children.length === 0 && el.scrollWidth > el.clientWidth + 1,
    )
    .filter((el) => getComputedStyle(el).textOverflow !== "ellipsis")
    .slice(0, 5)
    .map(label);
  const targets = [
    ...document.querySelectorAll(
      "a[href],button,input,select,textarea,[role=button],[tabindex='0']",
    ),
  ]
    .filter(visible)
    .slice(0, 400);
  const overlaps = [];
  for (let i = 0; i < targets.length && overlaps.length < 5; i++) {
    const a = targets[i].getBoundingClientRect();
    for (let j = i + 1; j < targets.length; j++) {
      if (targets[i].contains(targets[j]) || targets[j].contains(targets[i]))
        continue;
      const b = targets[j].getBoundingClientRect();
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 4 && h > 4) {
        overlaps.push(`${label(targets[i])} x ${label(targets[j])}`);
        break;
      }
    }
  }
  const small = targets.filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width < 24 || r.height < 24;
  });
  return {
    horizontalOverflow: document.documentElement.scrollWidth > vw + 1,
    offscreen,
    clipped,
    overlaps,
    smallTargets: vw < 600 ? small.slice(0, 5).map(label) : [],
  };
};

/**
 * @param {import("@playwright/test").Page} page
 * @returns {Promise<{ horizontalOverflow: boolean, offscreen: string[], clipped: string[], overlaps: string[], smallTargets: string[] }>}
 */
export const layoutReport = (page) => page.evaluate(measureInPage);

/** Short labels for the problems in a layout report; empty when clean. */
export const layoutProblems = (report) =>
  [
    report.horizontalOverflow && "h-overflow",
    report.offscreen.length && `${report.offscreen.length} offscreen`,
    report.clipped.length && `${report.clipped.length} clipped`,
    report.overlaps.length && `${report.overlaps.length} overlaps`,
    report.smallTargets.length && `${report.smallTargets.length} small targets`,
  ].filter(Boolean);
