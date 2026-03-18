export async function cropScreenshotToSelection(dataUrl, rect) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return dataUrl;

  const image = await loadImage(dataUrl);
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.round(rect.width)),
    Math.max(1, Math.round(rect.height)),
  );
  const context = canvas.getContext("2d");
  if (!context) return dataUrl;

  const scale = rect.devicePixelRatio || 1;
  context.drawImage(
    image,
    rect.x * scale,
    rect.y * scale,
    rect.width * scale,
    rect.height * scale,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const blob = await canvas.convertToBlob({ type: "image/png" });
  return await blobToDataUrl(blob);
}

async function loadImage(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob();
  return await createImageBitmap(blob);
}

function blobToDataUrl(blob) {
  return blob.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }
    return `data:${blob.type || "image/png"};base64,${btoa(binary)}`;
  });
}
