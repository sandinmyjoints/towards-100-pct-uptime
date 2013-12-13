var http = require("http");
var domain = require("domain");


// create a top-level domain for the server
var serverDomain = domain.create();

serverDomain.on('error', function(er) {
    console.error('Error handled by serverDomain', er);
    try {
        res.writeHead(500);
        res.end('Error occurred, sorry.');
    } catch (er) {
        console.error('Error sending 500', er);
    }
});

serverDomain.run(function() {
    // server is created in the scope of serverDomain
    http.createServer(function(req, res) {
        // req and res are also created in the scope of serverDomain
        // however, we'd prefer to have a separate domain for each request.
        // create it first thing, and add req and res to it.
        var reqd = domain.create();
        reqd.add(req);
        reqd.add(res);
        reqd.on('error', function(er) {
            console.error('Error handled by reqd', er, req.url);
            try {
                res.writeHead(500);
                res.end('Error occurred, sorry.');
            } catch (er) {
                console.error('Error sending 500', er, req.url);
            }
        });
        throw new Error("uh-oh")
        
    }).listen(1337);
});
