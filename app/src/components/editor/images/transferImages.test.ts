import { describe, expect, it } from "vitest";
import {
  htmlIsOnlyImages,
  imageFilesFromTransfer,
  importableImageSrc,
  pickImageFilesToUpload,
} from "./transferImages";

function transfer(opts: {
  files?: File[];
  itemFiles?: File[];
  data?: Record<string, string>;
}): DataTransfer {
  const items = [
    ...(opts.itemFiles ?? []).map((file) => ({
      kind: "file",
      type: file.type,
      getAsFile: () => file,
    })),
    ...Object.keys(opts.data ?? {}).map((type) => ({
      kind: "string",
      type,
      getAsFile: () => null,
    })),
  ];
  return {
    files: opts.files ?? [],
    items,
    getData: (type: string) => opts.data?.[type] ?? "",
  } as unknown as DataTransfer;
}

const png = new File([new Uint8Array([1, 2, 3])], "image.png", {
  type: "image/png",
  lastModified: 1,
});

describe("pickImageFilesToUpload", () => {
  it("uploads a screenshot that arrives as a lone file", () => {
    expect(pickImageFilesToUpload(transfer({ files: [png] }))).toEqual([png]);
  });

  it("finds files only exposed through items (Safari, some Chrome copies)", () => {
    expect(pickImageFilesToUpload(transfer({ itemFiles: [png] }))).toEqual([
      png,
    ]);
  });

  it("does not upload the same file twice when files and items both list it", () => {
    expect(
      imageFilesFromTransfer(transfer({ files: [png], itemFiles: [png] })),
    ).toHaveLength(1);
  });

  it("prefers the file over browser 'Copy image' HTML that points at the site", () => {
    const dt = transfer({
      files: [png],
      data: {
        "text/html":
          '<meta charset="utf-8"><img src="https://example.com/a.png" alt="A">',
      },
    });
    expect(pickImageFilesToUpload(dt)).toEqual([png]);
  });

  it("keeps rich HTML with text (its images are imported after the paste)", () => {
    const dt = transfer({
      files: [png],
      data: {
        "text/html": '<p>Some words</p><img src="https://x.test/a.png">',
      },
    });
    expect(pickImageFilesToUpload(dt)).toBeNull();
  });

  it("accepts HEIC from Finder even with an empty type", () => {
    const heic = new File([new Uint8Array([1])], "IMG_0001.HEIC", { type: "" });
    expect(pickImageFilesToUpload(transfer({ files: [heic] }))).toEqual([heic]);
  });

  it("ignores non-image files and plain text", () => {
    const pdf = new File([new Uint8Array([1])], "a.pdf", {
      type: "application/pdf",
    });
    expect(pickImageFilesToUpload(transfer({ files: [pdf] }))).toBeNull();
    expect(
      pickImageFilesToUpload(transfer({ data: { "text/plain": "hi" } })),
    ).toBeNull();
  });
});

describe("htmlIsOnlyImages", () => {
  it("treats wrappers, comments, styles, and nbsp as empty", () => {
    expect(
      htmlIsOnlyImages(
        '<html><head><style>p{}</style></head><body><!--StartFragment--><p>&nbsp;<img src="a"></p></body></html>',
      ),
    ).toBe(true);
    expect(htmlIsOnlyImages("<p>Caption</p><img src=a>")).toBe(false);
  });
});

describe("importableImageSrc", () => {
  const origin = "https://notes.example.com";

  it("imports data, blob, and other sites' urls", () => {
    expect(importableImageSrc("data:image/png;base64,AAAA", origin)).toBe(
      "data",
    );
    expect(importableImageSrc("blob:https://notes.example.com/1", origin)).toBe(
      "blob",
    );
    expect(
      importableImageSrc(
        "https://chatgpt.com/backend-api/estuary/content?id=file_1&sig=abc",
        origin,
      ),
    ).toBe("remote");
  });

  it("leaves images the app already stores", () => {
    expect(importableImageSrc("/api/doc-images/abc.png", origin)).toBeNull();
    expect(
      importableImageSrc(
        "https://notes.example.com/api/doc-images/abc.png",
        origin,
      ),
    ).toBeNull();
    expect(importableImageSrc("", origin)).toBeNull();
  });

  it("copies stored images that belong to another deployment", () => {
    expect(
      importableImageSrc(
        "http://localhost:3000/api/doc-images/abc.png",
        origin,
      ),
    ).toBe("remote");
  });
});
