# Use case: custom queue

The library accepts an optional `queue` option: an object implementing the queue interface. You can replace the default array with a custom implementation (e.g. to log when requests are added to and removed from the queue, or to use async storage such as Redis). There is no validation for the option; the caller must implement the contract correctly.

**Queue interface:** An object with:

- `push(item)` — add an item to the queue. May return `void` or `Promise<void>`.
- `shift()` — remove and return the next item. May return the item or `Promise<item>`.
- Length: either a `length` property (number) or a `getLength()` method returning `number` or `Promise<number>`.

Methods may be synchronous or asynchronous; the library normalizes return values with `Promise.resolve`, so both styles work. Use `getLength()` when length is determined asynchronously (e.g. reading from a remote store).

**Example (sync):** Log each time a request is added to the queue and when it is removed:

```javascript
import axios from 'axios';
import rateLimit from 'axios-rate-limit';

const backing = [];
const loggingQueue = {
  push (handler) {
    console.log('request added to queue');
    backing.push(handler);
  },
  shift () {
    const handler = backing.shift();
    if (handler) console.log('request removed from queue');
    return handler;
  },
  get length () {
    return backing.length;
  }
};

const http = rateLimit(axios.create(), {
  limits: [{ maxRequests: 1, duration: '500ms' }],
  queue: loggingQueue
});

http.get('https://api.example.com/users');
http.get('https://api.example.com/users/1');
```

**Example (async):** A queue that simulates async storage (e.g. you could use the same pattern with Redis `LPUSH`/`RPOP`/`LLEN`):

```javascript
import axios from 'axios';
import rateLimit from 'axios-rate-limit';

const backing = [];
const asyncQueue = {
  push (handler) {
    backing.push(handler);
    return Promise.resolve();
  },
  shift () {
    const item = backing.shift();
    return Promise.resolve(item);
  },
  getLength () {
    return Promise.resolve(backing.length);
  }
};

const http = rateLimit(axios.create(), {
  limits: [{ maxRequests: 1, duration: '500ms' }],
  queue: asyncQueue
});

http.get('https://api.example.com/users');
http.get('https://api.example.com/users/1');
```

See [source code](https://github.com/aishek/axios-rate-limit/blob/master/src/index.js#L273-L301) for all available options.
