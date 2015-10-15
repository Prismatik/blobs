var auth = require('miniauth');

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

module.exports = (req) => {
  if (!process.env.REQUIRE_AUTH) return Promise.resolve();
  if (basicAuthPresent && req.headers.authorization) return basic(req.headers.authorization)
    .catch(() => {
      throw new Error(403);
    });
  return Promise.reject(new Error(403));
};
