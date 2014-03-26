var static1 = require('./node-static'),
	http = require('http');

var server = new http.Server(),
	fileServer = new static1.Server();
server.listen(8080);
server.on("request", function(req, res){
		fileServer.serve(req, res);
});
