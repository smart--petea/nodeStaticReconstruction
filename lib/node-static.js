var fs = require('fs'),
	url = require('url'),
	path = require('path');

exports.version = [
	'node-static',
	'0',
];

exports.Server = Server;

var errors = {
	isNotDirectory: "address is not directory",
}

/* function implementation */
function Server(address, options) {
	
	/* diserved directory */
	var directory = __dirname;

	var stat;
	if(address) {
		try {
				stat = fs.lstatSync(address);			
				console.log(stat);
		} catch (err) {
			if(err.code == 'ENOENT')
				throw new Error(errors.isNotDirectory);

			throw err;
		}

		if(stat.isDirectory()) {
			directory = address;
		} else {
			throw new Error(errors.isNotDirectory);		
		}
	} 

	/* public functions */
	this.serve = function(request, response, callback) {
		/* I do not know what to do with decodeURIComponent */
		var requestUrl;
		try{
			requestUrl = decodeURIComponent(request.url);
		} catch(e) {
			if(e instanceof URIError) {
				e.status = 400;
				errorCallback(e, request, response, callback);
			} else {
				throw e;
			}
		}

		var pathName = path.join(directory, url.parse(request.url).pathname);
		var readStream = fs.createReadStream(pathName);
		readStream.pipe(response);
		readStream.on('error', function(err) {
			if(err.code === 'ENOENT') {
				err.status = 404;	
			} else {
				err.status = 500;
			}

			errorCallback(err, request, response, callback);
		});
	}

	function errorCallback(err, request, response, callback) {
			err.headers = err.headers || {};
			err.status = err.status || 404;

			if(callback) {
				callback(err);
			} else {
				response.statusCode = err.status;
				response.end();
			}
	}
}
