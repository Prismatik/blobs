var http = require('http');
var aws = require('aws-sdk');
var formidable = require('formidable');
var fs = require('fs');

require('required_env')([
  {var: 'PORT', default: 3000},
  'S3_BUCKET',
  'S3_KEY',
  'S3_SECRET'
]);

var bucket = process.env.S3_BUCKET;
var s3Client = new aws.S3({
  accessKeyId: process.env.S3_KEY,
  secretAccessKey: process.env.S3_SECRET,
});

var server = http.createServer((req, res) => {
  if (req.url !== '/file') return;
  var form = new formidable.IncomingForm();

  form.on('end', function(fields, files) {
    var tasks = this.openedFiles.map((file) => {
      return new Promise((resolve, reject) => {
        s3Client.upload({Bucket: process.env.S3_BUCKET, Key: file.name, Body: fs.createReadStream(file.path)}, (err, data) => {
          if (err) return reject(err);
          resolve(data.Location);
        });
      });
    });
    Promise.all(tasks).then((urls) => {
      res.end(JSON.stringify(urls));
    });
  });
  form.parse(req);
});

server.listen(process.env.PORT);

module.exports = server;
