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

<Select.Root collection={collection}>
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
