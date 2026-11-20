# Visual Notes landing page

A static Vite + Solid page, separate from the app in `app/`. The deploy-site workflow publishes it to GitHub Pages on every merge to main that changes `site/`.

```sh
cd site
pnpm install
pnpm dev   # http://localhost:3360/visual-notes/
```

`SITE_BASE` sets the path the page is served from. It is `/visual-notes/` for the GitHub Pages project URL. Set it to `/` when the site gets its own domain.

Screenshots in `public/shots/` come from a demo database with invented notes, never real ones. `scripts/shoot.mjs` takes them; its header says how.
