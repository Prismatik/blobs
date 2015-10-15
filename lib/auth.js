var auth = require('miniauth');
var jwt = require('jsonwebtoken');
var qs = require('querystring');

if (process.env.REQUIRE_AUTH === 'false') delete process.env.REQUIRE_AUTH;
var basicAuthPresent = false;

Object.keys(process.env).forEach(env => {
  if (env.indexOf('PASS_') > -1) basicAuthPresent = true;
});

if (process.env.REQUIRE_AUTH) {
  if (!process.env.JWT_SECRET) {
    if (!basicAuthPresent) throw new Error("You have required authorization, but not configured any auth mechanisms");
  };
};

var basic = authHeader => {
  var authArray = new Buffer(authHeader.split(' ')[1], 'base64').toString('ascii').split(':');
  return auth.verify(authArray[0], authArray[1]);
}

var jwtAuth = (authHeader, querystring) => {
  var token = qs.parse(querystring).jwt;

  if (!token && authHeader) {
    token = authHeader.split(' ')[1];
  };

  if (!token) return Promise.reject(new Error(403));

  return new Promise((resolve, reject) => {
    jwt.verify(token, process.env.JWT_SECRET, (err, valid) => {
      if (err || !valid) return reject(new Error(403));
      return resolve();
    });
  });
};

module.exports = (headers, querystring) => {
  if (!process.env.REQUIRE_AUTH) return Promise.resolve();
  if (headers.authorization) var authType = headers.authorization.split(' ')[0];
  if (basicAuthPresent && authType && authType === 'Basic') return basic(headers.authorization)
    .catch(() => {
      throw new Error(403);
    });
  if (process.env.JWT_SECRET) return jwtAuth(headers.authorization, querystring)
  return Promise.reject(new Error(403));
};
