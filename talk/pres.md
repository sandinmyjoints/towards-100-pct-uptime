## Towards

# 100% Uptime

## with Node.js ##

Note: A guy is standing on the corner of the street chain smoking cigarettes, one after another.
A woman walking by notices him and says, "Hey, don't you know that those things can kill you? I mean,
didn't you see the giant **warning** on the box?!"
"That's OK," the guy says, while he puffs away. "I'm a computer programmer."
"So? What's **that** got to do with anything?"
"We don't care about **warnings**. We only care about **errors**."
From http://stackoverflow.com/a/235307/599258
We indeed care greatly about errors. Though probably best not ignore warnings
entirely. :)



<img src='img/sd-logo.png' alt="SpanishDict" style="width: 500px; height: 85px">

9M uniques / month.
<br>
<br>
![Fluencia](img/fluencia-logo.jpg)

75K+ users, some are paid subscribers.

Note: About me: I'm a Software Engineer, one of three, at Curiosity Media.
We have two main properties:
SpanishDict and Fluencia.
SpanishDict is a traditional web site, with page reloads.
Fluencia is a single page web app with AJAX calls to a REST API. We want both to
run all the time, every day.
Both run Node.js on the backend.



## ( **We** | **you** | **users** )
## **hate downtime.**

![Downtime](/img/platform-downtime.png)

Note: Downtime is bad for all sorts of reasons.
Users go away.
If you know that deploying code can cause a bad experience for users who
are online, or cause system errors or corrupted data, you won't deploy as
much.



### Important, but
## out of scope
### for this talk:

* Redundant infrastructure.
* Backups.
* Disaster recovery.

Note: Lots of things can cause downtime.
- Database.
- Network.
- Imperfect engineers (e.g., me).


## In scope:

* Application errors.
* Deploys.
* Node.js stuff:
  * Domains.
  * Cluster.
  * Express.

Note: Without further ado, here are the...



## Keys to 100% uptime.
<br>
![no downtime](/img/no-platform-downtime.jpg)


## 1. Sensibly handle uncaught exceptions.
![no downtime](/img/no-platform-downtime.jpg)


## 2. Use domains to handle known errors.
![no downtime](/img/no-platform-downtime.jpg)


## 3. Manage processes
## with cluster.
![no downtime](/img/no-platform-downtime.jpg)


## 4. Gracefully terminate connections.
![no downtime](/img/no-platform-downtime.jpg)



## 1. Sensibly handle uncaught exceptions.


### Uncaught exceptions happen when:
- An exception is thrown but not caught.
- An error event is emitted but nothing is listening for it.


From node/lib/events.js:

```js
EventEmitter.prototype.emit = function(type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (this.domain) {
    ...
    } else if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      throw TypeError('Uncaught, unspecified "error" event.');
    }
```

Note: If you're not listening for it, what will an uncaught thrown error do?


## An uncaught exception
## crashes the process.

This process might be a server.

It might be handling many requests
<br>
from many clients the moment it crashes.

Note: The question is, how to recover and continue as well as possible? It starts with...



## Domains.
#### 2. Use domains to handle known errors.


## `try / catch` doesn't do async.

```js
try {
  var f = function() {
    throw new Error("uh-oh");
  };
  setTimeout(f, 100);
} catch (ex) {
  console.log("try / catch can't catch", ex);
}
```


## Domains are a bit like
## `try/catch` for async.

```js
domain = require('domain');

var d = domain.create();
d.on('error', function (err) {
  console.log("domain caught", err);
});
var f = d.bind(function() {
  throw new Error("uh-oh");
});
setTimeout(f, 1000);
```

Note: Try / catch won't help. Wrap async operations in a domain, and the domain will catch thrown exceptions and error
events.


## EventEmitters bind to domains.

From node/lib/events.js:

```js
EventEmitter.prototype.emit = function(type) {
  if (type === 'error') {
    if (this.domain) {  // This is important!
      ...
      this.domain.emit('error', er);
    } else if ...
```

Note: We don't just use timers -- most IO in Node happens through EEs. If a
domain is active when an EE is created, it will associate itself with that
domain. What does that mean? If the EE has an associated domain, the error will
be emitted on the domain instead of thrown. This right here can prevent a whole
bunch of uncaught exceptions, thus saving your server processes.


### Log the error.
### Helpful additional fields:

* `error.domain`
* `error.domainEmitter`
* `error.domainBound`
* `error.domainThrown`

Note: Probably want to log the error. Here are some extra fields on an error caught by a domain.
Maybe useful for tracing errors and debugging.


### Then it's up to you.

* Ignore.
* Retry.
* Abort (e.g., return 500).
* Throw (becomes an unknown error).

Note: it's up to depending on context: what kind of error, what is emitting,
what state are things in.


### Do I have to create a new domain every
### time I do an async operation?

Note: Like every time I handle a request / response cycle?
You could.
That would work.



## Use middleware.

More convenient.


### In Express, this might look like:

```js
var domainWrapper = function(req, res, next) {
  var reqDomain = domain.create();
  reqDomain.add(req);
  reqDomain.add(res);

  reqDomain.run(next);

  reqDomain.once('error', function(err) {
    reqDomain.dispose();
    next(err);
  });
};
```

<small>
Based on
<br />
https://github.com/brianc/node-domain-middleware
<br />
https://github.com/mathrawka/express-domain-errors
</small>

Note: Let's step through this.
req and res are both EEs. They were created before this domain existed, but
EEs can be explicitly added to a domain.
Then we run the rest of the req / res stack through the context of the domain,
and when new EEs are created, they add themselves to the active domain.
When any EE emits an error, it propagates to the domain associated with that EE.
The active domain is in `process.domain`
This middleware triggers error handling middlewarwe. Alternatively, you could just send a response
like 500.
Now we're in an error state, so more errors could be thrown. Do you want your error handler
triggered on all of them?



## Domain methods.
- `run`: run a function in context of domain.
- `bind`: bind one function.
- `intercept`: like bind but handles 1st arg `err`.
- `domain.dispose`: cancels IO and timers.

Note: If no error, no need to dispose.
- If no IO or timers, probably no need to dispose.
The intention of calling dispose is generally to prevent cascading errors when a critical part of
the Domain context is found to be in an error state.
- Tries to clean IO associated with the domain
- Streams are aborted, ended, closed, and/or destroyed.
- Timers are cleared.
- Explicitly bound callbacks are no longer called.
- Any error events that are raised as a result of this are ignored.
- IO might still be performed.
- to the highest degree possible, once a domain is disposed, further errors from the emitters in
that set will be ignored. So, even if some remaining actions are still in flight, Node.js will not
communicate further about them.



# Domains
## are great
## until they're not.

Note: For example,



### node-mongodb-native does not play well
### with `process.domain`.

```js
app.use(function(req, res, next) {
  console.log(process.domain); // a domain
  UserModel.findOne(function(err, doc) {
    console.log(process.domain); // undefined
    next();
  });
});
```

<small>
See https://github.com/LearnBoost/mongoose/pull/1337
</small>

Note:
This is the lib that Mongoose is built around.


### Use explicit binding.

```js
app.use(function(req, res, next) {
  console.log(process.domain); // a domain
  AppModel.findOne(process.domain.bind(function(err, doc) {
    console.log(process.domain); // still a domain
    next();
  }));
});
```



### What other operations don't play well
### well with `process.domain`?

Good question!

Package authors could note this.

Also, as we find them, let's note them.

Note: I've opened a ticket with node-mongodb-native to find out more about this particular case.



### Can 100% uptime be achieved
### just using domains?

## No.

### Not if only one instance of your app is running.

Note: When that instance is down, or restarting, it's unavailable. And if it goes down hard, any
in-flight requests when are toast. Some operations can still trigger uncaught exceptions. Or just
because an error is caught by a domain doesn't mean you can always keep going. You might not be in a
state that you can recover from. It might be safer to let this process die -- but what then? What
about the time between when this process dies and its successor comes up?

This brings us to #3...



## 3. Manage processes
## with cluster.



## Cluster module.

Node = one thread per process.

Most machines have multiple CPUs.

One process per CPU = cluster.


## master / workers

* 1 master process forks `n` workers.
* Master and workers communicate state via IPC.
* When workers want to listen to a socket/server, master registers them for it.
* Each new connection to socket is handed off to a worker.
* No shared application state between workers.



### What about when a worker isn't working anymore?

#### (Perhaps due to an uncaught exception.)

### Some coordination is needed.


* Worker tells cluster master it's done accepting new connections.

* Cluster master forks replacement.

* Worker stays around to clean up.

* Master cannot wait for worker to die before replacing!



Another use case for cluster:
## Deployment.

* Want replace all existing servers.

* Something must manage that = cluster master process.

Note: a bit like a deliberately induced error across all your workers.



## Zero downtime deployment.

* When master starts, point a symlink to worker code.

* On deploy new code, update symlink.

* Send signal to master: fork new workers!

* Master tells old workers to shut down, forks new workers from new code.

* Master process never stops running!


## Signals.
A way to communicate with running processes.

- `SIGHUP`: cycle workers (some like `SIGUSR2`).

- `$ kill -s HUP`

- `$ service node-app reload`



## Process management options.


## Forever
https://github.com/nodejitsu/forever

- Has been around...forever.
- No cluster awareness &mdash; used on a single process.
- Simply restarts the process when it dies.
- More comparable to Upstart or Monit.
- Lots of GH issues.


## Naught
https://github.com/superjoe30/naught

- Newer.
- Cluster aware.
- Zero downtime errors and deploys.
- Runs as daemon.
- Handles log compression, rotation.


## Recluster
https://github.com/doxout/recluster

- Newer.
- Cluster aware.
- Zero downtime errors and deploys.
- Does not run as daemon.
- Log agnostic.
- Simple, relatively easy to reason about.


## We went with recluster.
### Happy so far.


Some of what these modules do may be reinventing the wheel.

I'm still learning the extent of what is going on in Node's `child_process` and `cluster` modules.



#### We have been talking about
#### starting / stopping workers
#### as if it's atomic.

### It's not.



## 4. Gracefully terminate connections
#### when needed.



### Don't call `process.exit` right away!

### Give it a grace period to do clean up.

Note: Don't call `process.exit` right away! Slightly controversial? If it is in
such a bad state (e.g., db disconnected), bad things might happen to in-flight
requests, too. I don't know of any better way to recover from that. Similar to
domain.dispose. Interested in ideas. More likely, if it's an application error,
the other requests will be fine.


### When a server closes,
### need to clean up:
* In-flight requests.
* HTTP keep-alive (open TCP) connections.



### How to clean up
Revisiting our middleware from earlier:

```js
var domainWrapper = function(before, after) {
  return function(req, res, next) {
    var reqDomain = domain.create();
    reqDomain.add(req);
    reqDomain.add(res);
    reqDomain.run(next);
    reqDomain.once('error', function(err) {
      if(before) before(err);  // Hook.
      next(err);
      if(after) after(err);  // Hook.
    });
  };
};
```

Note: Add before and after hooks for cleanup.



## Call `server.close`.
Graceful by default: calls back once server has closed all existing connections.

```js
var afterHook = function(req, res, next) {
  server.close(); // <-- close server
  next();
}
```


## Shut down keep-alive connections.

```js
var shutdownMiddle = function(req, res, next) {
  if(app.get("isShuttingDown") {
    req.connection.setTimeout(1);
  }
  next();
}

var afterHook = function(req, res, next) {
  app.set("isShuttingDown", true); // <-- set state
  server.close();
  next()
}
```

<small>
Idea from https://github.com/mathrawka/express-graceful-exit
</small>

Note: HTTP defaults to keep-alive which keeps the underyling TCP connection
open. We want to close those TCP connections for our dying worker. Set keepalive
timeouts to 1 so as soon there is activity, they close right away. TODO Learn
more about this.



### Then you can call `process.exit`.

```js
var afterHook = function(req, res, next) {
  app.set("isShuttingDown", true);
  server.close(function() {
    process.exit(1);  // <-- call process.exit
  });
}
```


### Set a timer.
If timeout period expires and server is still around, call `process.exit`.

Note: This then becomes a hard shutdown for any clients still connected, but
time is up and the worker just has to go.



### Here it is:
## Our ideal server.

![unicorn](/img/rainbow_unicorn.gif)



## On boot:

- OS process manager (e.g., Upstart) starts service.
- Service brings up cluster master.
- Cluster master forks workers from symlink.
- Each worker's server starts accepting connections.


## On deploy:

- Point symlink to new version.
- Send signal to cluster master.
- Cluster master tells workers to stop accepting new connections.
- Cluster master forks new workers from new version of code.
- Workers shutdown gracefully.

Note: master never stops. There are always workers accepting new connections.
Workers close out existing connections before dying.


## On known error:

- Server catches it via domain.
- Next action depends on you: retry? abort? etc.

Note: There is no catch-all action here: it really depends on your app and on
what error you've got. Also, you can use contextual domains that catch errors
from specific operations so you have a better sense of what kinds of errors will
be caught.


## On uncaught exception:

- ??

```js
process.on('uncaughtException', function(err) {
  // ??
})
```



Back to where we started:
## 1. Sensibly handle uncaught exceptions

We have minimized these by using domains.

But they can still happen.



Node docs say not to keep running.

> An unhandled exception means your application &mdash; and by extension node.js
> itself &mdash; is in an undefined state. Blindly resuming means anything could
> happen.
> You have been warned.
> <footer>
> <cite>
> <small>
> http://nodejs.org/api/process.html#process_event_uncaughtexception
> </small>
> </cite>
> </footer>

Note: By definition, you don't know what's going on, so there's no sure way to
recover. This comes from Node not separating your application from the server.
With power comes responsibility.


### What to do?
First, log the error so you know what happened.


### Then, you've got to
### kill the process.


### It's not so bad. We can now do so
### with minimal trouble.


## On unknown error
## (uncaught exception)

Graceful shutdown.
- Log the error.
- Server stops accepting new connections.
- Worker tells cluster master "no more new connections"
- Cluster master forks a replacement worker.
- Worker exits when all connections are closed, or after
a reasonable timeout.



### What about the response that killed the worker?

### How does the dying worker gracefully respond to it?

### Good question!



> People are also under the illusion that it is possible to trace back [an uncaught] exception to
> the http request that caused it...
>
> <footer><cite>
> <small>-felixge, https://github.com/joyent/node/issues/2582</small>
> </cite></footer>

Note: Felix Geisendorfer, who originally added process.on uncaughtException, and
has also asked for it to be removed!



### This is too bad, because you want to
### always return a response, even on error.


Note: Keeping a client hanging can come back to bite you. 1) the user agent
appears to hang and 2) it might resend the bad request once the connection
closes and trigger another exception! This in the HTTP spec. I've seen this
happen. It's not pretty. Can crash multiple workers. This presentation was
originally titled "I Have Much to Learn About Node.js" becaus of my experience
with this particular behavior. It's still titled "Towards 100% Uptime" because I
can't guarantee it. But then, who can?



### Fortunately, given what we've discussed,
### uncaughts shouldn't happen often.

### And when they do, only one
### connection will be left hanging.



### Must bump cluster master when:

* Upgrade Node.
* Cluster master code changes.
* OS service (e.g., Upstart) definition changes.



### During timeout periods, might have:

* More workers than CPUs.
* Workers running different versions (old/new).

<br>
Should be brief. Probably preferable to downtime.



#### Tip:
### Be able to produce errors on demand
### on your dev and staging servers.
(Disable this in production.)

Note: This is really helpful for debugging and testing. Make sure to both a sync
and an async version.


#### Tip:
### Keep master simple.

It needs to run for a long time without being updated.



## Things change.

I've been talking about:

```json
{
  "node": "~0.10.20",
  "express": "~3.4.0",
  "connect": "~2.9.0",
  "mongoose": "~3.6.18",
  "recluster": "=0.3.4"
}
```


## The Future: Node 0.11 / 0.12
For example, cluster module has some changes.



## Cluster is 'experimental'.
## Domains are 'unstable'.
Zero downtime means working with unstable or experimental parts of Node!

<img src='img/volcano.jpg' style="width: 600px;">

Note: Volcano not because you're going to get burned by Node, but the big island
of Hawaii is mostly stable--thousands live there--but it is also still being
created -- parts are unstable. Like Node. Best approached with caution, respect.


## Good reading:

* [Node.js Best Practice Exception Handling](http://stackoverflow.com/questions/7310521/node-js-best-practice-exception-handling)
  (some answers more helpful than others)
* [Remove uncaught exception handler?](https://github.com/joyent/node/issues/2582)
* [Isaacs stands by killing on uncaught](http://blog.izs.me/post/65712662830/restart-node-js-servers-on-domain-errors-sensible-fud)
* [Domains don't incur performance hits compared to try catch](http://www.lighthouselogic.com/use-domain-dispose/#/using-a-new-domain-for-each-async-function-in-node/)
* [Rejected PR to add domains to Mongoose, with discussion](https://github.com/LearnBoost/mongoose/pull/1337)
* [Don't call enter / exit across async](http://stackoverflow.com/a/15244463/599258)
* [Comparison of naught and forever](https://s3.amazonaws.com/superjoe/temp/naught.html)
* [What's changing in cluster](http://strongloop.com/strongblog/whats-new-in-node-js-v0-12-cluster-round-robin-load-balancing/?utm_source=javascriptweekly&utm_medium=email)



If you thought this was interesting,

## We're hiring.

[curiositymedia.theresumator.com](http://curiositymedia.theresumator.com/)

![Fluencia](img/fluencia-logo.jpg)

<img src='img/sd-logo.png' alt="SpanishDict" style="width: 500px; height: 85px">



## Thanks!

* @williamjohnbert
* github.com/sandinmyjoints/towards-100-pct-uptime
