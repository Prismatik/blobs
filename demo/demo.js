var server = require('../index.js');
var fs = require('fs');

server.on('request', (req, res) => {
  // Running this requires commenting out the 404 handler in the main file
  if (req.url !== '/') return;
  res.setHeader('Content-Type', 'text/html');
  res.end(fs.readFileSync('./demo.html'));
});
