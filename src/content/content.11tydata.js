// Content computed data for all articles under src/content/.
//
// - Scheduled publishing: articles with a future `date` field are not rendered.
//   Set SHOW_FUTURE=1 in the environment to preview future-dated content locally.
// - Email-only posts: articles with `emailOnly: true` in front matter don't
//   render a web page but still appear in the newsletter/RSS feed via collections.
module.exports = {
  // Articles are opt-in for the "Republish this story" CC grab-code block.
  // Set `syndicate: true` in front matter to surface the republish surface.
  syndicate: false,
  eleventyComputed: {
    eleventyExcludeFromCollections: (data) => {
      if (process.env.SHOW_FUTURE === "1") return data.eleventyExcludeFromCollections || false;
      if (data.draft && process.env.SHOW_DRAFTS !== "1") return true;
      const now = new Date();
      const pageDate = data.page && data.page.date ? new Date(data.page.date) : null;
      if (pageDate && pageDate > now) return true;
      return data.eleventyExcludeFromCollections || false;
    },
    permalink: (data) => {
      // Email-only posts: don't render a web page
      if (data.emailOnly) return false;
      if (process.env.SHOW_FUTURE === "1") return data.permalink;
      const now = new Date();
      const pageDate = data.page && data.page.date ? new Date(data.page.date) : null;
      if (pageDate && pageDate > now) return false;
      return data.permalink;
    }
  }
};
