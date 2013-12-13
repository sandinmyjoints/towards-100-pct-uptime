try {
  var f = function() {
    throw new Error("uh-oh");
  };
  setTimeout(f, 100);
} catch (ex) {
  console.log("try / catch caught", ex);
}
