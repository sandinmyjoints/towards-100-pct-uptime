var path = require('path'),
    express = require ('express');

var app = express();

var PORT = process.env.PORT || 1025;

app.get('*', function(req, res){
    var f = function() {
        throw new Error("uh-oh");
        var body = path.basename(__filename) + ': Hello World';
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Length', body.length);
        res.end(body);
    };
    setTimeout(f, 1000);
}).listen(PORT);

console.log('Server running at http://127.0.0.1:' + PORT + '/');
