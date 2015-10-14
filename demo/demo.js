var server = require('../index.js');
var fs = require('fs');

server.on('request', (req, res) => {
  if (req.url !== '/') return;
  res.setHeader("Content-Type", "text/html");
  res.end(fs.readFileSync('./demo.html'));
});
