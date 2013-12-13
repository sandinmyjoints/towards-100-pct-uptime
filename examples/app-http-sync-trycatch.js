var http = require('http'),
    path = require('path');

var PORT = process.env.PORT || 1025;

http.createServer(function (request, response) {
    try {
        throw new Error("uh-oh");
        response.writeHead(200, {'Content-Type': 'text/plain'});
        response.end(path.basename(__filename) + ': Hello World\n');
    } catch (ex) {
        response.writeHead(500, {'Content-Type': 'text/plain'});
        response.end(path.basename(__filename) + ': Error (caught): ' + ex.message + '\n');
    }
}).listen(PORT);

console.log('Server running at http://127.0.0.1:' + PORT + '/');
