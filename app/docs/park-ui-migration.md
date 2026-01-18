# ParkUI + PandaCSS migration guide (from Tailwind)

This guide documents the concrete patterns used to migrate the app navbar and docs index experience from Tailwind utility classes to **ParkUI-style components** (Ark UI + Panda recipes) and **PandaCSS** (`styled-system`) props. Apply the same patterns to other pages/components.

## Goals and constraints

- **No Tailwind utility strings** in migrated components.
- **Prefer existing `~/components/ui/*` primitives** (they wrap Ark UI + Panda recipes).
- **Use Panda layout primitives** from `styled-system/jsx` (`Box`, `HStack`, `Container`, etc.) instead of `div` + class strings.
- **Solid guidelines**

  - Prefer `Show` over `&&`
  - If a value depends on resources, gate with `Suspense` fallback
  - Avoid inline handlers when they’re more than trivial (name the function)
  - Prefer named exports for new/updated components

---

## Core migration pattern (repeatable workflow)

Use this workflow for each component/surface:

1. **Identify structure**

   - Layout groups (header/content/footer), main regions, and key alignment rules.

2. **Replace structural wrappers first**

   - Swap `div + class` → `styled-system/jsx` primitives:

     - `Container`, `Box`, `Stack`, `HStack`, `VStack`, `Flex`, `Spacer`

3. **Swap interactive controls**

   - Replace native elements / ad-hoc styled ones with `~/components/ui/*`:

     - `Button`, `Link`, `Input`, `Checkbox`, `Drawer`, `Select`, etc.

4. **Replace “special classes” and one-off patterns**

   - If you had “semantic” Tailwind classes like `cta`, migrate them to:

     - an existing recipe variant, or
     - a small wrapper using `styled(...)` + the shared recipe

5. **Convert remaining utilities to Panda props**

   - Prefer semantic tokens (`bg.*`, `fg.*`, `border`) over hardcoded values.

6. **Preserve Solid correctness**

   - `Show` for conditional UI
   - `Suspense` for resource-driven regions
   - avoid prop destructuring

---

## Navbar migration (concrete changes)

### 1) Replace Tailwind `class="..."` with Panda layout + style props

**Before (Tailwind):**

```tsx
<nav class="w-full border-b border-gray-200 bg-white">
  <div class="container mx-auto px-4 py-3 flex items-center justify-between">
    ...
  </div>
</nav>
```

**After (Panda primitives + semantic tokens):**

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

- **Semantic tokens** (`bg="bg.default"`, `borderColor="border"`) come from `app/panda.config.ts`, keeping components theme-aware.
- **Composable layout primitives**

  - `HStack` replaces `flex items-center ...`
  - `Spacer` replaces `justify-between`
  - `Container` replaces `container mx-auto ...`

### 2) Prefer `~/components/ui/*` over raw `<a>` / `<button>`

Replace:

- `<a href="...">` → `<Link href="...">`
- `<button onClick={...}>` → `<Button onClick={...}>`

Why:

- Centralized hover/focus/spacing/typography behavior via recipes in `app/src/theme/recipes/*`.
- Consistent variants (`plain`, `outline`, `solid`) and sizing.

### 3) Replace ad-hoc `cta` classes with recipe-driven buttons/links

If the navbar used `class="cta"` for auth actions:

- Use `Button` for button semantics.
- For “button-looking links”, create a local wrapper using the **same `button` recipe**.

Pattern:

```tsx
import { ark } from "@ark-ui/solid/factory";
import { styled } from "styled-system/jsx";
import { button } from "styled-system/recipes";

const CtaLink = styled(ark.a, button);
```

Usage:

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

Why:

- Anchor and button share the same styling system.
- Semantics stay correct (navigation uses `<a>`, actions use `<button>`).

### 4) Images: prefer `Image` over `Box as="img"`

This fails because `BoxProps` don’t include `src`:

```tsx
<Box as="img" src="..." />
```

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

### 5) Keep Solid resource discipline (`Suspense` + `Show`)

If regions depend on resources (e.g. `hasUnreadAny()` / `hasLoadingAny()`):

- Wrap indicator areas in `Suspense fallback={null}`
- Use `Show` for conditional UI

Migration should only change styling/layout, not reactivity discipline.

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

### 7) Prefer named exports; update imports

Change:

- `export default Navbar` → `export const Navbar = ...`

Update imports:

```tsx
import { Navbar } from "~/components/Navbar";
```

---

## Tailwind → Panda mapping cheatsheet

Use this as a starting point when migrating other components.

- **Layout**

  - `flex items-center` → `<HStack>` (or `<Flex align="center">`)
  - `flex flex-col` → `<Stack>` / `<VStack>`
  - `justify-between` → `<HStack> ... <Spacer /> ... </HStack>`
  - `gap-2` → `gap="2"`
  - `p-4` → `p="4"` (or `px="4"` / `py="3"`)
  - Note: `HStack` uses `alignItems`, not `align`. (`Flex` supports `align`.)

- **Sizing**

  - `w-full` → `w="full"`
  - `h-10` → `h="10"`
  - `h-2 w-2` → `boxSize="2"`

- **Borders + radius**

  - `border-b` → `borderBottomWidth="1px"`
  - `rounded` / `rounded-md` → `borderRadius="l2"` (use semantic radii)

- **Color**

  - `bg-white` → `bg="bg.default"`
  - `text-gray-600` → `color="fg.muted"`
  - `border-gray-200` → `borderColor="border"`

- **Typography**

  - `text-sm` → `textStyle="sm"`
  - `font-semibold` → `fontWeight="semibold"`
  - `tracking-tight` → `letterSpacing="tight"`

---

## Ark/ParkUI Select wrapper gotcha (type-level)

When migrating places like `app/src/routes/ai/index.tsx`:

- Ark Select does **not** accept `items` on `Select.Root`.
- It requires a `collection` created by `createListCollection`.

Guidance:

- Build a collection and pass it to `Select.Root`.
- `value` is always a string array (even for single-select).

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

Additional notes (from `src/routes/umap/*` and `src/routes/embeddings/*`):

- **Value shape:** always `string[]`. Read with `details.value[0] ?? ""`.
- **Collections and resources:** if items come from a resource:

  - create the collection from resource output
  - render `<Select.Item item={item}>` from the collection’s `items`

---

## Component-by-component checklist

Use this checklist for each migrated component:

- Inventory UI pieces

  - layout groups
  - controls
  - popovers/modals/drawers

- Replace layout wrappers with Panda primitives

  - `Box`/`Stack`/`HStack`/`Flex`/`Container`

- Swap controls to `~/components/ui/*`

  - `Button`, `Input`, `Checkbox`, `Select`, `Drawer`, etc.

- Convert remaining Tailwind to Panda props

  - prefer semantic tokens

- Verify typography and density

  - `Text`/`Heading` props, spacing rhythm

- Check interaction states

  - hover, focus, disabled, spacing

---

# Surface-specific learnings

These sections capture patterns discovered during real migrations. Keep them as reference when you hit similar UI types.

## Docs Index migration

The docs index includes filters, rows, popovers, modals, and a nested path sidebar.

### DI-1) Prefer ParkUI inputs/checkboxes over native elements

Replace:

- native `<input>` → `~/components/ui/input`
- native checkbox → `~/components/ui/checkbox`

Row pattern:

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

- Consistent focus rings and visuals.
- `HiddenInput` preserves form semantics.

### DI-2) Use layout primitives for list density and alignment

Examples:

- `space-y-6` → `<Stack gap="1.5rem">`
- `flex items-center justify-between` → `<Flex align="center" justify="space-between">`
- `flex-wrap` → `flexWrap="wrap"` (use `flexWrap`, not `wrap`)

### DI-3) Text/Heading usage: be explicit if recipes don’t support variants

If the current `text` recipe has no variants, use explicit props:

- `fontSize="sm"`, `fontWeight="semibold"`, `color="black.a7"` on `Text`
- `fontSize="2xl"` on `Heading`

Avoid relying on `textStyle` unless recipes are updated.

### DI-4) Removing inline classes can cascade into shared primitives

Removing Tailwind from leaf components may require updating shared pieces:

- `PathEditor` (popover + chip layout) → migrate to `Button`, `Text`, `HStack`, and update `Popover` to accept `style`.
- `Modal` still Tailwind-based → migrate to `Box` layout with semantic borders/backdrop.

### DI-5) Avoid `Box as="select"` unless a typed wrapper exists

Prefer Ark/ParkUI `Select` for styling + keyboard/menu UX.
`Box as="select"` can hit typing gaps for native props.

### DI-6) Use ParkUI buttons for small action chips

Standardize chips/pills to:

```tsx
<Button size="xs" variant="outline">
  ...
</Button>
```

### DI-7) Notes on color tokens used in migration

Tokens used:

- `color="black.a7"` for muted text
- `borderColor="gray.outline.border"` for subtle borders
- `bg="gray.surface.bg.hover"` for list hover

If they feel off in other surfaces, adjust theme tokens/recipes rather than hardcoding.

---

## Docs Detail + Editor migration

The doc detail surface includes the editor, prompt modals, and toolbar.

### DE-1) ProseMirror editor needs a dedicated CSS hook

Tiptap content isn’t composed from Panda primitives.

Pattern:

- Keep the `prose` class.
- Add a class like `.editor-prose` in `app/src/app.css` for padding/outline/max-width.
- Apply it via `editorProps.attributes.class`.

This centralizes editor styling and avoids inline utility strings.

### DE-2) Prefer ParkUI Select even for “small” dropdowns

Used for:

- prompt model selector
- code block language picker
- shared `ModelSelect`

Pattern:

- `createListCollection`
- `Select.Root` + `Select.Control` + `Select.Trigger` + `Select.ValueText`
- menu content inside `Portal`

### DE-3) Toolbar buttons: remove Tailwind strings from config

If `toolbarConfig` stored Tailwind classes:

- Replace `class` with a small `labelStyle` object (e.g. `{ fontWeight: "semibold" }`)
- Apply via Panda props: `<Box as="span" {...labelStyle}>`

### DE-4) Hidden file inputs: use inline style instead of Tailwind

If you had `class="hidden"`:

```tsx
<input style={{ display: "none" }} ... />
```

---

## Chat Sidebar (LLM) migration

Migrating `LLMSidebar` surfaced Ark/ParkUI patterns that are easy to get subtly wrong in Solid.

### CS-1) Use `Drawer` instead of custom side panel shells

Replace custom overlay/portal/backdrop/scroll locking with `~/components/ui/drawer`:

- `Drawer.Root`
- `Drawer.Backdrop`, `Drawer.Positioner`, `Drawer.Content`, `Drawer.CloseTrigger`

Compose inner layout with Panda primitives + ParkUI controls.

### CS-2) Ark `ScrollArea` gotcha in Solid: don’t inject `<Thumb />` via `defaultProps`

Runtime error encountered:

- `useScrollAreaScrollbarContext returned undefined`

Rule:

- Don’t “magically” add `<ScrollArea.Thumb />` via wrapper `defaultProps`.
- Render explicitly at call sites:

```tsx
<ScrollArea.Scrollbar orientation="vertical">
  <ScrollArea.Thumb />
</ScrollArea.Scrollbar>
```

### CS-3) Prefer Panda’s `lineClamp` over vendor-prefixed CSS in `css(...)`

For 2-line truncation:

- use `lineClamp: "2"`
- avoid `WebkitLineClamp` / `WebkitBoxOrient` keys (may not be typed)

---

## UMAP + Embeddings migration

Migrated routes:

- `app/src/routes/umap/index.tsx`
- `app/src/routes/umap/[id].tsx`
- `app/src/routes/embeddings/index.tsx`
- `app/src/routes/embeddings/[id].tsx`

### UE-1) Prefer a store for form-heavy pages

When many related inputs/toggles exist:

- switch from many signals → one `createStore` state object

Why:

- simpler resets and passing state
- fewer signals
- clearer “form state” shape

### UE-2) Tables: use `~/components/ui/table` plus a wrapper Box for borders/overflow

Pattern:

- Wrap in `Box` that sets:

  - `borderWidth`, `borderColor`, `borderRadius`, `overflow="hidden"`

- Put `Table.Root` inside

### UE-3) Navigation: prefer `Link` for declarative, `navigate()` for imperative

- Replace Tailwind-styled `<A>` / `<a>` with `Link` where possible.
- For imperative flows, prefer `useNavigate()` over `window.location.assign(...)`.

### UE-4) Resource discipline: wrap resource-driven regions in `Suspense`

Lists/selects driven by `createResource`:

- gate with `<Suspense fallback={...}>`
- inside, use `Show` for branch rendering

### UE-5) Canvas/ResizeObserver cleanup pattern

When using `ResizeObserver` (UMAP detail canvas):

- create observer inside `onMount`
- return cleanup from `onMount` (disconnect)
- use `entry.contentRect` for sizing (avoids typing trouble and `as any`)

---

## Visual Canvas migration

Includes fixed canvas + left controls + right document panel.

### VC-1) Wrap resource-driven canvas + controls in `Suspense`

If canvas and controls depend on resources (docs, runs):

- use `Suspense fallback={null}` around those regions
- prefer this over gating with `Show` alone

### VC-2) Fixed-position shells: Panda `Box` plus inline style escape hatches

For `position: fixed` + backdrop blur:

- use Panda props for layout
- inline `style` only for things not covered well by tokens (e.g. `backdrop-filter`)

```tsx
<Box
  position="fixed"
  bg="bg.default"
  borderColor="border"
  borderRightWidth="1px"
  style={{
    background: "rgba(255,255,255,0.95)",
    "backdrop-filter": "blur(10px)",
  }}
/>
```

### VC-3) List rows: compute derived label once per row

For “distance + direction” labels:

- use a `createMemo` inside each `<For>` row scope
- avoid IIFEs inside JSX

### VC-4) Prefer `Select` for modes/sorts (avoid native `<select>` drift)

- `createListCollection`
- `value` is always `string[]`
- menu content in `Portal`

### VC-5) Inline overlay text: use `Text as="span"`

For tooltip-like labels:

- wrap inline text with `Text as="span"` inside a `Box`
- avoids invalid block nesting and keeps typography consistent
