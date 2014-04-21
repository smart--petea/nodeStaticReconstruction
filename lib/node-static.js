var fs = require('fs'),
	_ = require('underscore'),
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
function Server(address, serverOptions) {
	var defaultParam = {
		cache: 3600, //minutes
		serverInfo: 'node-static/' + exports.version.join("."),//server info
	};

	serverOptions = serverOptions || {};
	serverOptions = _.extend(defaultParam, serverOptions);
	
	
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
			options = {
				headers: {
					'cache-control': " max-age=" + serverOptions.cache,
					'server': serverOptions.serverInfo,
				}
			};
		_.extend(options.headers, serverOptions.headers);

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
			pathNameRaw = 	options.rawPath = parsedUrl.pathname,
			pathNameAbs = options.absPath = path.join(directory, parsedUrl.pathname),
			fileStat;

		try {
			fileStat = fs.lstatSync(pathNameAbs);
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
					//console.log('process request headers');
					processRequestHeaders(options, done, request, response);
				},
				function(done) {
					//console.log('process request body');
					processRequestBody(options, done, request, response);	
				},
				function(done) {
					//console.log('generate response headers');
					generateResponseHedears(options, done, request, response);
				},
			],
			function(err) {
				//console.log("final callback");
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
					//console.log('processIfNoneMatch');
					processIfNoneMatch(options, done1, request, response);
				} else {
					done1();
				}
			},

			function(done1) {
				//console.log("processIfModifiedSince");
				processIfModifiedSince(options, done1, request, response);
			},
				
	], 
	function(err) {
		if(err) {
			err.status = err.status || 500; //server internal error
		}

		done(err);
	});
};

function processIfModifiedSince(options, done, request, response){
	var requestTime = (new Date(request.headers['last-modified'])).getTime();

	if(isNaN(requestTime)) {
		done();
		return;
	}

	var lastTime = (new Date(options['last-modified'])).getTime();

	if(requestTime < lastTime) {
		var err = new Error;
		err.status = 304;

		done(err);
		return;
	}
};

function processIfNoneMatch(options, done, request, response) {
	var clientETag = request.headers['if-none-match'];

	if(clientETag){ 
		var serverETag = etag.getSync(options.absPath);
		if(serverETag && clientETag === serverETag) {
			var err = new Error;
			err.status= 304;
			done(err);
			return;
		} else if(serverETag) {
			done();
			return;
		} else {
			/*compute etag and compare*/
			etag.compute(options.absPath, function(err, newETag) {
				if(err) {
					err.status = 500;
					done(err);
					return;
				}

				etag.setSync(options.absPath, newETag);
				if(newETag === clientETag) {
					err = new Error;
					err.status = 304;
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
	/* after body modify do not forget refresh options['last-modified'] */

	options.isBodyModified = true;
	done();
};	

function generateResponseHedears(options, done, request, response){
		async.series([
				/* compute etag */
				function(done1) {
					if(!options.isNotDir) {
						done1();
						return;
					}

					var respETag;
					if(options.isBodyModified || !(respETag = etag.getSync(options.absPath)) ) {
						etag.compute(options.absPath, function(err, computedETag) {
							if(err) {
								err.status = 500;
								done1(err);
								return;
							}

							etag.setSync(options.absPath, computedETag);
							options.headers['etag'] = computedETag;
							done1();
						});
					} else {
						options.headers['etag'] = respETag;
						done1();
					}
				},
				function(done1) {
					//* generate 301 code and location if the path address a directory and do not end with '/' symbol 
					if(options.isNotDir) {
						done1();
						return;
					}
					
					var rawPath = options.rawPath.trim();
					if(rawPath[rawPath.length - 1] != '/') {
						var err = new Error;
						err.status = 301;
						options.headers['location'] = rawPath + '/';
						done1(err);
					} else {
						done1();
					}
				}
		],
		function(err) {
			if(err) {
				err.status = err.status || 500;
			}
			var defaultHeaders = {
				'content-type':  mime.lookup(options.extension),
				'last-modified': options['last-modified'],
			};
			_.extend(defaultHeaders, options.headers)

			_.each(defaultHeaders, function(headerVal, headerName) {
				console.log(headerName, headerVal);

				response.setHeader(headerName, headerVal);
			});

			/* go to the next process stage */
			done(err);
		});
};

function generateResponseBody(options, request, response, callback){
	switch(request.method) {
		case "PUT":
		case "POST":
		case "GET":

				if(!options.isNotDir) {
					response.end();
					return;
				}
				var readStream = fs.createReadStream(options.absPath);
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
				response.end();
			break;
		default:
			break;
	}
};
