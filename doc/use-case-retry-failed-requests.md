# Use case: retrying failed requests

You can combine axios-rate-limit with [axios-retry](https://github.com/softonic/axios-retry) to rate-limit requests and automatically retry failed ones (e.g. network errors or 5xx responses). Apply both to the same axios instance; retries go through the rate limiter and respect the same limits.

**Example:** Rate-limited client with up to 2 retries per request:

```javascript
import axios from 'axios';
import rateLimit from 'axios-rate-limit';
import axiosRetry from 'axios-retry';

const http = rateLimit(axios.create(), {
  limits: [{ maxRequests: 5, duration: '2s' }]
});
axiosRetry(http, { retries: 2 });

http.get('https://api.example.com/users');
```

See [source code](https://github.com/aishek/axios-rate-limit/blob/master/src/index.js#L233-L258) for all available options. For axios-retry options (e.g. `retryCondition`, `retryDelay`), see [axios-retry documentation](https://github.com/softonic/axios-retry).
