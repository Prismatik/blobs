require('required_env')([
  {var: 'PORT', default: 3000},
  'S3_BUCKET',
  'S3_KEY',
  'S3_SECRET',
  {var: 'REQUIRE_AUTH', default: true},
  {var: 'IMMUTABLE', default: true}
]);

var http = require('http');
var aws = require('aws-sdk');
var formidable = require('formidable');
var fs = require('fs');
var auth = require('./lib/auth');
var url = require('url');
var uuid = require('node-uuid');

var s3Client = new aws.S3({
  accessKeyId: process.env.S3_KEY,
  secretAccessKey: process.env.S3_SECRET,
});

const calcUploadKey = (name) => {
  if (process.env.IMMUTABLE === 'false') return name;
  if (process.env.IMMUTABLE === 'true') return uuid.v4() + '/' + name;
  throw new Error('Immutable is in a bad state: '+process.env.IMMUTABLE);
};

var uploadFile = (file) => {
  return new Promise((resolve, reject) => {
    s3Client.upload({
      Bucket: process.env.S3_BUCKET,
      Key: calcUploadKey(file.name),
      Body: fs.createReadStream(file.path)
    }, (err, data) => {
      if (err) return reject(err);
      resolve(data.Location);
    });
  });
};

var server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);

  if (parsedUrl.pathname !== '/file') return;

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method === 'OPTIONS') return res.end();

  auth(req.headers, parsedUrl.query)
  .then(() => {
    return new Promise((resolve, reject) => {
      var form = new formidable.IncomingForm();

      form.on('end', function(fields, files) {
        return resolve(Promise.all(this.openedFiles.map(uploadFile)));
      });

      form.parse(req);
    });
  }).then((urls) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(urls));
  }).catch((err) => {
    err.message === '403' ? res.statusCode = 403 : res.statusCode = 500;
    res.end();
  });
});

server.listen(process.env.PORT);

module.exports = server;
