# Sanjith portfolio

This is a dependency-free HTML, CSS, and JavaScript portfolio based on the supplied reference.

## Edit the content

- Page text, project links, email, and social links: `index.html`
- Colors, sizing, spacing, and responsive layout: `styles.css`
- Mobile menu and reveal behavior: `script.js`
- Images and fonts: `assets/`

## Custom-domain pages

- Home: `https://sanjithuiux.design/` → `index.html`
- Drexel Works: `https://sanjithuiux.design/drexel-works/` → `drexel-works/index.html`
- GLOWM: `https://sanjithuiux.design/glowm/` → `glowm/index.html`

Each case study includes its own styles, scripts, and assets. Internal project and
home links stay on this domain. The case studies were copied from their published
repositories on October 22, 2026; unpublished local revisions were not included.

GitHub Pages publishes `main` from the repository root. Preserve `CNAME` and
`.nojekyll` when updating. This repository is independent of the original Vercel
portfolio and the original case-study repositories; publishing here does not
update those sites.

## Preview locally

From this folder, run:

```bash
python3 -m http.server 4173
```

Then open `http://127.0.0.1:4173/` in a browser.

The project has no build step and can be hosted on any static hosting service.
