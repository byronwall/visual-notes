# ParkUI + PandaCSS migration guide (from Tailwind)

This guide documents the concrete changes made to migrate the app navbar and
docs index experience from Tailwind utility classes to **ParkUI-style
components** (Ark UI + Panda recipes) and **PandaCSS** (`styled-system`) props.
Follow the same patterns for other pages/components.

## Goals and constraints

- **No Tailwind utility strings** in migrated components.
- **Prefer existing `~/components/ui/*` primitives** (they already wrap Ark UI
  with Panda recipes).
- **Use Panda layout primitives** from `styled-system/jsx` (`Box`, `HStack`,
  `Container`, etc.) instead of `div` + class strings.
- **Solid guidelines**:
  - Prefer `Show` over `&&`
  - If a value depends on resources, gate with `Suspense` fallback
  - Avoid inline handlers when they’re more than trivial (name the function)
  - Prefer named exports for new/updated components

## What changed in `Navbar` (step-by-step)

### 1) Replace Tailwind `class="..."` with Panda layout + style props

**Before (Tailwind):**

```tsx
<nav class="w-full border-b border-gray-200 bg-white">
  <div class="container mx-auto px-4 py-3 flex items-center justify-between">
    ...
  </div>
</nav>
```

**After (Panda patterns + semantic tokens):**

```tsx
<Box as="nav" bg="bg.default" borderBottomWidth="1px" borderColor="border">
  <Container py="3" px="4">
    <HStack gap="4">
      ...
      <Spacer />
      ...
    </HStack>
  </Container>
</Box>
```

Notes:

- `bg="bg.default"` and `borderColor="border"` use **semantic tokens** defined
  in `app/panda.config.ts`. This makes the component theme-aware and avoids
  hardcoded colors like `bg-white` / `border-gray-200`.
- Layout moved from “utility soup” to **composable primitives**:
  - `HStack` replaces `flex items-center ...`
  - `Spacer` replaces `justify-between`
  - `Container` replaces `container mx-auto ...`

### 2) Use `~/components/ui/*` instead of raw `<a>` / `<button>`

The repo already has ParkUI-style primitives built on Panda recipes:

- `~/components/ui/button` → `Button`
- `~/components/ui/link` → `Link`
- `~/components/ui/image` → `Image`

Replace:

- `<a href="...">` → `<Link href="...">`
- `<button onClick={...}>` → `<Button onClick={...}>`

Why:

- You get consistent focus rings, hover states, spacing, typography, etc.
- Variants (e.g. `variant="plain"`, `variant="outline"`, `variant="solid"`)
  are centralized in recipes under `app/src/theme/recipes/*`.

### 3) Replace ad-hoc `cta` classes with recipe-driven buttons/links

The navbar previously used `class="cta"` for sign in/out actions.

Migration approach:

- Use `Button` for button semantics.
- For “button-looking links” (e.g. sign-in is a link), create a small local
  wrapper using the **same `button` recipe**.

Example pattern:

```tsx
import { ark } from "@ark-ui/solid/factory";
import { styled } from "styled-system/jsx";
import { button } from "styled-system/recipes";

const CtaLink = styled(ark.a, button);
```

Then:

```tsx
<Show
  when={authed()}
  fallback={
    <CtaLink href="/login" variant="solid" size="sm" colorPalette="green">
      Sign in
    </CtaLink>
  }
>
  <Button variant="outline" size="sm" colorPalette="red" onClick={handleLogout}>
    Sign out
  </Button>
</Show>
```

Why this works well:

- You get the **exact same styling system** for anchors and buttons.
- You keep correct semantics: navigation uses `<a>`, actions use `<button>`.

### 4) Fix `img` rendering: prefer `Image` over `Box as="img"`

Attempting to do:

```tsx
<Box as="img" src="..." />
```

…fails because `BoxProps` don’t include `src`.

Use `~/components/ui/image`:

```tsx
<Image
  src="/favicon-32x32.png"
  alt=""
  boxSize="6"
  fit="contain"
  borderRadius="l2"
/>
```

This keeps the sizing stable and avoids unexpected intrinsic sizing.

### 5) Keep Solid’s resource discipline (`Suspense` + `Show`)

In the navbar, `hasUnreadAny()` and `hasLoadingAny()` depend on resources, so:

- Wrap the indicator region in `Suspense fallback={null}`
- Use `Show` to render the dots

This pattern stays the same during migration; only styling changes.

### 6) Avoid inline handlers when non-trivial

Before:

```tsx
onClick={() => openLLM()}
```

After:

```tsx
const handleChatOpen = () => {
  openLLM();
};

<Button onClick={handleChatOpen}>Chat</Button>;
```

This matches the repo guidance and makes future behavior changes easier.

### 7) Prefer named exports; update imports at call sites

Changed:

- `export default Navbar` → `export const Navbar = ...`

Then updated usage:

```tsx
import { Navbar } from "~/components/Navbar";
```

This aligns with the “prefer named exports” guidance.

## Practical Tailwind → Panda mapping cheatsheet

Use this as a starting point when migrating other components.

- **Layout**

  - `flex items-center` → `<HStack>` (or `<Flex align="center">`)
  - `flex flex-col` → `<Stack>` / `<VStack>`
  - `justify-between` → `<HStack> ... <Spacer /> ... </HStack>`
  - `gap-2` → `gap="2"`
  - `p-4` → `p="4"` (or `px="4"` / `py="3"`)

Note: `HStack` uses **`alignItems`**, not `align`. (`Flex` supports `align`.)

- **Sizing**

  - `w-full` → `w="full"`
  - `h-10` → `h="10"`
  - `h-2 w-2` → `boxSize="2"`

- **Borders + radius**

  - `border-b` → `borderBottomWidth="1px"`
  - `rounded` / `rounded-md` → `borderRadius="l2"` (use your semantic radii)

- **Color**

  - `bg-white` → `bg="bg.default"`
  - `text-gray-600` → `color="fg.muted"`
  - `border-gray-200` → `borderColor="border"`

- **Typography**
  - `text-sm` → `textStyle="sm"`
  - `font-semibold` → `fontWeight="semibold"`
  - `tracking-tight` → `letterSpacing="tight"`

## Ark `Select` wrapper gotcha (type-level)

While migrating the AI dashboard (`app/src/routes/ai/index.tsx`), we attempted
to use the `~/components/ui/select` wrapper (Ark UI Select + Panda recipe).
Ark Select does **not** use an `items` prop on `Select.Root`; it requires a
`collection` created by `createListCollection`.

Practical guidance:

- Create a collection and pass it to `Select.Root`:

```tsx
import * as Select from "~/components/ui/select";
import { Portal } from "solid-js/web";

type Item = { label: string; value: string };
const collection = Select.createListCollection<Item>({
  items: [
    { label: "All", value: "all" },
    { label: "Success", value: "success" },
  ],
});

<Select.Root
  collection={collection}
  value={["all"]} // IMPORTANT: value is an array
  onValueChange={(details) => console.log(details.value)}
>
  <Select.Control>
    <Select.Trigger>
      <Select.ValueText placeholder="Pick one" />
      <Select.Indicator />
    </Select.Trigger>
  </Select.Control>
  <Portal>
    <Select.Positioner>
      <Select.Content>
        <Select.List>
          {/* render collection.items with <Select.Item item={...}> */}
        </Select.List>
      </Select.Content>
    </Select.Positioner>
  </Portal>
  <Select.HiddenSelect />
</Select.Root>;
```

Additional notes from migrating `src/routes/umap/*` and `src/routes/embeddings/*`:

- **`Select.Root` value shape**: `value` is always a string array (single-select still uses `["value"]`). When reading it back, use `details.value[0] ?? ""`.
- **Collections and resources**: when your items come from a resource, build a `createListCollection` from the resource output, and render `<Select.Item item={item}>` from that collection’s `items`.

## Recommended migration workflow (repeatable)

1. **Identify structure** (what are the key layout groups? header/content/footer?)
2. **Replace structural divs** with `styled-system/jsx` primitives first:
   `Container`, `Box`, `Stack`, `HStack`, `VStack`, `Flex`, `Spacer`.
3. **Replace controls** with `~/components/ui/*`:
   `Button`, `Link`, form controls, menus, etc.
4. **Replace “special classes”** (e.g. `cta`) with a recipe-based approach:
   either choose an existing primitive variant or create a small local wrapper
   with `styled(...)` + a recipe.
5. **Convert remaining utility styles** to Panda props:
   - prefer semantic tokens (`bg.*`, `fg.*`, `border`) over hardcoded colors
6. **Keep Solid correctness**:
   - `Show` for conditional UI
   - `Suspense` for anything involving resources
   - avoid prop destructuring

## Migration checklist (use for each component)

- Inventory UI pieces: layout groups, controls, and popovers/modals
- Replace layout wrappers with `Box`/`Stack`/`HStack`/`Flex`/`Container`
- Swap controls to `~/components/ui/*` primitives (`Button`, `Input`, `Checkbox`, etc.)
- Convert remaining Tailwind classes to Panda props (favor semantic tokens)
- Verify text sizing/weight with `Text`/`Heading` props
- Check hover/focus states and spacing density match pre-migration

## Additional learnings from Docs Index migration

The docs index surface includes filter panels, list rows, popovers, modals,
and a nested path sidebar. These introduced a few new patterns and gotchas.

### A) Prefer ParkUI inputs/checkboxes over native elements

In the docs index, migrating filters and rows required replacing:

- native `<input>` for search and text fields → `~/components/ui/input`
- native checkbox inputs → `~/components/ui/checkbox` (Ark checkbox + recipe)

Example pattern used in rows:

```tsx
<Checkbox.Root
  checked={!!props.selected}
  onCheckedChange={(details) => handleToggle(details.checked === true)}
>
  <Checkbox.HiddenInput />
  <Checkbox.Control>
    <Checkbox.Indicator />
  </Checkbox.Control>
</Checkbox.Root>
```

Why:

- This keeps visual consistency and focus rings.
- `Checkbox.HiddenInput` preserves proper form semantics.

### B) Use layout primitives for list density and alignment

Doc rows and results sections were migrated to `Stack`, `HStack`, and `Flex`
to control vertical rhythm without Tailwind `space-y-*` classes.

Examples:

- `space-y-6` → `<Stack gap="1.5rem">`
- `flex items-center justify-between` → `<Flex align="center" justify="space-between">`
- `flex-wrap` → `flexWrap="wrap"` (note: use `flexWrap`, not `wrap`)

### C) Use Text/Heading components + explicit font props

The current `text` recipe has no variants, so the safe pattern is:

- `fontSize="sm"`, `fontWeight="semibold"`, `color="black.a7"` on `Text`
- `fontSize="2xl"` on `Heading` for titles

Avoid relying on `textStyle` unless recipes are updated.

### D) “Inline class” cleanup often cascades

In docs index, removing Tailwind classes in “leaf” components required
touching supporting primitives:

- `PathEditor` used a Tailwind popover and chip layout → migrated to
  `Button`, `Text`, `HStack`, and updated `Popover` to accept `style`.
- `Modal` was still Tailwind-based → migrated to `Box` layout with
  semantic borders and backdrop.

Expect to update shared primitives as you migrate a surface.

### E) Avoid `Box as="select"` unless typed wrapper exists

If you need a dropdown, prefer Ark `Select` (see the section above) so you get
consistent styling + keyboard/menu UX. `Box as="select"` can be tempting, but
it’s easy to run into typing gaps for native form props (`value`, `onChange`,
etc.) depending on the element and wrapper type.

### F) Prefer ParkUI buttons for small action chips

Meta chips, path filters, and suggestion pills were all standardized to:

```tsx
<Button size="xs" variant="outline">
  ...
</Button>
```

This keeps spacing and hover states consistent with the rest of the UI.

### G) Notes on color tokens used in migration

The docs index uses semantic-ish tokens currently available:

- `color="black.a7"` for muted text
- `borderColor="gray.outline.border"` for subtle borders
- `bg="gray.surface.bg.hover"` for list item hover

If these tokens feel too dark/light in other surfaces, update the theme
tokens/recipes rather than hardcoding colors in components.

## Additional learnings from Docs Detail + Editor migration

The doc detail surface pulls in the editor, prompt modals, and toolbar, which
introduce a few special cases that weren’t present in the navbar or docs index.

### H) ProseMirror editor needs a dedicated CSS hook

The Tiptap editor content is not built with Panda primitives, so we can’t rely
on `p="4"` / `outline="none"` props. Instead:

- Keep the `prose` class for typography.
- Add a dedicated class like `.editor-prose` in `app/src/app.css` for editor
  padding/outline/max-width and set it via `editorProps.attributes.class`.

This keeps the editor styles centralized and avoids inline utility strings.

### I) ParkUI Select is preferred, even for “small” dropdowns

We replaced native `<select>` in:

- AI prompt model selector
- Code block language picker
- Shared `ModelSelect`

Pattern:

- Build a `createListCollection` from items.
- Use `Select.Root` + `Select.Control` + `Select.Trigger` + `Select.ValueText`.
- Wrap menu content in a `Portal`.

### J) Toolbar buttons: remove Tailwind `class` from config

The editor toolbar had Tailwind classes stored in `toolbarConfig`. To migrate:

- Replace `class` with a small `labelStyle` object (e.g. `fontWeight: "semibold"`).
- Apply styles via Panda props in `ToolbarContents` using `<Box as="span" {...labelStyle}>`.

This avoids Tailwind strings without bloating the toggle component.

### K) Hidden file inputs: prefer inline style over classes

The CSV import input was `class="hidden"`. Use:

```tsx
<input style={{ display: "none" }} ... />
```

This keeps the element hidden without introducing utility classes.

## Additional learnings from Chat Sidebar (LLM) migration

Migrating the chat interface (`LLMSidebar`) surfaced a few Ark/ParkUI patterns
that are easy to get subtly wrong in Solid.

### A) Use `Drawer` instead of custom “side panel” components

The chat “sidebar” is a perfect match for `~/components/ui/drawer`:

- Replace custom overlay/portal/backdrop + scroll locking with `Drawer.Root`.
- Use `Drawer.Backdrop`, `Drawer.Positioner`, `Drawer.Content`, and
  `Drawer.CloseTrigger`.
- Keep the layout inside the drawer composed with Panda primitives
  (`Flex`, `Box`, `Stack`, `HStack`, `Spacer`) and ParkUI controls.

### B) Ark `ScrollArea` gotcha in Solid: don’t auto-inject `<Thumb />` via `defaultProps`

We hit this runtime error:

- `useScrollAreaScrollbarContext returned undefined`

Root cause: in Solid, using `defaultProps` to inject a `<Thumb />` child inside
the styled wrapper can create a component instance that isn’t actually within
the `Scrollbar` provider when it renders (context ends up `undefined`).

Practical rule:

- Don’t “magically” add `<ScrollArea.Thumb />` via wrapper `defaultProps`.
- Instead, render it explicitly at call sites:

```tsx
<ScrollArea.Scrollbar orientation="vertical">
  <ScrollArea.Thumb />
</ScrollArea.Scrollbar>
```

This keeps the provider chain correct and avoids fragile wrapper behavior.

### C) Prefer Panda’s `lineClamp` over vendor-prefixed CSS in `css(...)`

If you need “2-line truncate” in a thread preview, don’t reach for
`WebkitLineClamp`/`WebkitBoxOrient` keys (they may not be typed in
`SystemStyleObject`). Use Panda’s built-in:

- `lineClamp: "2"`

## Additional learnings from UMAP + Embeddings migration

These came up when migrating:

- `app/src/routes/umap/index.tsx`
- `app/src/routes/umap/[id].tsx`
- `app/src/routes/embeddings/index.tsx`
- `app/src/routes/embeddings/[id].tsx`

### H) Prefer a store for “form-y pages” with many related fields

Both UMAP and Embeddings pages had many related inputs/toggles. Migration was a good time to switch from a long stack of signals to a single `createStore` state object.

Why:

- Easier to pass around and reset groups of fields
- Fewer “signal soup” updates
- Reads more like a coherent form

### I) Tables: use `~/components/ui/table` + a wrapper `Box` for borders/overflow

The table primitive is just the table slots. For the common “rounded card + clipped header” look:

- Wrap in a `Box` that sets `borderWidth`, `borderColor`, `borderRadius`, and `overflow="hidden"`.
- Put `Table.Root` inside.

### J) Navigation: prefer `~/components/ui/link` for internal links; use `navigate()` for imperative

- Replace Tailwind-styled `<A>` / `<a>` with `Link` where possible.
- For “Open” buttons that need to navigate programmatically, prefer `useNavigate()` over `window.location.assign(...)`.

### K) Keep resource discipline: wrap resource-driven regions in `Suspense`

When lists or selects depend on `createResource` (runs lists, embedding runs list):

- Use `<Suspense fallback={...}>` as the loading gate.
- Inside `Suspense`, use `Show` for the conditional branches.

### L) Canvas/ResizeObserver cleanup pattern

When a page needs a `ResizeObserver` (UMAP detail canvas), the clean pattern is:

- Create the observer inside `onMount`
- Return cleanup from `onMount` (disconnect observer)
- Use `entry.contentRect` for robust sizing (avoids `contentBoxSize` typing and `as any` casts)

## Additional learnings from Visual Canvas migration

The visual canvas surface includes a fixed canvas, a left control panel, and a
right-side document panel. The migration introduced a few new patterns worth
reusing.

### M) Wrap resource-driven canvas + controls in `Suspense`

Both the canvas and the control panel depend on resources (docs, UMAP runs).
Use `Suspense fallback={null}` around those regions instead of gating with
`Show` so the resource discipline is preserved.

### N) Replace fixed-position shells with Panda `Box` + inline style escape hatches

For overlay shells (`position: fixed` + `backdrop-filter`), use `Box` props
for layout and add inline `style` only for properties not in Panda tokens
(`backdrop-filter`, translucent white backgrounds).

Example pattern:

```tsx
<Box
  position="fixed"
  bg="bg.default"
  borderColor="border"
  borderRightWidth="1px"
  style={{ background: "rgba(255,255,255,0.95)", "backdrop-filter": "blur(10px)" }}
/>
```

### O) List rows: compute derived label once per row

The control panel list includes a “distance + direction” label. Use a
`createMemo` inside the `<For>` row scope instead of an IIFE in JSX to keep
render logic clean and reactive.

### P) Prefer `Select` for layout/sort modes, not native `<select>`

The control panel replaced native selects with ParkUI `Select`:

- Use `createListCollection` for options
- `value` is always a string array
- Wrap menu content in `Portal`

This keeps the UI consistent with other migrated surfaces and avoids native
select styling drift.

### Q) Use `Text as="span"` for inline text in overlays/tooltips

For hover labels and tooltip-like UI, wrap the text in `Text as="span"` inside
a `Box`. This avoids invalid block nesting and keeps typography consistent with
theme tokens.
