# Use case: single rate limit

When the API enforces only one rate limit (e.g. "N requests per second"), configure the library with a single window using the `limits` parameter and one entry in the array.

The old top-level parameters (`maxRequests`, `perMilliseconds`, `maxRPS`) are deprecated; prefer `limits` for both single and multiple windows.

**Options:** `limits: [{ maxRequests: number, duration: string }]` — `duration` uses units `ms`, `s`, `m`, `h` (e.g. `'1s'`, `'2s'`).

**Example:** 5 requests per 2 seconds:

```javascript
import axios from 'axios';
import rateLimit from 'axios-rate-limit';

const http = rateLimit(axios.create(), {
  limits: [{ maxRequests: 5, duration: '2s' }]
});

http.get('https://api.example.com/users');
http.get('https://api.example.com/users/1');
```

See [source code](https://github.com/aishek/axios-rate-limit/blob/master/src/index.js#L233-L258) for all available options.
