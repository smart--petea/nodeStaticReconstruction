var fs = require('fs'),
	path = require('path'),
	mimeName = path.join(__dirname, 'mime.txt');

var mime = JSON.parse(fs.readFileSync(mimeName, {encoding: 'utf8'}));

process.on('exit', function() {
	fs.writeFileSync(mimeName, JSON.stringify(mime));	
});

/* public functions */
exports.define = function(mimeTypes) {
	mimeTypes = mimeTypes || {};

	if(!(mimeTypes instanceof Object)) {
		throw new Error("incorrect data");
	}

	var extensions, ext, i; 
	for(var contentType in mimeTypes) {
		extensions = mimeTypes[contentType];	
		if(!(extensions instanceof Array)) extensions = [extensions]; 
		for(i in extensions) {
			ext = extensions[i];	
			ext[0] === "." || (ext = "." + ext);
			mime[ext] = contentType;
		}
	}
}

exports.lookup = function(ext) {
	ext = ext || "";
	ext[0] === '.' || (ext = "." + ext); 
	return mime[ext] || 'text/html';
}
