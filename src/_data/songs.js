const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

module.exports = function () {
  const dir = path.join(__dirname, '..', 'songs-data');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .map(file => matter(fs.readFileSync(path.join(dir, file), 'utf8')).data)
    .filter(s => s.title && s.artist);
};
