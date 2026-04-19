const authorsArray = require('./authors.json');

// Convert array to object keyed by slug so templates can use authors[slug]
module.exports = function () {
  return authorsArray.reduce((obj, author) => {
    obj[author.slug] = author;
    return obj;
  }, {});
};
