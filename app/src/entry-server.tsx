import { createHandler, StartServer } from "@solidjs/start/server";
import { THEME_BOOT_SCRIPT } from "~/lib/theme-mode";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
          <link rel="manifest" href="/site.webmanifest" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link
            rel="icon"
            type="image/png"
            sizes="32x32"
            href="/favicon-32x32.png"
          />
          <link
            rel="icon"
            type="image/png"
            sizes="16x16"
            href="/favicon-16x16.png"
          />
          <meta
            name="theme-color"
            media="(prefers-color-scheme: light)"
            content="#f8faf8"
          />
          <meta
            name="theme-color"
            media="(prefers-color-scheme: dark)"
            content="#181917"
          />
          {/* Must run before CSS paints so dark mode never flashes light. */}
          <script innerHTML={THEME_BOOT_SCRIPT} />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
