require('required_env')([
  {var: 'PORT', default: 3000},
  'S3_BUCKET',
  'S3_KEY',
  'S3_SECRET',
  {var: 'REQUIRE_AUTH', default: true},
  {var: 'IMMUTABLE', default: true},
  {var: 'CORS_DOMAIN', default: '*'}
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

var deleteFile = (file) => {
  return new Promise((resolve, reject) => {
    fs.unlink(file.path, (err) => {
      if (err) {
        console.error('error deleting file!', err, file.path);
        // We don't reject since that would halt the execution of the Promise.all wrapping this. Just because one file fails to delete doesn't mean we shouldn't keep trying the rest of them.
      };
      resolve();
    });
  });
};

var server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);

  if (parsedUrl.pathname !== '/file') {
    res.statusCode = 404;
    return res.end();
  };

  if (process.env.CORS_DOMAIN !== 'false') {
    res.setHeader('Access-Control-Allow-Origin', process.env.CORS_DOMAIN);
    res.setHeader('Access-Control-Allow-Headers', 'accept, authorization, content-type');
  };

  if (req.method === 'OPTIONS') return res.end();
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end();
  }

  var openedFiles = null;

  auth(req.headers, parsedUrl.query)
  .then(() => {
    return new Promise((resolve, reject) => {
      var form = new formidable.IncomingForm();

      form.on('end', function(fields, files) {
        openedFiles = this.openedFiles;
        return resolve(Promise.all(this.openedFiles.map(uploadFile)));
      });

      form.parse(req);
    });
  }).then((urls) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(urls));
  }).catch((err) => {
    err.message === '403' ? res.statusCode = 403 : res.statusCode = 500;
    res.end();
  }).then(() => {
    return Promise.all(openedFiles.map(deleteFile));
  });
});

server.listen(process.env.PORT);

module.exports = server;
