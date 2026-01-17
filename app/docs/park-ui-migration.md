# ParkUI + PandaCSS migration guide (from Tailwind)

This guide documents the concrete changes made to migrate the app navbar from
Tailwind utility classes to **ParkUI-style components** (Ark UI + Panda recipes)
and **PandaCSS** (`styled-system`) props. Follow the same patterns for other
pages/components.

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
