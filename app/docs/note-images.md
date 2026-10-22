# Note images (paste, drop, upload)

Every image in a note should point at `/api/doc-images/<sha256>.<ext>`: content-addressed files under `DOC_IMAGE_STORAGE_DIR` (default `app/data/doc-images`). A note never keeps base64, and never depends on another site staying up or letting us in.

## How an image arrives

| Source                                   | What the clipboard/drop holds       | What happens                                                  |
| ---------------------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| Screenshot, Finder copy, file drop       | An image file                       | Uploaded; a local preview stands in until it lands            |
| Browser "Copy image"                     | The file plus `<img src=site>` HTML | The file wins (`pickImageFilesToUpload`)                      |
| Page selection (ChatGPT, Docs, articles) | HTML with text and `<img>` tags     | Normal HTML paste, then each image is copied in by the server |
| Inline `data:` / `blob:` images in HTML  | HTML                                | The browser reads the bytes and uploads them                  |
| Markdown paste with `![](url)`           | Text                                | Same as HTML images (`IMPORT_IMAGES_META`)                    |
| `/image` slash command                   | File picker                         | Uploaded like a paste                                         |
| Paste or drop onto a selected image      | An image file                       | Swaps that image's picture, keeping alt and width             |

Code lives in `src/components/editor/images/` (transfer parsing, convert/shrink, upload client, plugin state, placeholder DOM) and `src/components/editor/extensions/ImagePaste.ts`. The upload route is `POST /api/doc-images` (`src/routes/api/doc-images/index.ts`): raw bytes, or JSON `{ url }` to import. Both go through `src/server/lib/doc-image-store.ts`, which the MCP connector shares.

## Rules worth keeping

- The server sniffs bytes and stores raster formats only (no SVG: it could run script from our origin). The client redraws TIFF/SVG as PNG and re-encodes anything over 10 MB (WebP, then smaller sizes) before upload.
- URL imports use `fetchPublicFile`, which refuses loopback and private networks at connect time.
- Placeholders wait between blocks, not inside a paragraph: inserting an image into an empty paragraph replaces it, which would delete the other placeholders' spot. Pastes split the line at the caret; drops snap to the nearer edge.
- Uploads run in parallel but insert in paste order.
- Swapping an imported src is not added to undo history, so one undo removes the whole paste.
- An image that will not load (expired signature, a site behind login such as ChatGPT's `estuary` links) shows a Retry/Replace card. Failed srcs are remembered per tab because the node view is rebuilt on note refresh and the new `<img>` may not fire `error` again.
