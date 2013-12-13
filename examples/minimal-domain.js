domain = require('domain');

var d = domain.create();
d.on('error', function (err) {
  console.log("domain caught", err);
});

var f = d.bind(function() {
  throw new Error("uh-oh");
});
setTimeout(f, 1000);
