const fs = require('fs');
const path = require('path');

module.exports = function () {
  const dir = path.join(__dirname, 'authorProfiles');
  const result = {};
  if (!fs.existsSync(dir)) return result;
  fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .forEach(file => {
      const slug = file.replace('.json', '');
      try {
        result[slug] = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      } catch (e) { /* skip malformed files */ }
    });
  return result;
};
