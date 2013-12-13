var path = require('path'),
    express = require ('express'),
    mongoose = require("mongoose");

var app = express();

var PORT = process.env.PORT || 1025;

app.get("/no-domain", function(req, res) {
  res.send(200, "Success");
});

app.get("/no-domain/ex1", function(req, res) {
  console.log("GET /no-domain/ex1: Connect default error handler will catch this.");
  throw new Error("ex");
});

app.get("/no-domain/ex2", function(req, res) {
  console.log("GET /no-domain/ex2: This will crash the server.");
  var f = function() { throw new Error("ex"); };
  setTimeout(f, 500);
});

app.get("/no-domain/ex3", function(req, res) {
  console.log("GET /no-domain/ex3: This will crash the server.");
  var f = function() { throw new Error("ex"); };
  process.nextTick(f);
});

app.get("/no-domain/ex4", function(req, res) {
  console.log("GET /no-domain/ex4: This will send a response and then crash the server.");
  res.send(200);
  var f = function() {
    throw new Error("ex");
  };
  process.nextTick(f); // or setImmediate
});

app.listen(PORT);

console.log('Server running at http://127.0.0.1:' + PORT + '/');
