var http = require('http'),
    path = require('path'),
    domain = require('domain');

var PORT = process.env.PORT || 1025;


console.log('Server running at http://127.0.0.1:' + PORT + '/');
