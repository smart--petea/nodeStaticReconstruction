var stat = require("../../lib/node-static"),
	fServer = new stat.Server(__dirname, {gzip: true}),
	server = require('http').createServer(function(req, res) {
		fServer.serve(req, res);
	}).listen(8080);
	console.log(__dirname)
