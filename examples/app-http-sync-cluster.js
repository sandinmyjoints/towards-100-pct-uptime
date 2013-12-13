var http = require('http'),
    cluster = require('cluster'),
    path = require('path');

var PORT = process.env.PORT || 1025;

if(cluster.isMaster) {
    console.log("master: forking");
    cluster.fork();
    cluster.fork();
    cluster.on('exit', function(worker, code, signal) {
        console.log('worker ' + worker.process.pid + ' died');
    });
}
else {
    http.createServer(function (request, response) {
        console.log("worker x: request");
        response.writeHead(200, {'Content-Type': 'text/plain'});
        throw new Error("uh-oh");
        response.end(path.basename(__filename) + ': Hello World\n');
    }).listen(PORT);
    console.log('Server running at http://127.0.0.1:' + PORT + '/');
}
