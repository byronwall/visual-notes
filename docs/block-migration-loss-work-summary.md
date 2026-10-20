# Block migration loss investigation

## Scope and context

The production dry run flagged 3,967 of 6,317 notes for text loss or conversion errors.
This investigation checks the measurement and samples the original import files.

## Major changes

The old Markdown baseline removed a few punctuation characters. It still counted link destinations, image paths, heading underlines, and table syntax.
The converted baseline counted visible text only. This caused false loss warnings.

The new baseline renders Markdown, removes HTML markup, and decodes text entities before counting.
HTML document metadata does not count. Text counts still exclude whitespace.
A regression test simulates lost conversion text to check that the baseline remains independent.

A broader import sample exposed real URL loss in empty links such as `[](https://example.com/)`.
ProseMirror cannot store a link mark without a text node. Conversion now uses the URL as its label.
This applies to empty HTML anchors with an href too. Named anchors without an href remain empty.

## Sample evidence

Source: existing files in `cli-ingest/out/notes-md/` in the main project checkout.
The converter prefers stored HTML when present. These samples reproduce the Markdown branch exactly.

For inline images, the probe replaced embedded data with `/api/doc-images/<64-character-placeholder-hash>.jpg`.
This matches deployed URL lengths. It does not validate deployed image files or their bytes.

All ten selected files reproduce the screenshot counts exactly:

| Note | Old count | Corrected count | Loss |
| --- | --- | --- | --- |
| Live Stream From the Namib Desert | 208 → 105 | 105 → 105 | 0% |
| On Talent | 104 → 51 | 51 → 51 | 0% |
| Bible app, notes and feedback | 580 → 467 | 467 → 467 | 0% |
| The Nuclear Bomb Computer Slide Rule | 192 → 93 | 93 → 93 | 0% |
| Van work | 127 → 119 | 119 → 119 | 0% |
| Context7 MCP server was highly recommended by Syntax folks | 261 → 149 | 149 → 149 | 0% |
| A better square, cool invention | 324 → 70 | 70 → 70 | 0% |
| Honda brake pads - front and rear and flush | 5486 → 4914 | 4914 → 4914 | 0% |
| Camping tasks and notes | 2374 → 2007 | 2007 → 2007 | 0% |
| Saved Photo | 112 → 13 | 13 → 13 | 0% |

Each sample preserves its visible text, link targets, and image references.
A separate 100-file import sample had 86 old warnings and no corrected warnings or text/reference differences.

The initial mixed-source 200-file probe also found empty links, a split anchor, and an image without a source.
The empty-link fix preserves the URLs. Split anchors retain their destination. An image without a source has no file reference to preserve.

## Design decisions and tradeoffs

Use existing Markdown, HTML, and block conversion tools. Add no dependencies.
Flatten HTML before decoding text. This prevents unsupported node types from silently vanishing from the baseline.
Keep the existing 2% threshold and migration write behavior.
The count measures text length; it cannot prove complete structural or asset preservation.

## Problems and resolutions

The live connector timed out. Chrome first stalled on note loading, then showed `ERR_BLOCKED_BY_CLIENT`.
A direct server request also timed out. The local audit database contained no notes.
Original import files provided reproducible samples without changing production data.

Type checking first failed because this clean checkout lacked generated Panda files.
`pnpm panda` resolved that setup issue.

## Verification

- Focused conversion and migration tests pass.
- Shared converter caller tests cover MCP Markdown output and projections.
- `pnpm lint`: no errors; 130 existing warnings.
- `pnpm type-check`: passes after Panda generation.
- `git diff --check`: passes.
- Playwright captured a rendered conversion fixture for the PR. It is not a production UI screenshot.

## Process and agent improvements

Compare semantic text with semantic text. Check link and image attributes separately.
Use original import files when the live service is unavailable. State where placeholder URLs were used.
Do not infer that all production warnings are false from a sample.

No instruction-file changes were needed.

## Follow-ups and open risks

Run the full dry run after deployment and inspect any remaining warnings.
The live database and image files were not verified. No production conversion was run.
