// Site-wide configuration.
//
// Editor-facing settings (title, description, tipping URLs, etc.) live in
// src/_data/site-settings.json and are managed via Pages CMS.
//
// Secrets and environment-specific values (URL, email, API keys) are read
// from environment variables — see `.env.example` for the full list. Local
// development loads them from `.env` via dotenv; in CI / Cloudflare Pages
// set them in the dashboard. Env vars always override site-settings.json.

try { require('dotenv').config(); } catch (_) { /* dotenv is optional in prod */ }

const env = process.env;
const s = require('./site-settings.json');

module.exports = {
  title: s.title,
  description: s.description,
  url: env.SITE_URL || "https://thefreethinkingtimes.com",
  author: s.author,
  email: env.SITE_EMAIL || s.email,
  language: "en",
  founded: s.founded,
  gtranslate: s.gtranslate,
  storagePrefix: "tft",
  repo: {
    owner: "jonajinga",
    name: "the-freethinking-times",
    branch: "main"
  },
  fontsUrl: "https://fonts.bunny.net/css?family=dm-sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=lora:ital,wght@0,400;0,600;0,700;1,400;1,600&family=playfair-display:ital,wght@0,700;0,900;1,700&family=source-serif-4:ital,wght@0,300;0,400;0,600;1,300;1,400&display=swap",
  forms: {
    provider: "web3forms",
    accessKey: env.WEB3FORMS_ACCESS_KEY || ""
  },
  analytics: {
    provider: "umami",
    websiteId: env.UMAMI_WEBSITE_ID || "",
    scriptUrl: env.UMAMI_SRC || "https://cloud.umami.is/script.js",
    dashboardUrl: env.UMAMI_DASHBOARD_URL || ""
  },
  newsletter: {
    provider: s.newsletter.provider,
    username: env.BUTTONDOWN_USERNAME || s.newsletter.username || ""
  },
  comments: {
    provider: "cusdis",
    appId: env.CUSDIS_APP_ID || "2f9a4b07-2835-475d-98d5-90f6ac1087ae",
    host: "https://cusdis.com"
  },
  tipping: {
    // Env vars override CMS values so secrets stay out of the repo.
    kofi:    env.KOFI_URL    || s.tipping.kofi    || "",
    bmac:    env.BMAC_URL    || s.tipping.bmac    || "",
    patreon: env.PATREON_URL || s.tipping.patreon || ""
  },
  social: s.social,
  nav: [
    { label: "News",           url: "/news/",               key: "news",         collection: "news" },
    { label: "Opinion",        url: "/opinion/",            key: "opinion",      collection: "opinion" },
    { label: "Analysis",       url: "/analysis/",           key: "analysis",     collection: "analysis" },
    { label: "Arts & Culture", url: "/arts-culture/",       key: "arts-culture", collection: "arts-culture" },
    { label: "Science & Tech", url: "/science-technology/", key: "science-tech", collection: "science-technology" },
    { label: "History",        url: "/history/",            key: "history",      collection: "history" },
    { label: "Letters",        url: "/letters/",            key: "letters",      collection: "letters" },
    { label: "Reviews",        url: "/reviews/",            key: "reviews",      collection: "reviews" },
    { label: "More",           url: "/more/",               key: "more",         type: "more" }
  ],
  sections: {
    "news": {
      label: "News",
      color: "#C0392B",
      description: "Breaking news and reported stories."
    },
    "opinion": {
      label: "Opinion",
      color: "#2C5F8A",
      description: "Signed columns, essays, and editorial positions."
    },
    "analysis": {
      label: "Analysis",
      color: "#5D4037",
      description: "Deep dives, research, and long-form investigation."
    },
    "arts-culture": {
      label: "Arts & Culture",
      color: "#6A1B9A",
      description: "Books, film, music, and ideas."
    },
    "science-technology": {
      label: "Science & Tech",
      color: "#1B5E20",
      description: "Actual science. Not press releases."
    },
    "history": {
      label: "History",
      color: "#BF8C00",
      description: "Context and consequence across time."
    },
    "letters": {
      label: "Letters",
      color: "#37474F",
      description: "Reader responses and correspondence."
    },
    "reviews": {
      label: "Reviews",
      color: "#8B6914",
      description: "Books, films, podcasts, and documentaries assessed honestly."
    },
    "thought-experiments": {
      label: "Thought Experiments",
      color: "#1D5C6E",
      description: "Classic thought experiments given serious popular treatment."
    },
    "trials-of-thought": {
      label: "Trials of Thought",
      color: "#6B2A2A",
      description: "Landmark trials where ideas were the defendant."
    },
    "glossary": {
      label: "Glossary",
      color: "#3D5A47",
      description: "The philosophical vocabulary of the freethinking tradition."
    },
    "bookshelf": {
      label: "Bookshelf",
      color: "#7A5232",
      description: "A curated, annotated reading list."
    }
  }
};
