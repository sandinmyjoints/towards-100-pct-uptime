var http = require('http'),
    path = require('path'),
    EventEmitter = require("events").EventEmitter,
    util = require("util");

var PORT = process.env.PORT || 1025;

DyingObject = function(){
    EventEmitter.call(this);
};

util.inherits(DyingObject, EventEmitter);

DyingObject.prototype.die = function(){
    this.emit("error", new Error("uh-oh"));
};

http.createServer(function (request, response) {
    var death = new DyingObject();
    death.die();
    response.writeHead(200, {'Content-Type': 'text/plain'});
    response.end(path.basename(__filename) + ': Hello World\n');
}).listen(PORT);

console.log('Server running at http://127.0.0.1:' + PORT + '/');
