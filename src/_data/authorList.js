const authorsArray = require('./authors.json');
module.exports = authorsArray.map(a => a.slug);
