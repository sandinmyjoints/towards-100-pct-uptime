var path = require('path'),
    express = require ('express'),
    mongoose = require("mongoose"),
    domain = require("domain");

var app = express();

var PORT = process.env.PORT || 1026;

// Middleware to wrap request / response in a domain.
//
// Based on:
// * https://github.com/brianc/node-domain-middleware.
// * https://github.com/mathrawka/express-domain-errors
//
// Adds domain to res.locals so it can be bound to async operations outside of
// req/res (e.g., db queries).
//
// @param before [Function] Hook to run before error handling.
// @param after  [Function] Hook to run after error handling.
//
var domainWrapper = function(before, after) {
  return function(req, res, next) {
    var reqDomain = domain.create();
    res.locals._domain  = reqDomain;
    reqDomain.add(req);
    reqDomain.add(res);
    reqDomain.run(next);
    reqDomain.once('error', function(err) {
      if(before) before(err);
      next(err);
      if(after) after(err);
    });
  };
};

app.use(domainWrapper());

app.get("/domain", function(req, res) {
  res.send(200, "Success");
});

var checkDomain = function(msg) {
  if(!msg) {
    msg = " ";
  } else {
    msg = " " + msg + " ";
  };
  console.log("process.domain" + msg + "exists:", process.domain !== undefined);
};

app.get("/domain/ex1", function(req, res) {
  console.log("GET /domain/ex1: Connect default error handler will catch this.");
  checkDomain();
  throw new Error("ex");
});

app.get("/domain/ex2", function(req, res) {
  console.log("GET /domain/ex2: domain will catch this.");
  checkDomain("outside async");
  var f = function() {
    checkDomain("inside async");
    throw new Error("ex");
  };
  setTimeout(f, 500);
});

app.get("/domain/ex3", function(req, res) {
  console.log("GET /domain/ex3: domain will catch this.");
  checkDomain("outside async");
  var f = function() {
    checkDomain("inside async");
    throw new Error("ex");
  };
  process.nextTick(f);
});

app.get("/domain/ex4", function(req, res) {
  console.log("GET /domain/ex4: This will send a response and then domain will catch this.");
  checkDomain("outside async");
  res.send(200);
  var f = function() {
    checkDomain("inside async");
    throw new Error("ex");
  };
  process.nextTick(f); // or setImmediate
});

app.get("/domain/ex5", function(req, res) {
  console.log("GET /domain/ex5: This will send a response and then will crash.");
  checkDomain("outside async");
  res.send(200);
  var f = function() {
    process.domain.dispose();
    checkDomain("inside async");
    throw new Error("ex");
  };
  process.nextTick(f); // or setImmediate
});


// Bonus: Mongoose.
mongoose.connect('mongodb://localhost:37017/test');
var AppModel = mongoose.model('AppModel', { field: String });

app.get("/domain/ex6", function(req, res) {
  console.log("GET /domain/ex6: This will crash the server.");
  checkDomain("outside findOne callback");
  AppModel.findOne(function(err, doc) {
    if (err) console.log("got error from mongoose", err);
    checkDomain("inside findOne callback");
    throw new Error("mongoose error");
  });
});

app.get("/domain/ex7", function(req, res) {
  console.log("GET /domain/ex7: This domain will catch this.");
  checkDomain("outside findOne callback");
  AppModel.findOne(process.domain.run(function(err, doc) {
    if (err) console.log("got error from mongoose", err);
    checkDomain("inside findOne callback");
    throw new Error("mongoose error");
  }));
});

app.listen(PORT);

console.log('Server running at http://127.0.0.1:' + PORT + '/');
