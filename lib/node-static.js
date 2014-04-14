var fs = require('fs'),
	url = require('url'),
	path = require('path'),
	mime = require('./mime'),
	etag = require('./etag'),
	async = require('async'),
	messages = {
		304: 'Not modified',
		404: 'Custom 404 Stream',
		500: "Internal server error", 
	};


exports.mime = mime;
exports.version = [
	'node-static',
	'0',
];

exports.Server = Server;

/* function implementation */
function Server(address, options) {
	
	/* diserved directory */
	var directory = __dirname;

	var stat;
	if(address) {
		try {
				stat = fs.lstatSync(address);			
		} catch (err) {
			if(err.code == 'ENOENT')
				throw new Error("no such file or directory");

			throw err;
		}

		if(stat.isDirectory()) {
			directory = address;
		} else {
			throw new Error("no such file or directory");		
		}
	} 

	/* public functions */
	this.serve = function(request, response, callback) {
		var requestUrl,
			options = {};

		try{
			requestUrl = decodeURIComponent(request.url);
		} catch(e) {
			if(e instanceof URIError) {
				e.status = 400;
				errorCallback(e, request, response, callback);
				return;
			} else {
				throw e;
			}
		}

		var parsedUrl = url.parse(request.url),
			extName = options.extension = path.extname(parsedUrl.pathname), 
			pathName = options.path = path.join(directory, parsedUrl.pathname),
			fileStat;

		try {
			fileStat = fs.lstatSync(pathName);
		} catch (err) {
			if(err.code == 'ENOENT') {
				response.statusCode = 404;
			} else {
				response.statusCode = 500;
			}

			errorCallback(err, request, response, callback);
			return;
		}

		options['last-modified'] = fileStat.mtime.toUTCString();
		options['isNotDir'] = !fileStat.isDirectory();

		async.series([
				function(done) {
					console.log('process request headers');
					processRequestHeaders(options, done, request, response);
				},
				function(done) {
					console.log('process request body');
					processRequestBody(options, done, request, response);	
				},
				function(done) {
					console.log('generate response headers');
					generateResponseHedears(options, done, request, response);
				},
			],
			function(err) {
				console.log('err: ', err);
				console.log("final callback");
				if(err) {
					errorCallback(err, request, response, callback);
				} else {
					generateResponseBody(options, request, response, callback);
				}
		});
	}
}

function errorCallback(err, request, response, callback) {
		err.headers = err.headers || {};
		err.status = err.status || 404;

		if(callback) {
			callback(err);
		} else {
			response.statusCode = err.status;
			response.end(messages[err.status]);
		}
}

function processRequestHeaders(options, done, request, response){

	async.series([
			function(done1) {
				if(options.isNotDir) {
					processIfNoneMatch(options, done1, request, response);
				} else {
					done1();
				}
			},
				
	], 
	function(err) {
		if(err) {
			err.status = err.status || 500; //server internal error
		}

		done(err);
	});
};

function processIfNoneMatch(options, done, request, response) {
	var clientETag = request.headers['if-none-match'];

	if(clientETag){ 
		var serverETag = etag.getSync(options.path);
		if(serverETag && clientETag === serverETag) {
			var err = new Error;
			err.statusCode = 304;
			done(err);
			return;
		} else if (!serverETag) {
			/*compute etag and compare*/
			etag.compute(options.path, function(err, newETag) {
				if(err) {
					err.status = 500;
					done(err);
					return;
				}

				etag.setSync(options.path, newETag);
				if(newETag === clientETag) {
					err = new Error;
					err.statusCode = 304;
					done(err);
					return;
				} else {
					done();
					return;
				}
			});
		}
	} else {
		done();
		return;
	}
} 

function processRequestBody(options, done, request, response){
	/* isBodyModified parameter is necessary for recompute etag if is the case */
	options.isBodyModified = true;
	done();
};	

function generateResponseHedears(options, done, request, response){
		async.series([
				function(done1) {
					response.setHeader('content-type', mime.lookup(options.extension));
					response.setHeader('last-modified', options['last-modified']);
					done1();
				},
				function(done1) {
					if(!options.isNotDir) {
						done1();
						return;
					}

					var respETag;
					if(options.isBodyModified || !(respETag = etag.getSync(options.path)) ) {
						etag.compute(options.path, function(err, computedETag) {
							if(err) {
								err.status = 500;
								done1(err);
								return;
							}

							etag.setSync(options.path, computedETag);
							response.setHeader('etag', respETag);
							done1();
						});
					} else {
						response.setHeader('etag', respETag);
						done1();
					}
				},
		],
		function(err) {
			if(err) {
				err.status = err.status || 500;
			}

			done(err);
		});
};

function generateResponseBody(options, request, response, callback){
	switch(request.method) {
		case "POST":
			break;

		case "GET":

				if(!options.isNotDir) {
					response.end();
					return;
				}
				var readStream = fs.createReadStream(options.path);
				readStream.pipe(response);
				readStream.on('error', function(err) {
					switch(err.code) {
						case 'ENOENT':
							err.status = 404;	
							break;
						case 'EISDIR':
							err.status = 200;	
							break;
						default:
							err.status = 500;
							break;
					};

					errorCallback(err, request, response, callback);
				});
				break;

		case "HEAD":
			break;
		default:
			break;
	}
};
