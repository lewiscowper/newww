var generateCrumb = require("../crumb"),
    Code = require('code'),
    Lab = require('lab'),
    lab = exports.lab = Lab.script(),
    describe = lab.experiment,
    before = lab.before,
    after = lab.after,
    it = lab.test,
    expect = Code.expect;

var server, tokenUrl,
    fakeuser = require('../../fixtures/users').fakeusercouch,
    fakeusercli = require('../../fixtures/users').fakeusercli;

var postName = function (name_email, crumb) {
  return {
    url: '/forgot',
    method: 'POST',
    payload: {
      name_email: name_email,
      crumb: crumb
    },
    headers: { cookie: 'crumb=' + crumb }
  };
};

// prepare the server
before(function (done) {
  require('../../mocks/server')(function (obj) {
    server = obj;
    server.app.cache._cache.connection.client = {};
    done();
  });
});

after(function (done) {
  delete server.app.cache._cache.connection.client;
  server.stop(done);
});

describe('Accessing the forgot password page', function () {
  it('loads the forgot password page', function (done) {
    var options = {
      url: '/forgot'
    };

    server.inject(options, function (resp) {
      var source = resp.request.response.source;
      expect(source.template).to.equal('user/password-recovery-form');
      expect(resp.statusCode).to.equal(200);
      done();
    });
  });

  it('renders an error if the cookie crumb is missing', function (done) {
    var options = {
      url: '/forgot',
      method: 'POST',
      payload: {}
    };

    server.inject(options, function (resp) {
      expect(resp.statusCode).to.equal(403);
      done();
    });
  });

  it('renders an error if no name or email is submitted', function (done) {
    generateCrumb(server, function (crumb){
      server.inject(postName(null, crumb), function (resp) {
        var source = resp.request.response.source;
        expect(source.template).to.equal('user/password-recovery-form');
        expect(source.context.error).to.equal('All fields are required');
        expect(resp.statusCode).to.equal(400);
        done();
      });
    });
  });

  it('renders an error if the username is invalid', function (done) {
    generateCrumb(server, function (crumb){
      server.inject(postName('.baduser', crumb), function (resp) {
        var source = resp.request.response.source;
        expect(source.template).to.equal('user/password-recovery-form');
        expect(source.context.error).to.equal('Need a valid username or email address');
        expect(resp.statusCode).to.equal(400);
        done();
      });
    });
  });

  it('renders an error if the email is invalid', function (done) {
    generateCrumb(server, function (crumb){
      server.inject(postName('bad@email', crumb), function (resp) {
        var source = resp.request.response.source;
        expect(source.template).to.equal('user/password-recovery-form');
        expect(source.context.error).to.equal('Need a valid username or email address');
        expect(resp.statusCode).to.equal(400);
        done();
      });
    });
  });
});

describe('Looking up a user', function () {
  describe('by username', function () {
    it('renders an error if the username doesn\'t exist', function (done) {
      var name = 'mr-perdido';
      generateCrumb(server, function (crumb){
        server.inject(postName(name, crumb), function (resp) {
          var source = resp.request.response.source;
          expect(source.template).to.equal('user/password-recovery-form');
          expect(source.context.error).to.equal('user ' + name + ' not found');
          expect(resp.statusCode).to.equal(404);
          done();
        });
      });
    });

    it('renders an error if the user does not have an email address', function (done) {
      var name = 'forrestnoemail';
      generateCrumb(server, function (crumb){
        server.inject(postName(name, crumb), function (resp) {
          var source = resp.request.response.source;
          expect(source.template).to.equal('user/password-recovery-form');
          expect(source.context.error).to.equal('Username does not have an email address; please contact support');
          expect(resp.statusCode).to.equal(400);
          done();
        });
      });
    });

    it('renders an error if the user\'s email address is invalid', function (done) {
      var name = 'forrestbademail';
      generateCrumb(server, function (crumb){
        server.inject(postName(name, crumb), function (resp) {
          var source = resp.request.response.source;
          expect(source.template).to.equal('user/password-recovery-form');
          expect(source.context.error).to.equal('Username\'s email address is invalid; please contact support');
          expect(resp.statusCode).to.equal(400);
          done();
        });
      });
    });

    it('sends an email when everything finally goes right', function (done) {
      var name = 'fakeuser';
      generateCrumb(server, function (crumb){
        server.inject(postName(name, crumb), function (resp) {
          expect(resp.request.response.source.template).to.equal('user/password-recovery-form');
          expect(resp.statusCode).to.equal(200);
          done();
        });
      });
    });
  });

  describe('by email', function () {
    it('renders an error if the email doesn\'t exist', function (done) {
      generateCrumb(server, function (crumb){
        server.inject(postName('doesnotexist@boom.com', crumb), function (resp) {
          var source = resp.request.response.source;
          expect(source.template).to.equal('user/password-recovery-form');
          expect(source.context.error).to.equal('No user found with email address doesnotexist@boom.com');
          expect(resp.statusCode).to.equal(400);
          done();
        });
      });
    });

    it('renders a list of emails if the email matches more than one username', function (done) {
      generateCrumb(server, function (crumb){
        server.inject(postName("forrest@example.com", crumb), function (resp) {
          var source = resp.request.response.source;
          expect(source.template).to.equal('user/password-recovery-form');
          expect(resp.statusCode).to.equal(200);
          expect(source.context.error).to.not.exist();
          expect(source.context.users).to.include("forrest");
          expect(source.context.users).to.include("forrest2");
          done();
        });
      });
    });

    it('sends an email when a username is chosen from the dropdown', function (done) {
      generateCrumb(server, function (crumb){
        var options = {
          url: '/forgot',
          method: 'POST',
          payload: {
            selected_name: "forrest",
            crumb: crumb
          },
          headers: { cookie: 'crumb=' + crumb }
        };

        server.inject(options, function (resp) {
          expect(resp.request.response.source.template).to.equal('user/password-recovery-form');
          expect(resp.statusCode).to.equal(200);
          done();
        });
      });
    });

    it('sends an email when everything finally goes right', function (done) {
      generateCrumb(server, function (crumb){
        server.inject(postName("onlyone@boom.com", crumb), function (resp) {
          expect(resp.request.response.source.template).to.equal('user/password-recovery-form');
          expect(resp.statusCode).to.equal(200);
          done();
        });
      });
    });
  });
});

describe('Using a token', function () {
  it('renders an error if the token does not exist'/*, function (done) {
    server.inject('/forgot/bogus', function (resp) {
      var source = resp.request.response.source;
      expect(source.template).to.equal('errors/internal');
      expect(resp.statusCode).to.equal(500);
      done();
    });
  }*/);

  it('changes the password with a proper token'/*, function (done) {
    server.inject(tokenUrl, function (resp) {
      var source = resp.request.response.source;
      expect(source.template).to.equal('user/password-changed');
      expect(source.context.password).to.exist();
      expect(resp.statusCode).to.equal(200);
      done();
    });
  }*/);
});