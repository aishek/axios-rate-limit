# Use case: multiple rate limits

When the API enforces several limits (e.g. "X requests per second" and "Y requests per minute"), use the `limits` array with one entry per limit. The library uses one window per entry. A request is sent only when every window allows one more; windows reset independently.

**Options:** `limits: [{ maxRequests, duration }, ...]` — `duration` is a string with unit `ms`, `s`, `m`, `h`.

**Example:** 10 requests per second and 100 requests per minute:

```javascript
import axios from 'axios';
import rateLimit from 'axios-rate-limit';

const http = rateLimit(axios.create(), {
  limits: [
    { maxRequests: 10, duration: '1s' },
    { maxRequests: 100, duration: '1m' }
  ]
});

http.get('https://api.example.com/users');
http.get('https://api.example.com/users/1');
```

See [source code](https://github.com/aishek/axios-rate-limit/blob/master/src/index.js#L233-L258) for all available options.
