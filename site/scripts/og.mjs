// Renders site/public/og.jpg (1200x630) from the notes screenshot that
// shoot.mjs leaves in app/tmp/landing/. Run from app/: node ../site/scripts/og.mjs
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const img = "data:image/png;base64," + readFileSync("tmp/landing/notes.png").toString("base64");
const html = `<html><body style="margin:0;width:1200px;height:630px;background:#f6f1e8;font-family:ui-sans-serif,system-ui,-apple-system;overflow:hidden;position:relative">
<div style="position:absolute;left:64px;top:64px;width:460px;color:#17181d">
<div style="display:flex;align-items:center;gap:12px;font-size:26px;font-weight:650">
<img src="data:image/png;base64,${readFileSync("public/android-chrome-192x192.png").toString("base64")}" style="width:44px;height:44px;border-radius:10px">Visual Notes</div>
<div style="margin-top:36px;font-size:50px;font-weight:750;letter-spacing:-0.02em;line-height:1.1">Notes, voice memos, tasks, and research in one place.</div>
<div style="margin-top:24px;font-size:22px;color:#5d5a54;line-height:1.45">With an MCP connector, so agents work in the same notes.</div></div>
<div style="position:absolute;left:580px;top:70px;width:900px;border:1px solid #cfc3ae;border-radius:12px;overflow:hidden;box-shadow:0 18px 40px -18px rgb(40 30 10/30%);background:#fff">
<div style="height:26px;background:#efe7d9;border-bottom:1px solid #e2d9c9"></div>
<img src="${img}" style="display:block;width:900px"></div></body></html>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await p.setContent(html, { waitUntil: "load" });
await p.screenshot({ path: "../site/public/og.jpg", type: "jpeg", quality: 85 });
await b.close();
