var vows    = require('vows'),
  _ = require('underscore'),
  request = require('request')
  , assert  = require('assert')
  , _static  = require('../../lib/node-static'),
  http = require('http');

var fileServer  = new _static.Server(__dirname + '/../fixtures');
var suite       = vows.describe('node-static');
var TEST_PORT   = 8080;
var TEST_SERVER = 'http://localhost:' + TEST_PORT;
var version     = _static.version.join('.');
var server;
var callback;

process.on("uncaughtException", function(err) {
	console.log("uncaughtException: ", err);
	console.log("uncaughtException stack: ", err.stack);
});

headers = {
  'requesting headers': {
    topic : function(){
      console.log('requesting headers');
      request.head(TEST_SERVER + '/index.html', this.callback);
    }
  }
}
headers['requesting headers']['should respond with node-static/' + version] = function(error, response, body){
	console.log('should respond with node-static/');
  assert.equal(response.headers['server'], 'node-static/' + version);
}

suite.addBatch({
  'once an http server is listening with a callback': {
    topic: function () {
      console.log('once an http server is listening with a callback');
      server = http.createServer(function (request, response) {
        fileServer.serve(request, response, function(err, result) {
          if (callback)
            callback(request, response, err, result);
          else
            request.end();
        });
      }).listen(TEST_PORT, this.callback)
    },
    'should be listening' : function(){
      /* This test is necessary to ensure the topic execution.
       * A topic without tests will be not executed */
	  console.log('should be listening' );
      assert.isTrue(true);
    }
  },
}).addBatch({
    'streaming a 404 page': {
      topic: function(){
        console.log('streaming a 404 page');
        callback = function(request, response, err, result) {
          if (err) {
            response.writeHead(err.status, err.headers);
            setTimeout(function() {
              response.end('Custom 404 Stream.')
            }, 100);
          }
        }
        request.get(TEST_SERVER + '/not-found', this.callback);
      },
      'should respond with 404' : function(error, response, body){
	  	console.log('should respond with 404' );
        assert.equal(response.statusCode, 404);
      },
      'should respond with the streamed content': function(error, response, body){
	  	console.log('should respond with the streamed content');
        callback = null;
        assert.equal(body, 'Custom 404 Stream.');
      }
    }
}).addBatch({
  'once an http server is listening without a callback': {
    topic: function () {
      console.log('once an http server is listening without a callback');
      server.close();
      server = http.createServer(function (request, response) {
        fileServer.serve(request, response);
      }).listen(TEST_PORT, this.callback)
    },
    'should be listening' : function(){
      /* This test is necessary to ensure the topic execution.
       * A topic without tests will be not executed */
      console.log('should be listening' );
      assert.isTrue(true);
    }
  }
}).addBatch({
    'requesting a file not found': {
      topic : function(){
        console.log('requesting a file not found');
        request.get(TEST_SERVER + '/not-found', this.callback);
      },
      'should respond with 404' : function(error, response, body){
	  	console.log('should respond with 404' );
        assert.equal(response.statusCode, 404);
      }
    }
})
.addBatch({
    'requesting a malformed URI': {
      topic: function(){
        console.log('requesting a malformed URI');
        request.get(TEST_SERVER + '/a%AFc', this.callback);
      },
      'should respond with 400': function(error, response, body){
        console.log('should respond with 400');
        assert.equal(response.statusCode, 400);
      }
    }
})
.addBatch({
  'serving hello.txt': {
    topic : function(){
      console.log('serving hello.txt');
      request.get(TEST_SERVER + '/hello.txt', this.callback);
    },
    'should respond with 200' : function(error, response, body){
		console.log('should respond with 200' );
      assert.equal(response.statusCode, 200);
    },
    'should respond with text/plain': function(error, response, body){
		console.log('should respond with text/plain');
      assert.equal(response.headers['content-type'], 'text/plain');
    },
    'should respond with hello world': function(error, response, body){
      console.log( 'should respond with hello world');
      assert.equal(body, 'hello world');
    }
  }
}).addBatch({
  'serving directory index': {
    topic : function(){
      console.log('serving directory index');
      request.get(TEST_SERVER, this.callback);
    },
    'should respond with 200' : function(error, response, body){
      console.log('should respond with 200' )
      assert.equal(response.statusCode, 200);
    },
    'should respond with text/html': function(error, response, body){
      console.log('should respond with text/html');
      assert.equal(response.headers['content-type'], 'text/html');
    }
  }
}).addBatch({
  'serving index.html from the cache': {
    topic : function(){
      console.log('serving index.html from the cache');
      request.get(TEST_SERVER + '/index.html', this.callback);
    },
    'should respond with 200' : function(error, response, body){
      console.log('should respond with 200' );
      assert.equal(response.statusCode, 200);
    },
    'should respond with text/html': function(error, response, body){
      console.log('should respond with text/html');
      assert.equal(response.headers['content-type'], 'text/html');
    }
  }
}).addBatch({
  'requesting with If-None-Match': {
    topic : function(){
      var _this = this;
      request.get(TEST_SERVER + '/index.html', function(error, response, body){
        request({
          method: 'GET',
          uri: TEST_SERVER + '/index.html',
          headers: {'if-none-match': response.headers['etag']}
        },
        _this.callback);
      });
    },
    'should respond with 304' : function(error, response, body){
      assert.equal(response.statusCode, 304);
    }
  },
  'requesting with If-None-Match and If-Modified-Since': {
    topic : function(){
      console.log('requesting with If-None-Match and If-Modified-Since');
      var _this = this;
      request.get(TEST_SERVER + '/index.html', function(error, response, body){

        var modified = Date.parse(response.headers['last-modified']);
        var oneDayLater = new Date(modified + (24 * 60 * 60 * 1000)).toUTCString();
        var nonMatchingEtag = '1111222233334444';
        request({
          method: 'GET',
          uri: TEST_SERVER + '/index.html',
          headers: {
            'if-none-match': nonMatchingEtag,
            'if-modified-since': oneDayLater
          }
        },
        _this.callback);
      });
    },
    'should respond with a 200': function(error, response, body){
      console.log('should respond with a 200');
      assert.equal(response.statusCode, 200);
    }
  }
})
/*.addBatch({
  'requesting POST': {
    topic : function(){
      console.log('requesting POST');
      request.post(TEST_SERVER + '/index.html', this.callback);
    },
    'should respond with 200' : function(error, response, body){
      console.log('requesting POST');
      assert.equal(response.statusCode, 200);
    },
    'should not be empty' : function(error, response, body){
      console.log('should not be empty');
      assert.isNotEmpty(body);
    }
  }
})*/
.addBatch({
  'requesting HEAD': {
    topic : function(){
      console.log('requesting HEAD');
      request.head(TEST_SERVER + '/index.html', this.callback);
    },
    'should respond with 200' : function(error, response, body){
		console.log('should respond with 200');
      assert.equal(response.statusCode, 200);
    },
    'head must has no body' : function(error, response, body){
		console.log('head must has no body');
      assert.isEmpty(body);
    }
  }
})
.addBatch(headers)
.addBatch({
  'addings custom mime types': {
    topic : function(){
      console.log('addings custom mime types');
      _static.mime.define({'application/font-woff': ['woff']});
      this.callback();
    },
    'should add woff' : function(error, response, body){
      console.log('should add woff' );
      assert.equal(_static.mime.lookup('woff'), 'application/font-woff');
    }
  }
})
.addBatch({
  'serving subdirectory index': {
    topic : function(){
      console.log('serving subdirectory index');
      request.get(TEST_SERVER + '/there/', this.callback); // with trailing slash
    },
    'should respond with 200' : function(error, response, body){
      console.log('should respond with 200' );
      assert.equal(response.statusCode, 200);
    },
    'should respond with text/html': function(error, response, body){
      console.log('should respond with text/html');
      assert.equal(response.headers['content-type'], 'text/html');
    }
  }
})
.addBatch({
  'redirecting to subdirectory index': {
    topic : function(){
      console.log('redirecting to subdirectory index');
      request.get({ url: TEST_SERVER + '/there', followRedirect: false }, this.callback); // without trailing slash
    },
    'should respond with 301' : function(error, response, body){
      console.log('should respond with 301' );
      assert.equal(response.statusCode, 301);
    },
    'should respond with location header': function(error, response, body){
      console.log( 'should respond with location header');
      assert.equal(response.headers['location'], '/there/'); // now with trailing slash
    },
    'should respond with empty string body' : function(error, response, body){
      console.log('should respond with empty string body' );
      assert.equal(body, '');
    }
  }
})
.addBatch({
  'requesting a subdirectory (with trailing slash) not found': {
    topic : function(){
      console.log('requesting a subdirectory (with trailing slash) not found');
      request.get(TEST_SERVER + '/notthere/', this.callback); // with trailing slash
    },
    'should respond with 404' : function(error, response, body){
      console.log('should respond with 404' );
      assert.equal(response.statusCode, 404);
    }
  }
})
.addBatch({
  'requesting a subdirectory (without trailing slash) not found': {
    topic : function(){
      console.log('requesting a subdirectory (without trailing slash) not found');
      request.get({ url: TEST_SERVER + '/notthere', followRedirect: false }, this.callback); // without trailing slash
    },
    'should respond with 404' : function(error, response, body){
      console.log('should respond with 404' );
      assert.equal(response.statusCode, 404);
    }
  }
})
.addBatch({
  'verify cache control header by default': {
      topic: function() {
        console.log('verify cache control header by default');
        request.get({
          url: TEST_SERVER + '/index.html'
        }, this.callback);
      },
      'the value of max-age component from cache-control header must be 3600s = 1hour' : function(error, response, body) {
        var cacheControl = response.headers['cache-control'],
            components = {},
            splitComponent;

            _.each(cacheControl.split(";"), function(component){
                splitComponent = component.split("=");                
                components[splitComponent[0].trim()] = splitComponent[1];
            });
            console.log('components: ', components);

        assert.equal(components['max-age'], '3600');
      },
  }
})
.addBatch({
  'verify server setted options': {
      topic: function() {
        console.log('verify cache control header with max-age param setted');
        server.close();
        server = new http.Server; 
        //create new file server with cache = 7200, for 2 hours of freshness
        fileServer = new _static.Server(__dirname + '/../fixtures', {
                                                                      cache: 7200, 
                                                                      serverInfo: 'petruchio',
                                                                      headers: {
                                                                        'x-petruchio': 'ticu',
                                                                      },
                                                                    }
                                      );

        server.on('request', function(req, res) {
          fileServer.serve(req, res);
        });

        var that = this;
        server.on('listening', function() {
          request.get({
            url: TEST_SERVER + '/index.html'
          }, that.callback);
        });

        server.listen(TEST_PORT);
      },
      'the value of max-age component from cache-control header must be 7200s = 2hours' : function(error, response, body) {
        var cacheControl = response.headers['cache-control'],
            components = {},
            splitComponent;

            _.each(cacheControl.split(";"), function(component){
                splitComponent = component.split("=");                
                components[splitComponent[0].trim()] = splitComponent[1];
            });

        assert.equal(components['max-age'], '7200');
      },
      'the value of server header must be "petruchio"': function(err, resp, body) {
          console.log('the value of server header must be "petruchio"');
          assert.equal(resp.headers['server'], 'petruchio');
      },
     'the value header with name x-petruchio must be "ticu"': function(err, resp, body) {
          console.log('the value header with name "x-petruchio" must be "ticu"');
          assert.equal(resp.headers['x-petruchio'], 'ticu');
     },
  }
})
.export(module);
