// Template for a one-off browser check. Copy it to tmp/, edit the body, run:
//
//   node tmp/my-check.mjs --base http://127.0.0.1:3100 [extra args]
//
// It exits 1 when a check fails or the page logs an error, so an agent can
// trust the exit code. Screenshots land in tmp/browser/<script name>/.
import { run } from "../../scripts/browser/kit.mjs";

await run(async (app) => {
  const route = app.args[0] ?? "/";

  // Same route at a desktop and a phone width.
  await app.eachWidth([1440, 390], async (page, width) => {
    const loadMs = await app.visit(page, route);
    app.log(`${route} @${width} loaded`, `${loadMs}ms`);

    // Wait on a real element, never on a fixed sleep.
    const main = page.getByRole("main");
    await main.waitFor();
    const box = await app.box(main);
    app.check(
      `main fits @${width}`,
      box !== null && box.x + box.width <= width,
      box,
    );

    // After an interaction (hover, click, keypress), settle before measuring.
    await main.hover();
    await app.settle(page);

    const layout = await app.layout(page, `${route} @${width}`);
    app.check(
      `no horizontal overflow @${width}`,
      !layout.horizontalOverflow,
      layout.offscreen,
    );
    await app.shot(page, `page-${width}`);
  });
});
