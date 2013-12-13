var http = require('http'),
    path = require('path'),
    domain = require("domain");

var PORT = process.env.PORT || 1025;

var d = domain.create();

d.on("error", function(err){
    // Can't write to response because don't have reference.
    response.writeHead(500, {'Content-Type': 'text/plain'});
    response.end(path.basename(__filename) + ': Error (domain): ' + ex.message + '\n');
});

d.run(function() {
    http.createServer(function (request, response) {
        throw new Error("uh-oh");
        response.writeHead(200, {'Content-Type': 'text/plain'});
        response.end(path.basename(__filename) + ': Hello World\n');

    }).listen(PORT);
});

console.log('Server running at http://127.0.0.1:' + PORT + '/');
