# TipTap Feature Inventory (Current Usage)

This document captures the **current, in-repo TipTap feature usage** before refactoring.
It focuses on what is actually wired today and highlights custom augmentations likely to be replaced by NodeViews.

## Scope and versions

- Runtime wrapper: `solid-tiptap@0.8.0`
- Core: `@tiptap/core@^3.7.2`
- Main editor assembly: `/Users/byronwall/Projects/visual-notes/app/src/components/TiptapEditor.tsx`
- Extension registry: `/Users/byronwall/Projects/visual-notes/app/src/components/editor/extensions/index.ts`

## Where TipTap is instantiated

1. Primary document editor
- `/Users/byronwall/Projects/visual-notes/app/src/components/DocumentEditor.tsx`
- Uses `TiptapEditor` for note editing, save flows, dirty tracking, and selection restore after save.

2. AI result editable modal
- `/Users/byronwall/Projects/visual-notes/app/src/components/editor/ui/AiResultEditorModal.tsx`
- Uses `TiptapEditor` to edit generated output, then copy markdown/html/text.

3. AI chat sidebar message editor
- `/Users/byronwall/Projects/visual-notes/app/src/components/ai/LLMSidebar.tsx`
- Renders each message in `TiptapEditor` (toolbar hidden), tracks per-message dirty state, supports save/delete.

## Extension stack (enabled)

Configured in `/Users/byronwall/Projects/visual-notes/app/src/components/editor/extensions/index.ts`.

1. `StarterKit` with overrides
- `StarterKit.configure({ codeBlock: false, code: false })`
- Meaning: default `code` and `codeBlock` are disabled and replaced by custom extensions below.
- Implicit capabilities still active through StarterKit (not all are toolbar-exposed):
  - Document, paragraph, text nodes
  - Bold, italic, strike mark handling from StarterKit set
  - Link mark support from StarterKit defaults
  - Heading (all levels available at schema level; toolbar exposes H1/H2 only)
  - Bullet/ordered lists and list item behavior (including list keymaps)
  - Blockquote
  - Horizontal rule
  - Hard break
  - Dropcursor and gapcursor
  - History (undo/redo via keyboard shortcuts)

2. `Highlight`
- Enabled via `Highlight.configure({})`.
- Exposed in toolbar (`toggleHighlight`).

3. `CustomImage` (extends TipTap Image)
- Base64 allowed: `CustomImage.configure({ allowBase64: true })`
- Adds custom NodeView (see custom augmentation section).

4. `Emoji`
- Uses `gitHubEmojis`, emoticons enabled.
- Uses custom suggestion renderer via `createEmojiSuggestion(...)`.

5. `CustomCode` (extends TipTap inline code)
- Overrides attributes to force `spellcheck=false` rendering.

6. `CustomCodeBlock` (extends code-block-lowlight)
- Lowlight configured with `common` grammars.
- Overrides attributes to include `spellcheck=false`.
- Integrates with custom language overlay UI in `TiptapEditor`.

7. Table suite
- `Table.configure({ resizable: true, lastColumnResizable: true, allowTableNodeSelection: true })`
- `TableRow`, `TableHeader`, `TableCell` added.

8. `CsvPaste` custom extension
- ProseMirror paste/drop/file interception for CSV/TSV handling.

9. `MarkdownPaste` custom extension
- ProseMirror paste interception for markdown detection + conversion.

## Feature surface (what users can do)

### Text/formatting blocks and marks

From toolbar config:
- Paragraph
- Heading 1
- Heading 2
- Bold
- Italic
- Strike
- Highlight
- Inline code
- Bullet list
- Ordered list
- Blockquote
- Code block

Command execution path:
- `ToolbarContents` -> `Control` -> `exec()` -> `editor.chain().focus()....run()`
- Files:
  - `/Users/byronwall/Projects/visual-notes/app/src/components/editor/toolbar/toolbarConfig.ts`
  - `/Users/byronwall/Projects/visual-notes/app/src/components/editor/core/exec.ts`

### Tables

Toolbar actions exposed:
- Insert table (3x3, header row on)
- Add row
- Add column
- Delete row
- Delete column
- Delete table
- Import CSV file as table
- Force paste clipboard as table (CSV/TSV)

Implementation:
- `/Users/byronwall/Projects/visual-notes/app/src/components/editor/toolbar/ToolbarContents.tsx`
- Uses table chain commands and CSV utilities.

### Markdown insertion

Manual control:
- Force paste clipboard as markdown (toolbar button).

Automatic control:
- `MarkdownPaste` intercepts paste when markdown is detected and either:
  - inserts formatted HTML (`normalizeMarkdownToHtml`) or
  - inserts raw text
  - optionally prompts user first.

Files:
- `/Users/byronwall/Projects/visual-notes/app/src/components/editor/extensions/MarkdownPaste.ts`
- `/Users/byronwall/Projects/visual-notes/app/src/components/editor/ui/MarkdownPrompt.tsx`
- `/Users/byronwall/Projects/visual-notes/app/src/server/lib/markdown.ts`

### CSV/TSV ingestion

Automatic detection paths:
- Clipboard MIME `text/csv`
- Plain text heuristics via `isProbablyCSV(...)`
- Dropped files with csv/tsv-related MIME/extensions

Insert behaviors:
- Convert to TipTap table JSON (`csvTextToTableJson`) and insert content, or
- Insert as plain text, based on user prompt choice.

Files:
- `/Users/byronwall/Projects/visual-notes/app/src/components/editor/extensions/CsvPaste.ts`
- `/Users/byronwall/Projects/visual-notes/app/src/components/editor/csv/csvUtils.ts`

### Emoji autocomplete

- Triggered by emoji extension suggestion flow.
- Custom popup rendering with Tippy + manual DOM list.
- Keyboard support: `ArrowUp`, `ArrowDown`, `Enter`, `Tab`, `Escape`.
- Pointer hover + click selection supported.

Files:
- `/Users/byronwall/Projects/visual-notes/app/src/components/editor/extensions/emojiSuggestion.ts`

### Image support

- Image node enabled (base64 allowed).
- Custom NodeView renders `<img>` directly.
- Double-click image opens image preview modal.
- Selection style support relies on `ProseMirror-selectednode` class applied directly to `<img>`.

Files:
- `/Users/byronwall/Projects/visual-notes/app/src/components/editor/extensions/CustomImage.tsx`
- `/Users/byronwall/Projects/visual-notes/app/src/components/editor/ui/ImagePreviewModal.tsx`
- `/Users/byronwall/Projects/visual-notes/app/src/components/TiptapEditor.tsx` (selected image ring CSS)

### Code block language UI

- When selection is inside a code block, a floating overlay appears.
- Overlay offers language selection (`updateAttributes("codeBlock", { language })`).
- Position tracks selection/transaction/resize/scroll.

Files:
- `/Users/byronwall/Projects/visual-notes/app/src/components/editor/core/useCodeBlockOverlay.ts`
- `/Users/byronwall/Projects/visual-notes/app/src/components/TiptapEditor.tsx`

## Custom augmentations (non-default TipTap behavior)

These are the main “we built our own behavior on top of TipTap” areas.

1. Custom image NodeView + modal preview
- Replaces default image rendering path.
- Adds editor-integrated double-click preview interaction.
- Creates/destroys a Solid-rendered modal host manually (`render(...)` into `document.body`).
- Likely NodeView refactor target: high.

2. CSV smart paste/drop/file pipeline
- Custom ProseMirror plugin extension, not stock TipTap behavior.
- Heuristic delimiter consistency analysis and modal user choice.
- Integrates parser -> TipTap table JSON insertion.
- Likely NodeView refactor target: medium (behavioral, not node rendering).

3. Markdown smart paste pipeline
- Custom ProseMirror plugin extension.
- Markdown MIME + heuristic detection; conditional prompt; HTML conversion path.
- Uses app markdown normalization/sanitization utilities.
- Likely NodeView refactor target: low/medium.

4. Emoji suggestion UI replacement
- Uses TipTap suggestion mechanism but replaces rendering and interactions.
- Custom filtering/scoring and custom popup lifecycle.
- Likely NodeView refactor target: low (not a NodeView; mostly suggestion UI).

5. Custom code/codeBlock attribute extension
- Adds `spellcheck=false` attribute behavior to inline and block code.
- Required because default `StarterKit` code/codeBlock are disabled.

6. Floating code-block language picker overlay
- External overlay derived from current selection and node DOM lookup.
- Depends on direct ProseMirror internals via `as any` access.
- Likely NodeView refactor target: high (good candidate to move into code-block node view UI).

7. Prompt registry bridge for markdown paste
- Global mutable registry (`setMarkdownPrompt` / `getMarkdownPrompt`) used by extension.
- Avoids passing prompt through editor constructor each time.
- Refactor note: this is a custom integration seam outside TipTap defaults.

## Editor-level behavior and lifecycle details

1. Editor creation
- `createTiptapEditor` used with `element`, extension list, class attributes, and initial content.
- Files:
  - `/Users/byronwall/Projects/visual-notes/app/src/components/editor/core/createEditor.ts`

2. Stable editor instance capture
- `TiptapEditor` stores first non-null instance to avoid transaction-driven reactive churn.

3. Prop-to-editor content sync
- `props.initialHTML` changes trigger `setContent(..., { emitUpdate: false })` only when actually changed.

4. Styling hooks
- Editor root classes: `prose editor-prose`.
- Global editor typography and layout in `/Users/byronwall/Projects/visual-notes/app/src/panda.css`.
- Additional in-component CSS for selected image and table styling in `TiptapEditor`.

5. Save/dirty integration (DocumentEditor)
- Dirty is set on TipTap `update` event.
- Save serializes with `editor.getHTML()`.
- Selection snapshot restored after async save.
- Cmd/Ctrl+S captured while editor-focused.

## AI integrations that depend on TipTap data

1. Prompt context extraction
- Builds payload from selected range or full doc:
  - `selection_text`, `selection_html`, `doc_text`, `doc_html`
- File:
  - `/Users/byronwall/Projects/visual-notes/app/src/components/editor/core/selection.ts`

2. Sanitization for payload text
- Data URLs stripped from plain text before prompt submission.

3. AI output editing
- AI output modal uses TipTap instance for user edits and export (HTML/text).

## Direct ProseMirror internals currently used (`as any` touchpoints)

These are sensitive areas during refactor:

1. Plain text insertion path
- `/Users/byronwall/Projects/visual-notes/app/src/components/editor/core/insertContentOrText.ts`
- Uses `editor.view.state.tr.insertText(...)`.

2. Selection/context extraction
- `/Users/byronwall/Projects/visual-notes/app/src/components/editor/core/selection.ts`
- Reads `view.state.selection` directly.

3. Code block overlay positioning
- `/Users/byronwall/Projects/visual-notes/app/src/components/editor/core/useCodeBlockOverlay.ts`
- Uses `view.nodeDOM(...)`, state selection depth traversal.

4. Extension attribute inheritance in custom code/codeBlock
- `/Users/byronwall/Projects/visual-notes/app/src/components/editor/extensions/CustomCode.ts`
- `/Users/byronwall/Projects/visual-notes/app/src/components/editor/extensions/CustomCodeBlock.ts`
- Uses `(this as any).parent?.()`.

## Potential NodeView migration candidates (priority)

1. Code block language selector (highest)
- Current floating overlay can likely become part of a code block node view.
- Would reduce cross-layer selection math and direct DOM probing.

2. Image interactions (highest)
- Current image node view already exists but uses external modal host wiring.
- Refactor opportunity: formalize/update image node view architecture and interaction contracts.

3. Table affordances (medium)
- Current actions are toolbar-driven only; NodeView cell/table controls could replace some custom toolbar commands if desired.

4. Paste pipelines (medium, non-NodeView)
- CSV/markdown handlers may remain plugin-level, but refactor should preserve behavior contracts.

## Behavior contracts to preserve during refactor

1. Markdown paste contract
- If markdown-like text is pasted, user can choose raw text vs formatted insertion.

2. CSV paste/drop contract
- CSV/TSV can be transformed into proper table structure and not just plain text.

3. Image contract
- Images remain selectable as nodes and double-click opens preview modal.

4. Code contract
- Inline code and code blocks render with spellcheck off.
- Code block language remains editable in-editor.

5. AI contract
- Selection-aware context extraction continues to work for prompt execution.

## Not currently used (despite install/wrappers)

1. `createEditorWithPrompts(...)` exists but current `TiptapEditor` path uses `createEditor(...)` + prompt registry bridge.
- File: `/Users/byronwall/Projects/visual-notes/app/src/components/editor/core/createEditor.ts`

## Quick verification checklist after refactor

1. Paste markdown from clipboard with and without `text/html` present.
2. Paste CSV text, paste TSV text, and drop CSV/TSV files.
3. Insert table and run row/column add/delete actions.
4. Insert image, select image, double-click image preview.
5. Enter code block, change language, confirm attribute persists.
6. Trigger emoji suggestion and verify keyboard + pointer selection.
7. Run AI prompt with and without text selection and verify payload behavior.
8. Save document and ensure selection is restored after save.
