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

		async.series([
				function(done) {
					processRequestHeaders(options, done, request, response);
				},
				function(done) {
					processRequestBody(options, done, request, response);	
				},
				function(done) {
					generateResponseHedears(options, done, request, response);
				},
			],
			function(err) {
				generateResponseBody(options, request, response, callback);
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
	/*if(_.contains(['GET', 'POST', 'PUT'], request.method)) {
		etag.get(pathName, request);
	} else {
		done();
	}
	*/
	done();
};

function processRequestBody(options, done, request, response){
	done();
};	

function generateResponseHedears(options, done, request, response){
		response.setHeader('content-type', mime.lookup(options.extension));
		response.setHeader('last-modified', options['last-modified']);

		done(); //don't forget
};

function generateResponseBody(options, request, response, callback){
	switch(request.method) {
		case "POST":
			break;

		case "GET":
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
