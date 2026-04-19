const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

module.exports = function () {
  const dir = path.join(__dirname, '..', 'authors-data');
  if (!fs.existsSync(dir)) return {};
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .reduce((obj, file) => {
      const data = matter(fs.readFileSync(path.join(dir, file), 'utf8')).data;
      if (data.slug) obj[data.slug] = data;
      return obj;
    }, {});
};
