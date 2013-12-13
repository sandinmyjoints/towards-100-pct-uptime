var http = require('http'),
    path = require('path'),
    domain = require("domain");

var PORT = process.env.PORT || 1025;


http.createServer(function (request, response) {
    var d = domain.create();

    d.on("error", function(err){
        // Can write to response.
        response.writeHead(500, {'Content-Type': 'text/plain'});
        response.end(path.basename(__filename) + ': Error (domain): ' + err + '\n');
    });

    d.run(function(){
        // Your controller logic is safe here.
        throw new Error("uh-oh");
        response.writeHead(200, {'Content-Type': 'text/plain'});
        response.end(path.basename(__filename) + ': Hello World\n');
    });
}).listen(PORT);

console.log('Server running at http://127.0.0.1:' + PORT + '/');
