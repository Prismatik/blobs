var test = require('blue-tape');
var tapSpec = require('tap-spec');
var request = require('request-promise');
var fs = require('fs');
var jwt = require('jsonwebtoken');

process.env.PASS_eric = '$2a$10$HA4xm8ZPmNB9UyUiD/bwOu8xW2oGG/g0t8XlHhQFfmkNPA4fBofkW';
process.env.JWT_SECRET = 'ohai';
process.env.REQUIRE_AUTH=false;

var server = require('../index.js');

var url = 'http://localhost:3000/file';

test.createStream()
  .pipe(tapSpec())
  .pipe(process.stdout);

test('POST /file with a single file should return 200', () => {
  var formData = {
    file: fs.createReadStream(__dirname + '/testfile1')
  };
  return request.post({url: url, formData: formData});
});

test('POST /file with multiple files should return 200', () => {
  var formData = {
    files: [fs.createReadStream(__dirname + '/testfile1'), fs.createReadStream(__dirname + '/testfile2')]
  };
  return request.post({url: url, formData: formData});
});

test('POST /file with a single file should end up with the file at the URL', (t) => {
  var formData = {
    file: fs.createReadStream(__dirname + '/testfile1')
  };
  return request.post({url: url, formData: formData})
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
  return request.post({url: url, formData: formData})
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

test('set REQUIRE_AUTH', (t) => {
  process.env.REQUIRE_AUTH = true;
  t.end();
});

test('POST /file when authRequired and no auth given should return 403', (t) => {
  var formData = {
    file: fs.createReadStream(__dirname + '/testfile1')
  };
  return request.post({url: url, formData: formData})
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
  return request.post({url: url, auth: auth, formData: formData})
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
  return request.post({url: url, auth: auth, formData: formData})
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
  return request.post({url: url, auth: auth, formData: formData})
});

test('POST /file when authRequired and valid jwt auth given via querystring should return 200', (t) => {
  var formData = {
    file: fs.createReadStream(__dirname + '/testfile1'),
  };
  const token = jwt.sign({foo: 'bar'}, process.env.JWT_SECRET);
  return request.post({url: url+'?jwt='+token, formData: formData})
});

test('end', t => {
  server.close(() => {
    t.end();
  });
});
