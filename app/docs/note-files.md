# Note files (attachments)

A note can keep any file: a PDF, spreadsheet, slide deck, zip, recording. Each one is a `fileAttachment` block, shown as a card with the file's type, size, and Open/Download actions. Pictures still go through [note-images.md](note-images.md) so they show inline.

## Storage and serving

- Bytes are stored once under their SHA-256 in `DOC_FILE_STORAGE_DIR` (default `app/data/doc-files`, no extension), written to a temp file and renamed so a reader never sees half a file. `src/server/lib/doc-file-store.ts` owns this.
- A note points at `/api/doc-files/<sha256>/<file name>`. The name in the path is the download name, so the same bytes can be attached under different names without a second copy.
- `GET` (`src/routes/api/doc-files/[hash]/[name].ts`) picks the type from the name through an allowlist (`docFileHeaders`): PDFs and audio/video open in the browser, text shows as `text/plain`, and everything else, HTML and SVG included, downloads as `application/octet-stream`. Responses carry `nosniff`, a sandbox CSP (except PDFs, which Chrome won't render sandboxed), an `etag`, and Range support. `?download=1` always downloads.
- Like `/api/doc-images`, a file path is a capability URL: `GET` works without sign-in (`src/middleware.ts`) so shared notes can download their files. Uploading needs sign-in.
- Limit: 50 MB per file (`DOC_FILE_MAX_BYTES` in `src/services/doc-files/doc-files.shared.ts`). `POST /api/doc-files` takes raw bytes with the name in `x-file-name` (URI-encoded), or JSON `{ url, name? }` to copy a public file through `fetchPublicFile`.

## In the editor

| Way in                      | What happens                                                   |
| --------------------------- | -------------------------------------------------------------- |
| Drop or paste files         | Pictures go to the image flow; every other file becomes a card |
| A lone `.csv` / `.tsv` file | Left to the CSV prompt (table or text)                         |
| `/file` slash command       | File picker for any type                                       |
| Double-click a card's name  | Rename it in place (the download name stays the stored one)    |

`FilePaste` (`components/editor/extensions/FilePaste.ts`) runs ahead of `ImagePaste`, so a drop of a PDF and a screenshot keeps both. While a file uploads, a decoration placeholder shows real progress (XHR); it is not a node, so a half-uploaded file never reaches the saved note. Failed uploads offer Retry and Remove. Uploads land where `blockAnchor` (`components/editor/core/blockAnchor.ts`) says, shared with images: between blocks, and before a trailing empty line at the end of the note.

## In note content

- The schema node is `lib/note-content/file-attachment.ts` (`src`, `name`, `mime`, `size`); its stored HTML is a plain `<a download>` link inside `div[data-file-attachment]`, which read-only views style in `src/panda.css`.
- In markdown it is `[name](/api/doc-files/…)` alone on its line (`toMarkdown` writes it, `fromNoteMarkdown` reads it back). A file link inside a sentence stays a link.
- The file's name is in the note's plain text, so search finds notes by attachment name.
- Agents attach through `notes_attach_file` ([mcp-connector.md](mcp-connector.md#files)). If ChatGPT cannot attach a file, see [the troubleshooting table](mcp-connector.md#when-chatgpt-cannot-attach-a-file).
