import { devices, expect, test } from "@playwright/test";
import { createNoteFixture, uniqueSuffix } from "./helpers/fixtures";
import { waitForAppReady } from "./helpers/readiness";

// Chromium's fake capture device plays a steady beep, so the recorder gets
// real audio without a microphone or a permission prompt.
test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
  },
});

test("records audio into a note, plays it back, and renames it", async ({
  page,
}) => {
  const title = `Audio note ${uniqueSuffix()}`;
  const noteId = await createNoteFixture(page, {
    title,
    markdown: `# ${title}\n\nBody.`,
  });
  await page.goto(`/docs/${noteId}`);
  await waitForAppReady(page);

  await page.getByTestId("doc-audio-record").click();
  const live = page.getByTestId("doc-audio-live");
  await expect(live).toBeVisible();
  await expect(live).toContainText("0:02", { timeout: 10_000 });
  // Wait past one 5s chunk so the upload path runs while recording.
  await expect(live).toContainText("0:06", { timeout: 10_000 });
  await live.getByRole("button", { name: "Stop" }).click();
  await expect(live).toBeHidden({ timeout: 15_000 });

  const row = page.getByTestId("doc-audio-row");
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("0:0");
  const src = await row.locator("audio").getAttribute("src");
  expect(src).toMatch(/^\/api\/doc-audio\/[a-z0-9]+$/);

  const full = await page.request.get(src!);
  expect(full.status()).toBe(200);
  expect((await full.body()).byteLength).toBeGreaterThan(1000);
  const ranged = await page.request.get(src!, {
    headers: { range: "bytes=0-1" },
  });
  expect(ranged.status()).toBe(206);
  expect(ranged.headers()["content-range"]).toMatch(/^bytes 0-1\/\d+$/);

  await row.getByText(/^Recording · /).click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("Standup notes");
  await page.keyboard.press("Enter");
  await expect(row).toContainText("Standup notes");
  await page.reload();
  await waitForAppReady(page);
  await expect(page.getByTestId("doc-audio-row")).toContainText(
    "Standup notes",
  );
});

test("dropped voice memos become recordings; other files become cards", async ({
  page,
}) => {
  const title = `Dropped audio ${uniqueSuffix()}`;
  const noteId = await createNoteFixture(page, {
    title,
    markdown: `# ${title}\n\nBody.`,
  });
  await page.goto(`/docs/${noteId}`);
  await waitForAppReady(page);
  await page.locator(".ProseMirror").waitFor();

  await page.evaluate(() => {
    // One second of silent 8 kHz mono WAV, so the browser reads a duration.
    const wav = () => {
      const samples = 8000;
      const view = new DataView(new ArrayBuffer(44 + samples));
      const str = (at: number, text: string) =>
        [...text].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
      str(0, "RIFF");
      view.setUint32(4, 36 + samples, true);
      str(8, "WAVEfmt ");
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, 8000, true);
      view.setUint32(28, 8000, true);
      view.setUint16(32, 1, true);
      view.setUint16(34, 8, true);
      str(36, "data");
      view.setUint32(40, samples, true);
      return view.buffer;
    };
    const dt = new DataTransfer();
    // The later memo comes first; recordings sort by the file's time.
    dt.items.add(
      new File([wav()], "Kitchen.wav", {
        type: "audio/wav",
        lastModified: Date.UTC(2026, 9, 2, 9),
      }),
    );
    dt.items.add(
      new File([wav()], "Morning walk.wav", {
        type: "audio/x-wav",
        lastModified: Date.UTC(2026, 9, 1, 9),
      }),
    );
    dt.items.add(
      new File(["%PDF-1.4\n%%EOF\n"], "agenda.pdf", {
        type: "application/pdf",
      }),
    );
    const target = document.querySelector(".ProseMirror")!;
    for (const type of ["dragenter", "dragover", "drop"]) {
      target.dispatchEvent(
        new DragEvent(type, { dataTransfer: dt, bubbles: true, cancelable: true }),
      );
    }
  });

  const rows = page.getByTestId("doc-audio-row");
  await expect(rows).toHaveCount(2, { timeout: 15_000 });
  await expect(rows.nth(0)).toContainText("Morning walk");
  await expect(rows.nth(1)).toContainText("Kitchen");
  await expect(rows.nth(0)).toContainText("0:01");
  await expect(page.getByTestId("doc-audio-upload")).toHaveCount(0);
  await expect(
    page.locator(".ProseMirror [data-file-attachment]"),
  ).toContainText("agenda.pdf");

  const src = await rows.nth(0).locator("audio").getAttribute("src");
  const served = await page.request.get(src!);
  expect(served.headers()["content-type"]).toBe("audio/wav");

  await page.reload();
  await waitForAppReady(page);
  await expect(page.getByTestId("doc-audio-row")).toHaveCount(2);
});

test.describe("on a phone", () => {
  const { defaultBrowserType: _browser, ...pixel } = devices["Pixel 7"];
  test.use(pixel);

  test("the app bar starts a new voice note", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    await page
      .getByRole("banner")
      .getByRole("button", { name: "New voice note" })
      .tap();
    await page.waitForURL(/\/docs\/[a-z0-9]+$/);
    const live = page.getByTestId("doc-audio-live");
    await expect(live).toBeVisible();
    await expect(live).toContainText("0:01", { timeout: 10_000 });

    // Recording follows client-side navigation via the floating pill.
    await page.getByRole("button", { name: "Open menu" }).tap();
    await page.getByRole("dialog").getByRole("link", { name: "Tasks" }).tap();
    await page.waitForURL(/\/tasks$/);
    const pill = page.getByTestId("recording-indicator");
    await expect(pill).toBeVisible();
    await pill.getByRole("button", { name: "Stop recording" }).tap();
    await expect(pill).toBeHidden({ timeout: 15_000 });
  });
});
