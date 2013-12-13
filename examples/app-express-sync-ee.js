var path = require('path'),
    express = require ('express'),
    EventEmitter = require("events").EventEmitter,
    util = require("util");

var app = express();

var PORT = process.env.PORT || 1025;

DyingObject = function(){
    EventEmitter.call(this);
};

util.inherits(DyingObject, EventEmitter);

DyingObject.prototype.die = function(){
    this.emit("error", new Error("uh-oh"));
};

app.get('*', function(req, res){
    var death = new DyingObject();
    death.die();
    var body = path.basename(__filename) + ': Hello World';
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Length', body.length);
    res.end(body);
}).listen(PORT);

console.log('Server running at http://127.0.0.1:' + PORT + '/');
