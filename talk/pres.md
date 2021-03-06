## Towards

# 100% Uptime

## with Node.js ##

Note: A guy is standing on the corner of the street chain smoking cigarettes, one after another.
A woman walking by notices him and says, "Hey, don't you know that those things can kill you? I mean,
didn't you see the giant **warning** on the box?!"
"That's OK," the guy says, while he puffs away. "I'm a computer programmer."
"So? What's **that** got to do with anything?"
"We don't care about **warnings**. We only care about **errors**."
(From http://stackoverflow.com/a/235307/599258)
We indeed care greatly about errors. Though probably best not to ignore warnings
entirely. :)



<img src='img/sd-logo.png' alt="SpanishDict" style="width: 500px; height: 85px">

## 9M uniques / month.
<br>
![Fluencia](img/fluencia-logo.jpg)

## 75K+ users, some are paid subscribers.

Note: About me: I'm a Software Engineer, one of three, at Curiosity Media.

We have two main properties: SpanishDict and Fluencia.

SpanishDict is a traditional web site, with page reloads.
Fluencia is a single page web app with AJAX calls to a REST API.

We want both to run all the time, every day. Both run Node.js on the backend.



## ( **We** | **you** | **users** )
## **hate downtime.**

![Downtime](img/platform-downtime.png)

Note: Downtime is bad for all sorts of reasons.

**Users go away**.

You **might get paged** in the middle of the night.

If you know that deploying code can cause a bad experience for users who are
online, or cause system errors or corrupted data, you **won't deploy as much**.



## Important, but
## out of scope:

* Redundant infrastructure.
* Backups.
* Disaster recovery.

Note: Lots of things can cause downtime. Database. Network. **Lots of factors
needed** to prevent it in entirely. Some of them are out of scope for this
presentation.


## In scope:

* Application errors.
* Deploys.
* Node.js stuff:
  * Domains.
  * Cluster.
  * Express.

Note: Imperfect engineers (e.g., me) cause application errors. Deploys are a
necessary evil. So we'll **focus on what we can do with Node** to keep these
from causing downtime. Without further ado, here are the...



## Keys to 100% uptime.
<br>
![no downtime](img/no-platform-downtime.jpg)


## 1. Sensibly handle
## uncaught exceptions.
![no downtime](img/no-platform-downtime.jpg)


## 2. Use domains
## to catch and contain errors.
![no downtime](img/no-platform-downtime.jpg)


## 3. Manage processes
## with cluster.
![no downtime](img/no-platform-downtime.jpg)


## 4. Gracefully terminate connections.
![no downtime](img/no-platform-downtime.jpg)

Note: We're going to visit each of these in detail.



## 1. Sensibly handle uncaught exceptions.


### Uncaught exceptions happen when:
- An exception is thrown but not caught.
- An error event is emitted but nothing is listening for it.


From node/lib/events.js:

```js
EventEmitter.prototype.emit = function(type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
      ...
    } else if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      ...
```

Note: If we're emitting an event of type error, then throw it! No try / catch
around this. If you're not listening for it, what will an uncaught thrown error
do?


## An uncaught exception
## crashes the process.

![dead process](img/dead-smiley.png)

Note: That's it, Node is dead, not running anymore.


## If the process is a server: ![no response](img/no-response.png)
<h2 style="position: relative; top: -70px"> x 100s??</h2>

Note: An **even scarier** type of downtime than the screen we saw before: for
any given client, a single response fails -- so for a server, this could be
happening for 100s or 1000s of clients if the uncaught exception was **handled
poorly** and the process crashed hard. **The question is**, how to recover from
this and continue as well as possible?


## It starts with...



## Domains.
#### 2. Use domains to catch and contain errors.


## `try/catch` doesn't do async.

```js
try {
  var f = function() {
    throw new Error("uh-oh");
  };
  setTimeout(f, 100);
} catch (ex) {
  console.log("try / catch won't catch", ex);
}
```


## Domains are a bit like
## `try/catch` for async.

```js
var d = require('domain').create();

d.on('error', function (err) {
  console.log("domain caught", err);
});

var f = d.bind(function() {
  throw new Error("uh-oh");
});

setTimeout(f, 100);
```

Note: Try / catch won't help. Wrap async operations in a domain, and the domain
will catch thrown exceptions and error events.


### The active domain is
### `domain.active`.

```js
var d = require('domain').create();
console.log(domain.active); // <-- null

var f = d.bind(function() {
  console.log(domain.active === d) // <-- true
  console.log(process.domain === domain.active) // <-- true
  throw new Error("uh-oh");
});
```

Note: Current domain is domain.active and also process.domain. This is important
because...


## New EventEmitters bind
## to the active domain.

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
domain. What does that mean? It's like magically adding error listeners to a
bunch of EEs. If an EE has an associated domain, the error will be emitted on
the domain instead of thrown. This can prevent a whole bunch of uncaught
exceptions, thus saving countless server processes.

What to do once you've caught an error?
You've caught an error with your domain (TODO: image of catching a fish)


### Log the error.
### Helpful additional fields:

* `error.domain`
* `error.domainEmitter`
* `error.domainBound`
* `error.domainThrown`

Note: Probably want to log the error. Errors caught by have extra fields that
provide context that may be useful for tracing errors and debugging.


### Then it's up to you.

* Ignore.
* Retry.
* Abort (e.g., return 500).
* Throw (becomes an unknown error).

Note: it's up to you depending on context: what kind of error, what is emitting
the error, what your application is doing... No general answer. Domains are a
tool, not an answer.


### Do I have to create a new domain
### every time I do an async operation?

Note: Like every time I handle a request / response cycle?
Not necessarily. Can group related operations. For example...



## Use middleware.

More convenient.


### In Express, this might look like:

```js
var domainWrapper = function(req, res, next) {
  var reqDomain = domain.create();
  reqDomain.add(req);
  reqDomain.add(res);

  reqDomain.once('error', function(err) {
    res.send(500); // or next(err);
  });

  reqDomain.run(next);
};
```

<small>
Based on
<br />
https://github.com/brianc/node-domain-middleware
<br />
https://github.com/mathrawka/express-domain-errors
</small>

Note: Let's step through this. req and res are both EEs. They were created
before this domain existed, so must can be explicitly added to a domain.

We add an error handler. On error, we'll just return 500. Alternatively, you
could trigger yourerror handling middleware.

Then we run the rest of the req / res stack through the context of the domain,
and when new EEs are created, they add themselves to the active domain. When any
EE emits an error, or an error is thrown, it propagates to this domain.



## Domain methods.
- `add`: bind an EE to the domain.
- `run`: run a function in context of domain.
- `bind`: bind one function.
- `intercept`: like bind but handles 1st arg `err`.
- `dispose`: cancels IO and timers.

Note: Dispose: If no error, no need to dispose. Now we're in an error state, so
more errors could be thrown. Do you want your error handler triggered on all of
them?
- If no IO or timers, probably no need to dispose.
The intention of calling dispose is generally to prevent cascading errors when a critical part of
the Domain context is found to be in an error state.
- Tries to clean up IO associated with the domain
- Streams are aborted, ended, closed, and/or destroyed.
- Timers are cleared.
- Any error events that are raised as a result of this are ignored.
- Node tries really hard to close everything down in this context.
- Use of dispose is context-dependent. Investigate its effects and decide if you
  need it.



# Domains
## are great
## until they're not.

Note: For example,



### node-mongodb-native does not
### play well with active domain.

```js
console.log(domain.active); // a domain
AppModel.findOne(function(err, doc) {
  console.log(domain.active); // undefined
  next();
});
```

<small>
See https://github.com/LearnBoost/mongoose/pull/1337
</small>

Note:
This is the lib that Mongoose is built around. Any errors thrown in this
callback will not go to the domain because there effectively isn't one. Yikes.

(skip) Why this is is outside the scope of this and I don't have a good handle on it
yet, but I'm trying to learn more.


### Fix with explicit binding.

```js
console.log(domain.active); // a domain
AppModel.findOne(domain.active.bind(function(err, doc) {
  console.log(domain.active); // still a domain
  next();
}));
```

Note: of course, if you have a lot of db operations, this could get tedious and
be error-prone because you might miss one...



### What other operations don't play well
### well with `domain.active`?

Good question!

Package authors could note this.

If you find one, let package author know.

Note: It is probably feasible for domains to work. I'm opening a ticket with
node-mongodb-native to find out more about this particular case.



### Can 100% uptime be achieved
### just by using domains?

## No.

### Not if only one instance of your app
### is running.

Note: When that instance is down, or restarting, perhaps due to re-thrown error
or uncaught exception or deploy/upgrade, it's unavailable. The time between when
this process dies and its successor comes up? That's downtime.

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
* When workers want to listen to a socket, master registers them for it.
* Each new connection to socket is handed off to a worker.
* No shared application state between workers.

Note: IPC is inter-process communication: messages between process.

TODO replace with image



### What about when a worker
### isn't working anymore?

### Some coordination is needed.


1. Worker tells cluster master it's done accepting new connections.

2. Cluster master forks replacement.

3. Worker dies.

Note: TODO image of someone not working



Another use case for cluster:
## Deployment.

* Want to replace all existing servers.

* Something must manage that = cluster master process.

Note: Deploy is a bit like a deliberately induced error across all your workers.
Except that you need to start new workers from a different codebase.



## Zero downtime deployment.

* When master starts, give it a symlink to worker code.

* After deploy new code, update symlink.

* Send signal to master: fork new workers!

* Master tells old workers to shut down, forks new workers from new code.

* Master process never stops running.

Note: Master process never stops, so the socket is continually open and never
refuses connections. symlink is a "symbolic link": a pointer to a directory.


## Signals.
A way to communicate with running processes.

`SIGHUP`: reload workers (some like `SIGUSR2`).

    $ kill -s HUP <pid>
    $ service <node-service-name> reload



## Process management options.

Note: You can write your own process management code with cluster, and it's
educational. Getting the behavior correct for all worker states is great fun. Or
if you want to simplify your life, there are packages out there that will do it
for you.


## Forever
[github.com/nodejitsu/forever](https://github.com/nodejitsu/forever)

- Has been around...forever.
- No cluster awareness &mdash; used on a single process.
- Simply restarts the process when it dies.
- More comparable to Upstart or Monit.


## Naught
[github.com/superjoe30/naught](https://github.com/superjoe30/naught)

- Newer.
- Cluster aware.
- Zero downtime errors and deploys.
- Runs as daemon.
- Handles log compression, rotation.


## Recluster
[github.com/doxout/recluster](https://github.com/doxout/recluster)

- Newer.
- Cluster aware.
- Zero downtime errors and deploys.
- Does not run as daemon.
- Log agnostic.
- Simple, relatively easy to reason about.



## We went with recluster.
### Happy so far.

Note: This ia very simplified example master.js. Cluster emits a variety of
events, such as listening and exited, and you would want to log those. Some opts
includes num workers, and timeout, which is how long to let old workers live
after they stop accepting new connections, in seconds. If this is zero, workers
are killed instantly without having a chance to cleanly close down existing
connections.



### I have been talking about
### starting / stopping workers
### as if it's atomic.

## It's not.



## 4. Gracefully terminate connections
#### when needed.



### Don't call `process.exit` too soon!

### Give it a grace period to clean up.

Note: `process.exit` is how you shut down a node process. When you want to shut
down a server, you don't want to call `process.exit` right away! This is what
leads to the scenario we saw before where 100s of in-flight requests all failed.



### Need to clean up:
* In-flight requests.
* HTTP keep-alive (open TCP) connections.


### Revisiting our middleware from earlier:

```js
var domainWrapper = function(afterErrorHook) {
  return function(req, res, next) {
    var reqDomain = domain.create();
    reqDomain.add(req);
    reqDomain.add(res);

    reqDomain.once('error', function(err) {
      next(err);
      if(afterErrorHook) afterErrorHook(err);  // Hook.
    });
    reqDomain.run(next);
  };
};
```

Note: Add after-error hook for cleanup. What do we put into the after-error
hook?



## 1. Call `server.close`.

```js
var afterErrorHook = function(err) {
  server.close(); // <-- ensure no new connections
}
```

Note: Node's server class has a method `close` that stops the server from
accepting new connections. Call it to ensure that this worker handles no more work.



## 2. Shut down keep-alive connections.

```js
var afterErrorHook = function(err) {
  app.set("isShuttingDown", true); // <-- set state
  server.close();
}

var shutdownMiddle = function(req, res, next) {
  if(app.get("isShuttingDown") {  // <-- check state
    req.connection.setTimeout(1);  // <-- kill keep-alive
  }
  next();
}
```

<small>
Idea from https://github.com/mathrawka/express-graceful-exit
</small>

Note: HTTP defaults to keep-alive which keeps the underyling TCP connection
open. We want to close those TCP connections for our dying worker. So we set
**global** app state that we are shutting down, and for every TCP connection, we
set the keepalive timeout to a minimal value -- so as soon there is any activity
on that particular connection, it basically closes right away. This will
decrease the number of existing connections over time.



### 3. Then call `process.exit`
### in `server.close` callback.

```js
var afterErrorHook = function(err) {
  app.set("isShuttingDown", true);
  server.close(function() {
    process.exit(1);  // <-- all clear to exit
  });
}
```

Note: `server.close` is actually pretty graceful by default. It will only call
back once all existing connections are closed. So we put the call to
`process.exit` inside of it.


### Set a timer.
If timeout period expires and server is still around, call `process.exit`.

Note: Now it's hard shutdown, but **time is up** and the worker just has to go.
Gracefully shutting down is all about **"best efforts"**. If the server is in a
bad state (e.g., db disconnected), **bad things might happen** to these
in-flight requests that we are trying to finish out cleanly, too. But **they
would have anyway** if you had just down a hard shutdown without trying to close
cleanly. So **might as well** try it. Most likely, if the shutdown is due to an
application error, the other requests will be fine.



### Summing up:
## Our ideal server.

![unicorn](img/rainbow_unicorn.gif)



## On startup:

- Cluster master comes up (for example, via Upstart).
- Cluster master forks workers from symlink.
- Each worker's server starts accepting connections.


## On deploy:

- Point symlink to new version.
- Send signal to cluster master.
- Master tells existing workers to stop accepting new connections.
- Master forks new workers from new code.
- Existing workers shut down gracefully.

Note: master never stops. There are always workers accepting new connections.
Workers close out existing connections before dying.


## On error:

- Server catches it via domain.
- Next action depends on you: retry? abort? rethrow? etc.

Note: Again, no catch-all action here: depends on your app and on what error
you've got. Use contextual domains to isolate specific operations or groups of
operations so you have a better sense of what kinds of errors are being handled
by a particular domain.


## On uncaught exception:

- ??

```js
// The infamous "uncaughtException" event!
process.on('uncaughtException', function(err) {
  // ??
})
```



Back to where we started:
## 1. Sensibly handle uncaught exceptions.

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

Note: This makes sense. By definition, you don't know what's going on, so
there's no sure way to recover.

This comes from Node **not separating your application from the server**. It
**doesn't run in a container** like mod_php or mod_wsgi with Apache.


### What to do?
First, log the error so you know what happened.


### Then, you've got to
### kill the process.

Note: (TODO: Old Yeller image??)


### It's not so bad. We can now do so
### with minimal trouble.


## On uncaught exception:

- Log error.
- Server stops accepting new connections.
- Worker tells cluster master it's done.
- Master forks a replacement worker.
- Worker exits gracefully when all connections are closed, or after timeout.

Note: Similar to what we have seen for deploy, except reversed: the worker tells
the master it is going down.



### What about the request
### that killed the worker?

### How does the dying worker
### gracefully respond to it?

### Good question!



> People are also under the illusion that it is possible to trace back [an uncaught] exception to
> the http request that caused it...
>
> <footer><cite>
> <small>-felixge, https://github.com/joyent/node/issues/2582</small>
> </cite></footer>

Note: Felix Geisendorfer, Node community member who **originally added the
uncaughtException handler**, and has also asked for it to be removed
(unsuccessfully)!



### This is too bad, because you
### always want to return a response,
### even on error.

Note: Keeping a client hanging can come back to bite you. 1) the user agent
appears to hang and 2) it might resend the bad request once the connection
closes and trigger another exception! This in the HTTP spec. I've seen this
happen. It's not pretty. Can crash multiple workers. This presentation was
originally titled "I Have Much to Learn About Node.js" because of my surprise at
seeing what happened due to this particular behavior and some less robust error
handling that we were doing.



This is **Towards 100% Uptime** b/c these approaches don't guarantee response for
every request.

### But we can get very close.



### Fortunately, given what we've seen,
### uncaughts shouldn't happen often.

### And when they do, only one
### connection will be left hanging.



### Must restart cluster master when:

* Upgrade Node.
* Cluster master code changes.



### During timeout periods, might have:

* More workers than CPUs.
* Workers running different versions (old/new).

<br>
Should be brief. Probably preferable to downtime.



#### Tip:
### Be able to produce errors on demand
### on your dev and staging servers.
(Disable this in production.)

Note: This is really helpful for debugging and testing. Maybe have multiple ones
for sync, async, db errors, etc.


#### Tip:
### Keep cluster master simple.

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


## The Future:
## Node 0.11 / 0.12
For example, cluster module has some changes.


## Cluster is *experimental*.
## Domains are *unstable*.

<img src='img/volcano.jpg' style="width: 600px;">

Note: These terms are defined in the node docs.

Volcano not because you're going to get burned by Node, but the big island
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

## [careers.fluencia.com](http://careers.fluencia.com/)



## Thanks!

* @williamjohnbert
* [github.com/sandinmyjoints/towards-100-pct-uptime](http://github.com/sandinmyjoints/towards-100-pct-uptime)
* [github.com/sandinmyjoints/towards-100-pct-uptime-examples](http://github.com/sandinmyjoints/towards-100-pct-uptime-examples)
