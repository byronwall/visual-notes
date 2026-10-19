# Coding standards

Judgement calls for reviewing a diff. Mechanical rules live in lint and CI;
implementation rules live in [AGENTS.md](AGENTS.md).

## UI design

- Render document/file/path-like strings in a monospace font so paths scan distinctly from titles/body copy.
- In UI surfaces, prefer relative timestamps (for example, `5m ago`, `2d ago`) over absolute datetimes. Use absolute timestamps only when precision/auditability is required.
- Prefer subtle background/surface differences (`bg.subtle`, `bg.muted`, spacing) over heavy border stacks to separate sections; use borders sparingly for true emphasis or interactive affordance.
- For simple single-field edits (for example names/titles), prefer inline edit-in-place interactions over opening a dedicated modal.
- Avoid generic instructional helper copy in polished UI surfaces (for example, “hover/click to…” lines) unless user enablement truly depends on it.
- Popovers/menus/dialog-like floating content should default to content-driven sizing (`fit-content` semantics) rather than fixed widths. Prefer letting child content define practical width constraints.
- Do not set fixed popover widths by default. Only set explicit max/fixed width at the popover/container level for truly dynamic or unbounded content that cannot be constrained safely by child components.
- When width constraints are needed, prefer max-width responsive to viewport (`calc(100vw - margin)`) and keep the container compositional so content can still size naturally.
- For dense data tables or list rows with row-level click targets plus nested controls, verify hover and interactive states in Playwright for all layers: row hover, nested links, inline edit triggers, destructive actions, and secondary toggles/popovers. Cursor changes alone are not sufficient feedback.
- When a table/list row is clickable, provide a visible hover state on the row and separate hover states for nested interactive controls so users can distinguish “open row” from “open nested action”.
- For route-like utility endpoints used directly in the browser (for example local downloads/review pages), do not leave the user on a blank binary/JSON dead end. If the route is likely to be visited directly, render a small HTML landing page or otherwise provide obvious next steps while preserving the real download/action path.

## UI review evidence

- A UI PR needs before/after screenshots that someone has actually looked at. If the author couldn't view them, the PR carries the `visuals-unverified` label. Don't merge it until someone has looked.
