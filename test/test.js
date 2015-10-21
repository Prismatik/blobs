var test = require('blue-tape');
var tapSpec = require('tap-spec');
var request = require('request-promise');
var fs = require('fs');
var url = require('url');
var jwt = require('jsonwebtoken');
var aws = require('aws-sdk');

var s3Client = new aws.S3({
  accessKeyId: process.env.S3_KEY,
  secretAccessKey: process.env.S3_SECRET,
});

process.env.PASS_eric = '$2a$10$HA4xm8ZPmNB9UyUiD/bwOu8xW2oGG/g0t8XlHhQFfmkNPA4fBofkW';
process.env.JWT_SECRET = 'ohai';
process.env.REQUIRE_AUTH=false;

var server = require('../index.js');

var serverUrl = 'http://localhost:3000/file';

var uploadedFiles = [];

var pushFiles = files => {
  parsed = JSON.parse(files);
  parsed.forEach( file => {
    uploadedFiles.push(url.parse(file).pathname.substring(1))
  });
  return files;
};

test.createStream()
  .pipe(tapSpec())
  .pipe(process.stdout);

test('POST /file with a single file should return 200', () => {
  var formData = {
    file: fs.createReadStream(__dirname + '/testfile1')
  };
  return request.post({url: serverUrl, formData: formData})
  .then(pushFiles);
});

test('POST /file with multiple files should return 200', () => {
  var formData = {
    files: [fs.createReadStream(__dirname + '/testfile1'), fs.createReadStream(__dirname + '/testfile2')]
  };
  return request.post({url: serverUrl, formData: formData})
  .then(pushFiles);
});

test('POST /file with a single file should end up with the file at the URL', (t) => {
  var formData = {
    file: fs.createReadStream(__dirname + '/testfile1')
  };
  return request.post({url: serverUrl, formData: formData})
  .then(pushFiles)
  .then((urls) => {
    urls = JSON.parse(urls);
    return request.get(urls[0])
    .then((data) => {
      t.equal(data, fs.readFileSync(__dirname + '/testfile1').toString(), 'curled data should match local');
    });
  });
});

test('POST /file with a multiple files should end up with the files at the URLs', (t) => {
  var formData = {
    files: [fs.createReadStream(__dirname + '/testfile1'), fs.createReadStream(__dirname + '/testfile2')]
  };
  return request.post({url: serverUrl, formData: formData})
  .then(pushFiles)
  .then((urls) => {
    urls = JSON.parse(urls);
    var tasks = urls.map((url) => {
      return request.get(url).then((data) => {
        t.equal(data, fs.readFileSync(__dirname + '/testfile1').toString(), 'curled data should match local');
      });
    });
    return Promise.all(tasks);
  });
});

test('POSTing the same file twice should result in different uploads/URLs if immutable is true', (t) => {
  var formData = {
    file: fs.createReadStream(__dirname + '/testfile1')
  };
  var postFile = () => {
    return request.post({url: serverUrl, formData: formData})
    .then(pushFiles);
  };

  return Promise.all([postFile(), postFile()])
  .then((urls) => {
    urls = urls.map(JSON.parse);
    return t.notEqual(urls[0][0], urls[1][0], 'URLs must not be the same');
  });
});

test('POSTing the same file twice should result in the same uploads/URLs if immutable is false', (t) => {
  process.env.IMMUTABLE = false;
  var formData = {
    file: fs.createReadStream(__dirname + '/testfile1')
  };
  var postFile = () => {
    return request.post({url: serverUrl, formData: formData})
    .then(pushFiles);
  };

  return Promise.all([postFile(), postFile()])
  .then((urls) => {
    urls = urls.map(JSON.parse);
    return t.equal(urls[0][0], urls[1][0], 'URLs must be the same');
  }).then(() => {
    process.env.IMMUTABLE = true;
  });
});

test('set REQUIRE_AUTH', (t) => {
  process.env.REQUIRE_AUTH = true;
  t.end();
});

test('POST /file when authRequired and no auth given should return 403', (t) => {
  var formData = {
    file: fs.createReadStream(__dirname + '/testfile1')
  };
  return request.post({url: serverUrl, formData: formData})
  .then(t.fail)
  .catch(err => {
    t.equal(err.statusCode, 403, 'statusCode should be 403');
  });
});

test('POST /file when authRequired and invalid basic auth given should return 403', (t) => {
  var formData = {
    file: fs.createReadStream(__dirname + '/testfile1'),
  };
  var auth = {
    user: 'foo',
    pass: 'bar'
  };
  return request.post({url: serverUrl, auth: auth, formData: formData})
  .then(t.fail)
  .catch(err => {
    t.equal(err.statusCode, 403, 'statusCode should be 403');
  });
});

test('POST /file when authRequired and invalid jwt auth given should return 403', (t) => {
  var formData = {
    file: fs.createReadStream(__dirname + '/testfile1'),
  };
  const auth = {
    bearer: 'hai'
  }
  return request.post({url: serverUrl, auth: auth, formData: formData})
  .then(t.fail)
  .catch(err => {
    t.equal(err.statusCode, 403, 'statusCode should be 403');
  });
});

test('POST /file when authRequired and valid jwt auth given should return 200', (t) => {
  var formData = {
    file: fs.createReadStream(__dirname + '/testfile1'),
  };
  const auth = {
    bearer: jwt.sign({foo: 'bar'}, process.env.JWT_SECRET)
  }
  return request.post({url: serverUrl, auth: auth, formData: formData})
  .then(pushFiles)
});

test('POST /file when authRequired and valid jwt auth given via querystring should return 200', (t) => {
  var formData = {
    file: fs.createReadStream(__dirname + '/testfile1'),
  };
  const token = jwt.sign({foo: 'bar'}, process.env.JWT_SECRET);
  return request.post({url: serverUrl+'?jwt='+token, formData: formData})
  .then(pushFiles)
});

test('OPTIONS /file should return a response with "Access-Control-Allow-Origin" present', (t) => {
  return request({method: 'OPTIONS', url: serverUrl, resolveWithFullResponse: true}).then( (res) => {
    t.ok(res.headers['access-control-allow-origin']);
  });
});

test('OPTIONS /file should return a response with "Access-Control-Allow-Headers" set to "accept, authorization, content-type"', (t) => {
  return request({method: 'OPTIONS', url: serverUrl, resolveWithFullResponse: true}).then( (res) => {
    t.equal(res.headers['access-control-allow-headers'], 'accept, authorization, content-type', 'Allow for all relevant headers is present');
  });
});

test('end', t => {
  server.close(() => {
    t.end();
  });
});

test('cleanup', t => {
  s3Client.deleteObjects({
    Bucket: process.env.S3_BUCKET,
    Delete: {
      Objects: uploadedFiles.map( file => { return {Key: file} })
    }
  }, (err, data) => {
    if (err) return t.fail(err);
    t.end();
  });
});
