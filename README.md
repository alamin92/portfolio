# Portfolio

Personal portfolio site built with [Astro](https://astro.build) and TypeScript. Static output, no backend.

## Run locally

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
npm run preview  # serve the built site
```

## Where to edit

- `src/config.ts`: name, tagline, email, social links, nav
- `src/pages/`: one file per page (Travel has Photos, Places and Plan subpages)
- `src/data/places.ts`: curated places, generated from Google Maps saved lists
- `src/data/photos.ts`: photo albums manifest
- `src/scripts/`: game logic
- `public/photos/`: web-sized photos (originals stay local in `photos/`, git-ignored)

## Planned

A second arcade game, trophies, resume page, hosting on Cloudflare Pages.
