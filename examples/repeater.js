/* Demonstrates how user agents will repeat a POST if an error occurs
 to the first worker they connect to.
*/

var http = require('http'),
    path = require('path'),
    cluster = require('cluster');

var PORT = process.env.PORT || 1025;

if(cluster.isMaster) {
    // Fork two workers.
    cluster.fork();
    cluster.fork();
}
else {
    var log = function(msg) {
      console.log("[worker " + cluster.worker.id + " / " + process.pid + "]: " + msg);
    };

    http.createServer(function (request, response) {
        log(request.method + " " + request.url);

        // Serve script that will POST to /.
        if(request.method == "GET" && request.url == "/") {
            response.writeHead(200, {'Content-Type': 'text/html'});
            var script =
                      'req = new XMLHttpRequest();'
                    + 'req.open("POST", "/", true);'
                    + 'req.onreadystatechange = function() {'
                    + '  console.log(req.readyState, req.status);'
                    + '  if(req.readyState == 4 && req.status == 200) {'
                    + '    alert(req.responseText);'
                    + '  }};'
                    + 'req.send(JSON.stringify({key: "value"}));';

            var page = '\n\n\n<html> <script>' + script + '</script> <body> </body> </html>';
            response.end(page);
        }
        // Ignore favicon.
        else if (request.url == "/favicon.ico") {
            response.writeHead(200, {'Content-Type': 'text/plain'});
            response.end();
        // Throw.
        } else {
            response.writeHead(200, {'Content-Type': 'text/plain'});
            throw new Error("uncaught in request handler!");
            response.end(path.basename(__filename) + ': Hello World\n');
        }
    }).listen(PORT);

    /*
     To show that master will buffer incoming connections if no
     workers are accepting new connections, uncomment this and GET /
     once, twice, and then a third time. The first two will kill
     workers and the third will simply hang.
     */
    process.on("uncaughtException", function() {
        log("Caught uncaughtException. Disconnecting from shared ipc.");
        cluster.worker.disconnect();

    });

    log('Server running at http://127.0.0.1:' + PORT + '/');

}
