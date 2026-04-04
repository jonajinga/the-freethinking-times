// Derives a flat array of author slugs from authors.json
// Used for per-author RSS feed pagination
const authors = require("./authors.json");
module.exports = Object.keys(authors);
