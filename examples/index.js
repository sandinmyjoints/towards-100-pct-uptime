#!/usr/bin/env node

var fs = require('fs'),
    spawn = require('child_process').spawn,
    glob = require("glob");

var PORT_START = 1025,
    NODE = "/Users/william/.nvm/v0.10.18/bin/node";

var servers = [];
var n = -1;

var runEm = function(err, files){
    files.forEach(function(file){
        console.log("starting " + file);

        var port = PORT_START + ++n;

        servers[n] = spawn(NODE, [file], {env: {PORT: port}});
        var prefix = file + " (child " + n + ", port " + port + ") ";
        var logger = function(msg){
            console.log(prefix + " " + msg);
        };

        servers[n].stdout.on("data", logger);
        servers[n].stderr.on("data", function(data) {logger("error: " + data);});
        servers[n].stderr.on("close", function() {logger("closed");});
    });
};

// main
if(require.main == module)
    glob("app-*.js", runEm);
