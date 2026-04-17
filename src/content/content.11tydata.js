// Scheduled publishing: articles with a future `date` field are not rendered.
// Set SHOW_FUTURE=1 in the environment to preview future-dated content locally.
module.exports = {
  eleventyComputed: {
    eleventyExcludeFromCollections: (data) => {
      if (process.env.SHOW_FUTURE === "1") return data.eleventyExcludeFromCollections || false;
      if (data.draft) return true;
      const now = new Date();
      const pageDate = data.page && data.page.date ? new Date(data.page.date) : null;
      if (pageDate && pageDate > now) return true;
      return data.eleventyExcludeFromCollections || false;
    },
    permalink: (data) => {
      if (process.env.SHOW_FUTURE === "1") return data.permalink;
      const now = new Date();
      const pageDate = data.page && data.page.date ? new Date(data.page.date) : null;
      if (pageDate && pageDate > now) return false;
      return data.permalink;
    }
  }
};
