# The Freethinking Times

Independent journalism. Investigative. Philosophical. Adversarial to power.

Built with [Eleventy (11ty)](https://www.11ty.dev/) and hosted on [Cloudflare Pages](https://pages.cloudflare.com/).

**License:** [MIT](LICENSE) for code. Editorial content remains the copyright of its authors — see the note in [LICENSE](LICENSE) if you intend to fork.

---

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm

### Install

```bash
npm install
cp .env.example .env
```

Fill in values in `.env` (all optional for a local build — see [.env.example](.env.example) for what each key controls).

### Develop locally

```bash
npm start
```

Opens at `http://localhost:8080` with live reload.

### Build for production

```bash
npm run build
```

Output goes to `_site/`.

---

## Project Structure

```
src/
├── _data/          # site.js (env-aware globals), authors.json, quotes.json, ...
├── _includes/
│   ├── layouts/    # base, article, section, home, author, tag
│   └── partials/   # header, footer, article-card
├── assets/
│   ├── css/        # tokens, base, layout, components, article, main
│   └── js/         # theme toggle, reading settings, search, annotations
├── content/
│   ├── news/
│   ├── opinion/
│   ├── analysis/
│   ├── arts-culture/
│   ├── science-technology/
│   ├── history/
│   ├── letters/
│   └── reviews/
├── glossary/, bookshelf/, thought-experiments/, trials/, library/
└── pages/          # about, masthead, ethics, submit, privacy, style-guide, ...
```

The canonical design system lives at `/style-guide/` ([src/pages/style-guide.njk](src/pages/style-guide.njk)) and draws tokens from [src/assets/css/tokens.css](src/assets/css/tokens.css). Edit the tokens to rebrand the whole site.

---

## Writing Articles

Create a Markdown file in the appropriate section folder. Frontmatter template:

```yaml
---
layout: article
title: "Your Article Title"
description: "A one or two sentence summary for cards and meta tags."
section: News          # Must match a section key exactly
author: your-slug      # Must match a key in authors.json
authorName: Your Name
date: 2026-03-17
tags:
  - tag-one
  - tag-two
featured: true         # Optional — promotes to front page hero
draft: true            # Optional — excludes from all collections
---
```

---

## Adding an Author

Edit `src/_data/authors.json`:

```json
{
  "author-slug": {
    "name": "Full Name",
    "slug": "author-slug",
    "bio": "One paragraph bio.",
    "role": "Contributing Writer",
    "avatar": ""
  }
}
```

The author page at `/author/author-slug/` generates automatically.

---

## Deployment to Cloudflare Pages

1. Push this repo to GitHub
2. In Cloudflare Pages, connect the repo
3. Set build command: `npm run build`
4. Set output directory: `_site`
5. Set Node.js version environment variable: `NODE_VERSION = 18`

Cloudflare will build and deploy on every push to main.

---

## Customisation

All visual variables — colors, fonts, spacing, dark mode palette — live in `src/assets/css/tokens.css`. Edit that file to retheme the entire site.

Site globals (title, description, nav, section colors) live in `src/_data/site.js`. Secrets (API keys, site URL, email) come from environment variables — see `.env.example`.

---

## Forking for your own publication

1. Fork the repo and clone your fork.
2. `npm install && cp .env.example .env`, then fill in `.env` with your own service credentials.
3. Update `src/_data/authors.json` — the current default author is `jon-ajinga`. Rename that entry (or add your own and change `.pages.yml` defaults to point at your slug).
4. Replace editorial content in `src/content/` with your own. The MIT license does not cover published articles — see [LICENSE](LICENSE).
5. Swap branding: publication name in `src/_data/site.js`, tokens in `src/assets/css/tokens.css`, favicon and OG image in `src/assets/`.
6. Deploy to Cloudflare Pages (steps above) or any static host.

## Pages CMS setup

Content is editable via [Pages CMS](https://pagescms.org). To wire it up to your fork:

1. Visit [pagescms.org](https://pagescms.org) and authenticate with GitHub.
2. Add your fork as a project — it will auto-detect the `.pages.yml` config.
3. All 14 collections (news, opinion, analysis, glossary, bookshelf, etc.) will appear in the CMS dashboard.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor guide.
