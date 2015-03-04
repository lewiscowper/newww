var generateCrumb = require("../crumb"),
    Code = require('code'),
    Lab = require('lab'),
    lab = exports.lab = Lab.script(),
    describe = lab.experiment,
    before = lab.before,
    after = lab.after,
    it = lab.test,
    expect = Code.expect,
    redisSessions = require('../../../adapters/redis-sessions');

var server,
    fakeuser = require('../../fixtures/users').fakeusercouch,
    fakeChangePass = require('../../fixtures/users').fakeuserChangePassword;

// prepare the server
before(function (done) {
  require('../../mocks/server')(function (obj) {
    server = obj;
    done();
  });
});

after(function (done) {
  server.stop(done);
});

describe('Getting to the password page', function () {
  it('redirects an unauthorized user to the login page', function (done) {
    var options = {
      url: '/password'
    };

    server.inject(options, function (resp) {
      expect(resp.statusCode).to.equal(302);
      expect(resp.headers.location).to.include('login');
      done();
    });
  });

  it('takes authorized users to the password page', function (done) {
    var options = {
      url: '/password',
      credentials: fakeuser
    };

    server.inject(options, function (resp) {
      expect(resp.statusCode).to.equal(200);
      var source = resp.request.response.source;
      expect(source.template).to.equal('user/password');
      done();
    });
  });
});

describe('Changing the password', function () {

  // mock out drop keys method
  var oldDropKeys;
  before(function (done) {
    oldDropKeys = redisSessions.dropKeysWithPrefix;
    redisSessions.dropKeysWithPrefix = function (name, cb) {

      if (name === 'fakeusercli') {
        return cb(new Error('redis is borken'));
      }

      return cb(null);
    };

    done();
  });

  // un-mock it for other tests :-)
  after(function (done) {
    redisSessions.dropKeysWithPrefix = oldDropKeys;
    done();
  });

  it('redirects an unauthorized user to the login page', function (done) {
    var options = {
      url: '/password',
      method: 'post',
      payload: fakeChangePass
    };

    server.inject(options, function (resp) {
      expect(resp.statusCode).to.equal(302);
      expect(resp.headers.location).to.include('login');
      done();
    });
  });

  it('renders an error if the cookie crumb is missing', function (done) {
    var options = {
      url: '/password',
      method: 'POST',
      payload: {},
      credentials: fakeuser,
    };

    server.inject(options, function (resp) {
      expect(resp.statusCode).to.equal(403);
      done();
    });
  });

  it('renders an error if unable to drop sessions for the user', function (done) {
    generateCrumb(server, function (crumb){
      var options = {
        url: '/password',
        method: 'post',
        payload: fakeChangePass,
        credentials: fakeuser,
        headers: { cookie: 'crumb=' + crumb }
      };

      // force redis error
      options.credentials.name = 'fakeusercli';

      options.payload.crumb = crumb;

      server.inject(options, function (resp) {
        expect(resp.statusCode).to.equal(500);
        var source = resp.request.response.source;
        expect(source.template).to.include('errors/internal');

        // undo the damage from earlier
        fakeuser.name = 'fakeusercouch';
        done();
      });
    });
  });

  it('allows authorized password changes to go through', function (done) {
    generateCrumb(server, function (crumb){
      var options = {
        url: '/password',
        method: 'post',
        payload: fakeChangePass,
        credentials: fakeuser,
        headers: { cookie: 'crumb=' + crumb }
      };

      options.payload.crumb = crumb;

      server.inject(options, function (resp) {
        expect(resp.statusCode).to.equal(302);
        expect(resp.headers.location).to.include('profile');
        done();
      });

    });
  });
});