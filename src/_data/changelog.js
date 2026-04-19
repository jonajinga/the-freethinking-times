const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

module.exports = function () {
  const dir = path.join(__dirname, '..', 'changelog-data');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(file => matter(fs.readFileSync(path.join(dir, file), 'utf8')).data)
    .filter(c => c.title && c.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
};
