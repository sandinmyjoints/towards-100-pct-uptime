var domain = require('domain');
var EventEmitter = require('events').EventEmitter;

var i = 0;
function cycle() {
    setImmediate(cycle);

    var emitter = new EventEmitter();
    emitter.i = ++i;
    emitter.on('test', function() {
        throw new Error('asdasd ' + emitter.i);
    });

    var dm = domain.create();
    dm.on('error', function(er) {
        console.error('Error', er);
        dm.dispose();
    });
    dm.add(emitter);

    emitter.emit('test');
}

cycle();
