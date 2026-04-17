# Contributing

Thanks for your interest in contributing to The Freethinking Times. This
repository holds both the source code for the site and an open template
that anyone is welcome to fork and use to run their own publication.

## Local setup

```bash
git clone https://github.com/<your-username>/freethinking-times.git
cd freethinking-times
npm install
cp .env.example .env   # fill in your own keys if running against live services
npm run dev
```

The dev server runs at http://localhost:8080 with live reload. An initial
build runs first so Pagefind can index the `_site/` output for search.

## Project layout

- `src/_data/` — global data (site config, authors, quotes, etc.)
- `src/_includes/layouts/` — Nunjucks page layouts
- `src/_includes/partials/` — reusable components (header, footer, cards)
- `src/content/` — article sections (news, opinion, analysis, …)
- `src/pages/` — standalone pages (about, style-guide, dashboard, …)
- `src/assets/css/` — design tokens and component styles
- `src/assets/js/` — vanilla JS, no bundler
- `.pages.yml` — [Pages CMS](https://pagescms.org) collection definitions

The canonical design system lives at [`/style-guide/`](src/pages/style-guide.njk)
and draws tokens from [`src/assets/css/tokens.css`](src/assets/css/tokens.css).

## Contribution types

### Code / design / infra

1. Fork and create a feature branch (`git checkout -b feat/your-change`).
2. Make your changes. Prefer small, focused PRs.
3. Run `npm run build` locally and confirm no errors.
4. Verify affected pages render correctly in the dev server.
5. Open a PR with a clear description of what changed and why.

### Editorial content

If you're contributing an article, essay, letter, or review:

- Use [Pages CMS](https://pagescms.org) after being added as a contributor, **or**
- Submit a PR with a new markdown file in the appropriate `src/content/<section>/` folder.
- Follow existing frontmatter conventions (title, description, author, date, tags, status).
- Set `status: draft` until ready for review.

## Coding standards

- **CSS**: vanilla, custom-property driven. No frameworks. Keep tokens in
  `tokens.css`; add component styles in `article.css` or related files.
- **JS**: vanilla, no bundler. Feature-specific files, loaded as needed.
- **Templates**: Nunjucks. Prefer composing partials over duplicating markup.
- **Accessibility**: WCAG 2.2 AA minimum. Semantic HTML, visible focus, 4.5:1
  contrast. Test with keyboard navigation.
- **Performance**: lean toward lazy loading, static output, minimal JS.

## Commit style

Conventional commits encouraged but not enforced — clear, imperative
subject lines are the bar (`fix: ruler no longer persists across reloads`,
`feat: add topic-index page`).

## Questions

Open an issue or email [hello@thefreethinkingtimes.com](mailto:hello@thefreethinkingtimes.com).
