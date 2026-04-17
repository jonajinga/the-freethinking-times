const pluginRss = require("@11ty/eleventy-plugin-rss");
const eleventyImage = require("@11ty/eleventy-img");
const { DateTime } = require("luxon");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

module.exports = function (eleventyConfig) {

  // ─── Plugins ────────────────────────────────────────────────────────────────
  eleventyConfig.addPlugin(pluginRss);

  // ─── Responsive image shortcode ────────────────────────────────────────────
  // Usage in Markdown: {% image "src/assets/img/foo.jpg", "alt text", "(max-width: 768px) 100vw, 720px" %}
  // Outputs <picture> with AVIF + WebP + fallback, lazy-loaded, with width/height.
  async function imageShortcode(src, alt = "", sizes = "(max-width: 720px) 100vw, 720px", className = "") {
    if (!src) return "";
    // Allow authors to reference images as /assets/img/... — resolve to disk path
    const diskSrc = src.startsWith("/")
      ? path.join("./src", src)
      : src.startsWith("src/") ? src : path.join("./src/assets/img", src);

    let metadata;
    try {
      metadata = await eleventyImage(diskSrc, {
        widths: [400, 800, 1200, null],
        formats: ["avif", "webp", "jpeg"],
        outputDir: "./_site/assets/img/opt/",
        urlPath: "/assets/img/opt/"
      });
    } catch (e) {
      console.warn("image shortcode: failed to process", src, "—", e.message);
      return `<img src="${src}" alt="${alt}" loading="lazy">`;
    }

    return eleventyImage.generateHTML(metadata, {
      alt,
      sizes,
      loading: "lazy",
      decoding: "async",
      class: className || undefined
    });
  }

  eleventyConfig.addAsyncShortcode("image", imageShortcode);
  eleventyConfig.addLiquidShortcode("image", imageShortcode);
  eleventyConfig.addJavaScriptFunction("image", imageShortcode);

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
  eleventyConfig.addPassthroughCopy({ "src/_headers": "_headers" });

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

  // Weighted related-articles scorer. Combines:
  //  - tag overlap (3× per shared tag)
  //  - section match (2×)
  //  - title word overlap (1× per shared word > 3 chars, lowercased, stopwords removed)
  //  - recency (soft boost for articles <365 days old, scaled)
  // Returns top N items sorted by score descending. When no tag/section match,
  // still returns same-section articles (if any) or recent articles as fallback.
  eleventyConfig.addFilter("relatedArticles", (allContent, currentData, currentUrl, limit = 4) => {
    if (!currentData) return [];
    const STOP = new Set(["the","and","for","with","from","that","this","have","been","into","about","their","there","which","what","when","where","your","also","more","than","these","those","over","some","other","like","such","just","only","will","was","are","its","our"]);
    const words = (s) => (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(w => w.length > 3 && !STOP.has(w));
    const currentTags = new Set((currentData.tags || []).filter(t => t !== "post" && t !== "all"));
    const currentSection = currentData.section || "";
    const currentWords = new Set(words(currentData.title));
    const now = Date.now();

    const scored = allContent
      .filter(item => item.url !== currentUrl)
      .filter(item => !item.data.draft && !item.data.emailOnly)
      .map(item => {
        let score = 0;
        const itemTags = (item.data.tags || []).filter(t => t !== "post" && t !== "all");
        const sharedTags = itemTags.filter(t => currentTags.has(t)).length;
        score += sharedTags * 3;
        if (item.data.section && item.data.section === currentSection) score += 2;
        const itemWords = words(item.data.title);
        const sharedWords = itemWords.filter(w => currentWords.has(w)).length;
        score += sharedWords;
        // Recency: up to +1.5 for articles within the last year
        const ageDays = item.date ? (now - new Date(item.date).getTime()) / 86400000 : 9999;
        if (ageDays < 365) score += 1.5 * (1 - ageDays / 365);
        return { item, score, sharedTags };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length >= limit) return scored.slice(0, limit).map(({ item }) => item);

    // Fallback: top up with same-section, then most recent
    const chosen = new Set(scored.map(({ item }) => item.url));
    const fallback = allContent
      .filter(item => item.url !== currentUrl && !chosen.has(item.url))
      .filter(item => !item.data.draft && !item.data.emailOnly)
      .sort((a, b) => {
        const aSec = a.data.section === currentSection ? 1 : 0;
        const bSec = b.data.section === currentSection ? 1 : 0;
        if (aSec !== bSec) return bSec - aSec;
        return (b.date || 0) - (a.date || 0);
      });
    return [...scored.map(({ item }) => item), ...fallback].slice(0, limit);
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
  const siteData = require("./src/_data/site.js");
  const sections = Object.keys(siteData.sections).filter(
    key => !["thought-experiments", "trials-of-thought", "glossary", "bookshelf"].includes(key)
  );

  // Scheduled publishing: exclude articles with future dates (unless SHOW_FUTURE env var set)
  const NOW = new Date();
  const SHOW_FUTURE = process.env.SHOW_FUTURE === "1";
  const isNotFuture = (item) => SHOW_FUTURE || item.date <= NOW;

  // All content across every section, newest first
  eleventyConfig.addCollection("allContent", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/content/**/*.md")
      .filter(item => !item.data.draft && isNotFuture(item))
      .sort((a, b) => b.date - a.date);
  });

  // Featured content for front page
  eleventyConfig.addCollection("featured", (collectionApi) => {
    return collectionApi
      .getFilteredByGlob("src/content/**/*.md")
      .filter(item => item.data.featured && !item.data.draft && isNotFuture(item))
      .sort((a, b) => b.date - a.date);
  });

  // Per-section collections
  sections.forEach(section => {
    eleventyConfig.addCollection(section, (collectionApi) => {
      return collectionApi
        .getFilteredByGlob(`src/content/${section}/*.md`)
        .filter(item => !item.data.draft && isNotFuture(item))
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

  // Word count for a single content item (reads raw Markdown, strips front matter).
  // Safe to call inside filters — doesn't depend on templateContent being populated.
  const countWords = (item) => {
    try {
      if (item.inputPath && fs.existsSync(item.inputPath)) {
        const raw = fs.readFileSync(item.inputPath, "utf8");
        const body = raw.replace(/^---[\s\S]*?---/, "");
        return body.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
      }
    } catch (e) { /* ignore */ }
    return 0;
  };

  // Per-author stats: [{ name, count, totalWords, avgWords, totalReadingMin, sections }]
  eleventyConfig.addFilter("authorStats", (allContent) => {
    const stats = {};
    allContent.forEach(item => {
      const name = item.data.authorName || item.data.author || "Unknown";
      if (!stats[name]) stats[name] = { name, count: 0, totalWords: 0, sections: new Set() };
      stats[name].count++;
      stats[name].totalWords += countWords(item);
      if (item.data.section) stats[name].sections.add(item.data.section);
    });
    return Object.values(stats).map(s => ({
      name: s.name,
      count: s.count,
      totalWords: s.totalWords,
      avgWords: s.count > 0 ? Math.round(s.totalWords / s.count) : 0,
      totalReadingMin: Math.ceil(s.totalWords / 225),
      sections: Array.from(s.sections).join(", ")
    })).sort((a, b) => b.count - a.count);
  });

  // Per-section stats: [{ section, count, totalWords, avgWords, totalReadingMin }]
  eleventyConfig.addFilter("sectionStats", (allContent) => {
    const stats = {};
    allContent.forEach(item => {
      const section = item.data.section || "Uncategorised";
      if (!stats[section]) stats[section] = { section, count: 0, totalWords: 0 };
      stats[section].count++;
      stats[section].totalWords += countWords(item);
    });
    return Object.values(stats).map(s => ({
      section: s.section,
      count: s.count,
      totalWords: s.totalWords,
      avgWords: s.count > 0 ? Math.round(s.totalWords / s.count) : 0,
      totalReadingMin: Math.ceil(s.totalWords / 225)
    })).sort((a, b) => b.totalWords - a.totalWords);
  });

  // Status counts for a collection
  eleventyConfig.addFilter("statusCounts", (allContent) => {
    const counts = { draft: 0, review: 0, published: 0 };
    allContent.forEach(item => {
      if (item.data.status === "draft" || item.data.draft) counts.draft++;
      else if (item.data.status === "review") counts.review++;
      else counts.published++;
    });
    return counts;
  });

  // Serialize value as JSON (pretty-printed for readability)
  eleventyConfig.addFilter("toJSON", (value) => JSON.stringify(value, null, 2));

  // Transform a collection into API records — each item as { ...frontMatter, url }
  // Strips Eleventy internals like `collections`, `eleventy`, `page`, etc.
  eleventyConfig.addFilter("toApiItems", (items, baseUrl) => {
    const strip = new Set(["collections", "eleventy", "page", "pagination", "pkg", "tags", "layout", "permalink", "eleventyComputed", "eleventyExcludeFromCollections", "site", "authors", "quotes", "videos", "events", "timeline", "feeds", "changelog", "gallery", "playlists", "songs", "library", "projects"]);
    return items.map(item => {
      const out = { url: (baseUrl || "") + (item.url || "") };
      Object.keys(item.data || {}).forEach(k => {
        if (!strip.has(k) && typeof item.data[k] !== "function") {
          out[k] = item.data[k];
        }
      });
      return out;
    });
  });

  // Transform a content collection into API-ready article records
  eleventyConfig.addFilter("toApiArticles", (items, baseUrl) => {
    return items.map(item => ({
      title: item.data.title || "",
      description: item.data.description || "",
      url: (baseUrl || "") + (item.url || ""),
      slug: item.fileSlug || "",
      section: item.data.section || "",
      author: item.data.authorName || item.data.author || "",
      date: item.date ? item.date.toISOString().slice(0, 10) : "",
      tags: item.data.tags || [],
      featured: !!item.data.featured
    }));
  });

  // Topic stats: for each tag, returns { tag, count, related: [{ tag, cooccur }], top: [items] }
  // Related tags are ordered by how often they co-occur with the current tag.
  // `limit` controls how many related tags to return per topic (default 5).
  eleventyConfig.addFilter("topicStats", (allContent, limit = 5) => {
    const articlesByTag = new Map();
    allContent.forEach(item => {
      (item.data.tags || []).forEach(t => {
        if (t === "post" || t === "all") return;
        if (!articlesByTag.has(t)) articlesByTag.set(t, []);
        articlesByTag.get(t).push(item);
      });
    });

    const cooccur = new Map(); // "tagA|tagB" → count
    allContent.forEach(item => {
      const tags = (item.data.tags || []).filter(t => t !== "post" && t !== "all");
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          const key = [tags[i], tags[j]].sort().join("|");
          cooccur.set(key, (cooccur.get(key) || 0) + 1);
        }
      }
    });

    const related = (tag) => {
      const result = [];
      cooccur.forEach((count, key) => {
        const [a, b] = key.split("|");
        if (a === tag) result.push({ tag: b, cooccur: count });
        else if (b === tag) result.push({ tag: a, cooccur: count });
      });
      return result.sort((a, b) => b.cooccur - a.cooccur).slice(0, limit);
    };

    return Array.from(articlesByTag.entries())
      .map(([tag, items]) => ({
        tag,
        count: items.length,
        related: related(tag),
        top: items.sort((a, b) => (b.date || 0) - (a.date || 0)).slice(0, 3)
      }))
      .sort((a, b) => b.count - a.count);
  });

  // Active assignments: articles with an `assignedTo` field that aren't yet published.
  // Returns [{ title, url, assignedTo, dueDate, status, daysUntilDue, overdue }] sorted by due date.
  eleventyConfig.addFilter("activeAssignments", (allContent) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return allContent
      .filter(item => item.data.assignedTo)
      .filter(item => {
        const isPublished = !item.data.draft && item.data.status !== "draft" && item.data.status !== "review";
        return !isPublished;
      })
      .map(item => {
        const due = item.data.dueDate ? new Date(item.data.dueDate) : null;
        const daysUntilDue = due ? Math.ceil((due - today) / 86400000) : null;
        return {
          title: item.data.title,
          url: item.url,
          assignedTo: item.data.assignedTo,
          dueDate: due ? due.toISOString().slice(0, 10) : null,
          status: item.data.draft ? "draft" : (item.data.status || "published"),
          daysUntilDue,
          overdue: due && daysUntilDue < 0
        };
      })
      .sort((a, b) => {
        // Overdue first, then earliest due, then no-due-date last
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });
  });

  // Filter a collection by status (draft / review / published)
  eleventyConfig.addFilter("byStatus", (allContent, status) => {
    return allContent.filter(item => {
      const isDraft = item.data.status === "draft" || item.data.draft;
      const isReview = item.data.status === "review";
      if (status === "draft") return isDraft;
      if (status === "review") return isReview && !isDraft;
      if (status === "published") return !isDraft && !isReview;
      return false;
    });
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

  // ─── OG image rasterization: convert the SVGs in /og/ to PNGs ─────────────
  // Social platforms (Twitter, Facebook, LinkedIn, Slack, Discord) don't
  // render SVG in OG previews. We keep the SVGs (nice for direct viewing)
  // and also write a PNG alongside each one for sharing.
  eleventyConfig.on("eleventy.after", async () => {
    const ogDir = "./_site/og";
    if (!fs.existsSync(ogDir)) return;
    let Resvg;
    try { ({ Resvg } = require("@resvg/resvg-js")); } catch (e) {
      console.warn("@resvg/resvg-js not installed; skipping OG PNG generation.");
      return;
    }
    const files = fs.readdirSync(ogDir).filter(f => f.endsWith(".svg"));
    if (!files.length) return;
    let written = 0;
    for (const file of files) {
      const svgPath = path.join(ogDir, file);
      const pngPath = path.join(ogDir, file.replace(/\.svg$/, ".png"));
      try {
        const svg = fs.readFileSync(svgPath, "utf8");
        const resvg = new Resvg(svg, {
          fitTo: { mode: "width", value: 1200 },
          font: { loadSystemFonts: true }
        });
        const png = resvg.render().asPng();
        fs.writeFileSync(pngPath, png);
        written++;
      } catch (e) {
        console.warn("OG PNG failed for", file, "—", e.message);
      }
    }
    if (written) console.log(`[og] Rasterized ${written} OG image${written === 1 ? '' : 's'} to PNG.`);
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
