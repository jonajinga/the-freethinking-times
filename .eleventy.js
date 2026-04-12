const pluginRss = require("@11ty/eleventy-plugin-rss");
const { DateTime } = require("luxon");
const fs = require("fs");
const { execSync } = require("child_process");

module.exports = function (eleventyConfig) {

  // ─── Plugins ────────────────────────────────────────────────────────────────
  eleventyConfig.addPlugin(pluginRss);

  // ─── Passthrough Copies ─────────────────────────────────────────────────────
  // Copy assets but exclude CSS (concatenated at build time below)
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/favicon.svg": "assets/favicon.svg" });
  eleventyConfig.addPassthroughCopy({ "src/assets/img": "assets/img" });
  eleventyConfig.addPassthroughCopy({ "src/humans.txt": "humans.txt" });

  // ─── CSS Concatenation (no @import waterfall) ──────────────────────────────
  eleventyConfig.addTemplateFormats("css");
  eleventyConfig.addExtension("css", {
    outputFileExtension: "css",
    compile: function (inputContent, inputPath) {
      // Only process the entry point; skip partials
      if (!inputPath.endsWith("main.css")) return;
      return function () {
        const cssDir = require("path").dirname(inputPath);
        const order = [
          "tokens.css", "base.css", "layout.css", "components.css",
          "article.css", "projects.css", "library.css", "calendar.css"
        ];
        let output = "";
        for (const file of order) {
          try {
            output += fs.readFileSync(require("path").join(cssDir, file), "utf8") + "\n";
          } catch (e) {
            console.warn("CSS file not found:", file);
          }
        }
        // Append main.css content (print styles etc.) minus the @import lines
        output += inputContent.replace(/@import\s+['"][^'"]+['"];?\s*/g, "");
        return output;
      };
    },
  });
  // robots.txt is now a Nunjucks template (robots.njk)
  eleventyConfig.addPassthroughCopy({ "src/_redirects": "_redirects" });

  // ─── Watch Targets ──────────────────────────────────────────────────────────
  eleventyConfig.addWatchTarget("src/assets/css/");
  eleventyConfig.addWatchTarget("src/assets/js/");

  // ─── Date Filters ───────────────────────────────────────────────────────────
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    const dt = typeof dateObj === "string"
      ? DateTime.fromISO(dateObj, { zone: "utc" })
      : DateTime.fromJSDate(dateObj, { zone: "utc" });
    return dt.toFormat("LLLL d, yyyy");
  });

  eleventyConfig.addFilter("htmlDateString", (dateObj) => {
    const dt = typeof dateObj === "string"
      ? DateTime.fromISO(dateObj, { zone: "utc" })
      : DateTime.fromJSDate(dateObj, { zone: "utc" });
    return dt.toFormat("yyyy-LL-dd");
  });

  eleventyConfig.addFilter("shortDate", (dateObj) => {
    const dt = typeof dateObj === "string"
      ? DateTime.fromISO(dateObj, { zone: "utc" })
      : DateTime.fromJSDate(dateObj, { zone: "utc" });
    return dt.toFormat("LLL d");
  });

  eleventyConfig.addFilter("isoDate", (dateObj) => {
    const dt = typeof dateObj === "string"
      ? DateTime.fromISO(dateObj, { zone: "utc" })
      : DateTime.fromJSDate(dateObj, { zone: "utc" });
    return dt.toISO();
  });

  eleventyConfig.addFilter("readingTime", (content) => {
    const text = content.replace(/(<([^>]+)>)/gi, "");
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    const mins = Math.max(1, Math.ceil(words / 200));
    return `${mins} min read`;
  });

  // Returns the raw minute count (integer) — used for data attributes and filtering
  eleventyConfig.addFilter("readingMins", (content) => {
    if (!content) return 1;
    const text = content.replace(/(<([^>]+)>)/gi, "");
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    return Math.max(1, Math.ceil(words / 200));
  });

  // Word count — formatted with thousands separator
  eleventyConfig.addFilter("wordCount", (content) => {
    if (!content) return '0';
    const text = content.replace(/(<([^>]+)>)/gi, "");
    const count = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    return count.toLocaleString('en-US');
  });

  // Related articles sorted by number of shared tags, excluding current URL
  eleventyConfig.addFilter("relatedByTags", (allContent, currentTags, currentUrl, limit = 3) => {
    const tags = (currentTags || []).filter(t => t !== "post" && t !== "all");
    if (!tags.length) return [];
    return allContent
      .filter(item => item.url !== currentUrl)
      .map(item => {
        const itemTags = (item.data.tags || []).filter(t => t !== "post" && t !== "all");
        const shared = itemTags.filter(t => tags.includes(t)).length;
        return { item, shared };
      })
      .filter(({ shared }) => shared > 0)
      .sort((a, b) => b.shared - a.shared)
      .slice(0, limit)
      .map(({ item }) => item);
  });

  // All articles in the same series, sorted by seriesPart
  eleventyConfig.addFilter("seriesArticles", (allContent, seriesTitle) => {
    if (!seriesTitle) return [];
    return allContent
      .filter(item => item.data.series === seriesTitle)
      .sort((a, b) => (a.data.seriesPart || 0) - (b.data.seriesPart || 0));
  });

  // Articles belonging to a specific edition number
  eleventyConfig.addFilter("editionArticles", (allContent, editionNum) => {
    return allContent
      .filter(item => Number(item.data.edition) === Number(editionNum))
      .sort((a, b) => b.date - a.date);
  });

  // ─── String Filters ─────────────────────────────────────────────────────────
  eleventyConfig.addFilter("excerpt", (content, length = 160) => {
    const stripped = content.replace(/(<([^>]+)>)/gi, "");
    return stripped.length > length ? stripped.substring(0, length).trim() + "…" : stripped;
  });

  eleventyConfig.addFilter("slugify", (str) => {
    return (str || '').toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  });

  eleventyConfig.addFilter("extractYear", (source, era) => {
    if (!source) return 0;
    const m = source.match(/\((?:c\.\s*)?(-?\d{3,4})/);
    if (m) return parseInt(m[1], 10);
    // Fallback by era for "attributed" quotes
    const eraMap = { 'Ancient': -300, 'Early Modern': 1550, 'Enlightenment': 1760, '18th Century': 1780, '19th Century': 1870, '20th Century': 1950, '21st Century': 2005 };
    return eraMap[era] || 0;
  });

  eleventyConfig.addFilter("quoteSlug", (q) => {
    const author = (q.author || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const words = (q.quote || "").split(/\s+/).slice(0, 6).join(" ").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return author + "-" + words;
  });

  eleventyConfig.addFilter("limit", (arr, limit) => arr.slice(0, limit));

  eleventyConfig.addFilter("urlencode", (str) => encodeURIComponent(str || ""));

  // Convert a page URL to a flat slug for OG image filenames
  // e.g. /opinion/my-article/ → opinion-my-article
  eleventyConfig.addFilter("ogSlug", (url) => {
    return (url || "").replace(/\//g, "-").replace(/^-|-$/g, "");
  });

  eleventyConfig.addFilter("where", (arr, key, value) => {
    return arr.filter(item => item.data[key] === value);
  });

  // ─── Collections ─────────────────────────────────────────────────────────────
  const siteData = JSON.parse(fs.readFileSync("./src/_data/site.json", "utf8"));
  const sections = Object.keys(siteData.sections).filter(
    key => !["thought-experiments", "trials-of-thought", "glossary", "bookshelf"].includes(key)
  );

  // All content across every section, newest first
  eleventyConfig.addCollection("allContent", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/content/**/*.md")
      .filter(item => !item.data.draft)
      .sort((a, b) => b.date - a.date);
  });

  // Featured content for front page
  eleventyConfig.addCollection("featured", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/content/**/*.md")
      .filter(item => item.data.featured && !item.data.draft)
      .sort((a, b) => b.date - a.date);
  });

  // Per-section collections
  sections.forEach(section => {
    eleventyConfig.addCollection(section, (collectionApi) => {
      return collectionApi
        .getFilteredByGlob(`src/content/${section}/*.md`)
        .filter(item => !item.data.draft)
        .sort((a, b) => b.date - a.date);
    });
  });

  // All tags across all content (for tag pages)
  eleventyConfig.addCollection("tagList", (collectionApi) => {
    const tagSet = new Set();
    collectionApi.getFilteredByGlob("src/content/**/*.md").forEach(item => {
      (item.data.tags || []).forEach(tag => {
        if (!["post", "all"].includes(tag)) tagSet.add(tag);
      });
    });
    return [...tagSet].sort();
  });

  // Articles with corrections, sorted by most recent correction date
  eleventyConfig.addCollection("correctionsLog", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/content/**/*.md")
      .filter(item => item.data.corrections && item.data.corrections.length > 0)
      .sort((a, b) => {
        const aLast = a.data.corrections[a.data.corrections.length - 1].date;
        const bLast = b.data.corrections[b.data.corrections.length - 1].date;
        return new Date(bLast) - new Date(aLast);
      });
  });

  // Unique edition numbers, sorted descending
  eleventyConfig.addCollection("editionList", (collectionApi) => {
    const editions = new Set();
    collectionApi.getFilteredByGlob("src/content/**/*.md").forEach(item => {
      if (item.data.edition != null) editions.add(Number(item.data.edition));
    });
    return [...editions].sort((a, b) => b - a);
  });

  // Per-author collections
  eleventyConfig.addCollection("authorList", (collectionApi) => {
    const authorSet = new Set();
    collectionApi.getFilteredByGlob("src/content/**/*.md").forEach(item => {
      if (item.data.author) authorSet.add(item.data.author);
    });
    return [...authorSet].sort();
  });

  // Articles that declare themselves a response to the given URL
  eleventyConfig.addFilter("responsesTo", (allContent, targetUrl) => {
    if (!targetUrl) return [];
    return allContent.filter(item => item.data.responseTo === targetUrl);
  });

  // Articles that link to the current page (backlinks / digital garden)
  eleventyConfig.addFilter("backlinksTo", (allContent, currentUrl) => {
    if (!currentUrl) return [];
    const bare = currentUrl.replace(/\/$/, "");
    return allContent.filter(item => {
      const content = item.templateContent || "";
      return content.includes(`href="${currentUrl}"`) || content.includes(`href="${bare}"`);
    });
  });

  // Other articles published on the same date (excludes current URL)
  eleventyConfig.addFilter("sameDate", (allContent, dateObj, currentUrl) => {
    const dateStr = DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd");
    return allContent.filter(item => {
      if (item.url === currentUrl) return false;
      return DateTime.fromJSDate(item.date, { zone: "utc" }).toFormat("yyyy-LL-dd") === dateStr;
    });
  });

  // Group allContent into [{date, label, articles}] sorted newest first, for archives
  eleventyConfig.addFilter("groupByDate", (allContent) => {
    const groups = {};
    allContent.forEach(item => {
      const dateStr = DateTime.fromJSDate(item.date, { zone: "utc" }).toFormat("yyyy-LL-dd");
      if (!groups[dateStr]) groups[dateStr] = { date: dateStr, articles: [] };
      groups[dateStr].articles.push(item);
    });
    return Object.values(groups).sort((a, b) => b.date.localeCompare(a.date));
  });

  // Primary source documents library, newest first
  eleventyConfig.addCollection("documents", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/documents/*.md")
      .filter(item => !item.data.draft)
      .sort((a, b) => b.date - a.date);
  });

  // ─── Project Collections ──────────────────────────────────────────────────────

  // Freethought Glossary — alphabetical by title
  eleventyConfig.addCollection("glossary", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/glossary/*.md")
      .filter(item => !item.data.draft)
      .sort((a, b) => a.data.title.localeCompare(b.data.title));
  });

  // Thought Experiment Library — newest first
  eleventyConfig.addCollection("thought-experiments", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/thought-experiments/*.md")
      .filter(item => !item.data.draft)
      .sort((a, b) => b.date - a.date);
  });

  // Freethinker's Bookshelf — alphabetical by category then title
  eleventyConfig.addCollection("bookshelf", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/bookshelf/*.md")
      .filter(item => !item.data.draft)
      .sort((a, b) => {
        const catA = a.data.category || "";
        const catB = b.data.category || "";
        return catA.localeCompare(catB) || a.data.title.localeCompare(b.data.title);
      });
  });

  // Trials of Thought — chronological by year (negative = BCE)
  eleventyConfig.addCollection("trials-of-thought", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/trials/*.md")
      .filter(item => !item.data.draft)
      .sort((a, b) => (a.data.year || 0) - (b.data.year || 0));
  });

  // ─── Shortcodes ──────────────────────────────────────────────────────────────

  // Inline footnote — renders a clickable superscript; JS shows a tooltip
  // Usage in .md: {% fn 1 %}Footnote text here.{% endfn %}
  eleventyConfig.addPairedShortcode("fn", (content, id) => {
    return `<sup class="fn-ref"><button class="fn-btn" type="button" aria-expanded="false" data-fn-id="${id}">${id}</button><span class="fn-content" hidden>${content.trim()}</span></sup>`;
  });

  // Pull quote
  eleventyConfig.addShortcode("pullquote", (quote, attribution = "") => {
    return `<blockquote class="pullquote">
      <p>${quote}</p>
      ${attribution ? `<cite>${attribution}</cite>` : ""}
    </blockquote>`;
  });

  // Section label badge
  eleventyConfig.addShortcode("sectionBadge", (section) => {
    return `<span class="section-badge section-badge--${section.toLowerCase().replace(/\s+/g, "-")}">${section}</span>`;
  });

  // ─── Markdown Config ─────────────────────────────────────────────────────────
  const markdownIt = require("markdown-it");
  const markdownItAnchor = require("markdown-it-anchor");

  const md = markdownIt({
    html: true,
    breaks: false,
    linkify: true,
    typographer: true,
  });

  md.use(markdownItAnchor, {
    permalink: false,
    slugify: s => s.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-'),
  });

  eleventyConfig.setLibrary("md", md);

  // Render a Markdown string to HTML (used for author bios etc.)
  eleventyConfig.addFilter("md", (content) => {
    if (!content) return '';
    return md.render(String(content));
  });

  // ─── Library Filters ─────────────────────────────────────────────────────────

  // Reading time from a raw word count integer — returns "N min" or "Nh Nm"
  eleventyConfig.addFilter("readingTimeFromWords", (wordCount) => {
    const mins = Math.max(1, Math.ceil(wordCount / 200));
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  });

  // Raw word count as integer (distinct from existing `wordCount` which returns a formatted string)
  eleventyConfig.addFilter("wordCountRaw", (content) => {
    if (!content) return 0;
    const text = content.replace(/(<([^>]+)>)/gi, "");
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  });

  // Return chapters for a specific work from the libraryByWork collection
  eleventyConfig.addFilter("chaptersForWork", (byWorkCollection, workSlug) => {
    return (byWorkCollection && byWorkCollection[workSlug]) || [];
  });

  // Format a year integer, handling BCE (negative) values
  eleventyConfig.addFilter("formatYear", (year) => {
    if (!year && year !== 0) return "";
    const n = Number(year);
    return n < 0 ? `${Math.abs(n)} BCE` : String(n);
  });

  // ─── Library Collections ─────────────────────────────────────────────────────

  // All library chapters (every .md under works/ except index files), sorted by chapterNumber
  eleventyConfig.addCollection("libraryChapters", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/library/works/**/*.md")
      .filter(item => !item.inputPath.endsWith('/index.md'))
      .sort((a, b) => (a.data.chapterNumber || 0) - (b.data.chapterNumber || 0));
  });

  // Chapters grouped by workSlug — { [workSlug]: [chapter, ...] }
  // Also includes lecture landing pages (index.md with parentWorkSlug) in their parent's list
  eleventyConfig.addCollection("libraryByWork", (collectionApi) => {
    const allMd = collectionApi.getFilteredByGlob("src/library/works/**/*.md");
    const chapters = allMd
      .filter(item => !item.inputPath.endsWith('/index.md'))
      .sort((a, b) => (a.data.chapterNumber || 0) - (b.data.chapterNumber || 0));
    const lecturePages = allMd
      .filter(item => item.inputPath.endsWith('/index.md') && item.data.parentWorkSlug)
      .sort((a, b) => (a.data.chapterNumber || 0) - (b.data.chapterNumber || 0));

    const byWork = {};
    chapters.forEach(ch => {
      const slug = ch.data.workSlug;
      if (!slug) return;
      if (!byWork[slug]) byWork[slug] = [];
      byWork[slug].push(ch);
    });
    // Add lecture landing pages to their parent work's chapter list
    lecturePages.forEach(lp => {
      const parentSlug = lp.data.parentWorkSlug;
      if (!byWork[parentSlug]) byWork[parentSlug] = [];
      byWork[parentSlug].push(lp);
      byWork[parentSlug].sort((a, b) => (a.data.chapterNumber || 0) - (b.data.chapterNumber || 0));
    });
    return byWork;
  });

  // Work landing pages (index.md files directly inside each work directory)
  eleventyConfig.addCollection("libraryWorks", (collectionApi) => {
    const worksData = JSON.parse(fs.readFileSync("./src/_data/library/works.json", "utf8"));
    const childSlugs = worksData.filter(w => w.parentWork).map(w => w.slug);
    return collectionApi
      .getFilteredByGlob("src/library/works/*/index.md")
      .filter(item => !childSlugs.includes(item.data.workSlug))
      .sort((a, b) => (a.data.title || "").localeCompare(b.data.title || ""));
  });

  // Featured chapters/works
  eleventyConfig.addCollection("libraryFeatured", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/library/works/**/*.md")
      .filter(item => item.data.featured && !item.inputPath.endsWith('/index.md'))
      .sort((a, b) => (a.data.chapterNumber || 0) - (b.data.chapterNumber || 0));
  });

  // ─── Layout Aliases ──────────────────────────────────────────────────────────
  eleventyConfig.addLayoutAlias("base", "layouts/base.njk");
  eleventyConfig.addLayoutAlias("article", "layouts/article.njk");
  eleventyConfig.addLayoutAlias("section", "layouts/section.njk");
  eleventyConfig.addLayoutAlias("home", "layouts/home.njk");
  eleventyConfig.addLayoutAlias("glossary-term", "layouts/glossary-term.njk");
  eleventyConfig.addLayoutAlias("book-entry", "layouts/book-entry.njk");
  eleventyConfig.addLayoutAlias("library-home",    "layouts/library-home.njk");
  eleventyConfig.addLayoutAlias("library-work",    "layouts/library-work.njk");
  eleventyConfig.addLayoutAlias("library-chapter", "layouts/library-chapter.njk");
  eleventyConfig.addLayoutAlias("library-short",   "layouts/library-short.njk");

  // ─── Global Data
  eleventyConfig.addGlobalData("currentYear", () => new Date().getFullYear());
  eleventyConfig.addGlobalData("buildTime", () => Date.now());

  // ─── Pagefind search index (runs after build) ──────────────────────────────
  eleventyConfig.on("eleventy.after", () => {
    try {
      execSync("npx pagefind --site _site --output-path _site/pagefind", {
        stdio: "inherit",
      });
    } catch (e) {
      console.warn("Pagefind indexing failed:", e.message);
    }
  });

  // ─── Build Config ────────────────────────────────────────────────────────────
  return {
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
  };
};

// This line intentionally left blank — see eleventyConfig.addGlobalData below
