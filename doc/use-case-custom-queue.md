# Use case: custom queue

The library accepts an optional `queue` option: an object with `push`, `shift` methods and a `length` property. You can replace the default array with a custom implementation (e.g. to log when requests are added to and removed from the queue). There is no validation for the option; the caller must implement the contract correctly.

**Example:** Log each time a request is added to the queue and when it is removed:

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

See [source code](https://github.com/aishek/axios-rate-limit/blob/master/src/index.js#L233-L258) for all available options.
