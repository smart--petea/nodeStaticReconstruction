var _ = require('underscore'),
	crypto = require('crypto'),
	fs = require('fs');

exports.get = getETag;

/* the cache format is 
	filename: {
		last-date-access: ......,
		etag: ..........,
	}
*/

function Cache() {
	var cache = {};
	this.get = function(filename) {
		if(filename in cache) {
			cache[filename]['last-date-access'] = new Date;
			return cache[filename]['etag'];
		}

		return null;
	}

	this.set = function(filename, etag) {
		cache[filename] = cache[filename] || {};
		cache[filename]['last-date-access'] = new Date;
		cache[filename]['etag'] = etag;
	}
}

cache = new Cache();

//you must add refresh time

/* functions 

	etag = last-modification-date + md5-checksum
	There is a problem:
		1. for compute etag we must compute md5-checksum
		2. for compute md5-checksum we must read all "filename" file content
		3. after setting all headers we can send and file content, the result is that the same file we must read
			3.1 twice for GET method - the client waiting time is doubled + time of file sending process by wire
			3.2 only one read for HEAD method - waiting time is minimum

	To avoid partially the problem I must introduce a cache in this module which will clean the old and unused content every CLEAN_PERIOD
*/

function getETag(filename, options, callback) {
	/* accept two calling variants 
		1. getETag(filename, oldETag, callback)
		2. getETag(filename, callback)
	*/
	if(_.isFunction(options)) {
		callback = options;
		options = _.extend( {
			oldETag: null,
			compute: false, 
		}, options || {});
	}

	var oldETag = options.oldETag;

	var cacheETag = cache.get(filename);

	if(cacheETag != null && oldETag === cacheETag) {
		callback(null, oldETag); //null is for error
		return;
	}
	/*
		This is the case when
		0. filename is not in cache 
		1. oldETag is null and there does not exist an eTag for this filename
		2. oldETag is different  
	*/
	var hash = crypto.createHash('md5'),
		stream = fs.createReadStream(filename);

	stream.on('data', function(data) {
		hash.update(data, 'utf8');
	});

	stream.on('end', function() {
		var etag = hash.digest('hex');
		cache.set(filename, etag);	
		callback(null, etag);
	});

	stream.on('error', function(err) {
		callback(err);
	});
}
