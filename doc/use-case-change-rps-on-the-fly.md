# Use case: change RPS on the fly

You can change throughput at runtime with `setMaxRPS` (or `setRateLimitOptions`) without recreating the axios instance.

This is useful when you detect a condition from responses and want queued requests to settle faster (for example before mass cancellation), as discussed in [issue #48](https://github.com/aishek/axios-rate-limit/issues/48).

**Example:** start with conservative rate, then temporarily increase it and cancel queued requests.

```javascript
import axios from 'axios';
import rateLimit from 'axios-rate-limit';

const client = rateLimit(axios.create(), { maxRPS: 1 });
const sourceList = [];

for (let i = 0; i < 100; i++) {
  const source = axios.CancelToken.source();
  sourceList.push(source);
  client.get('https://api.example.com/users', { cancelToken: source.token })
    .catch(() => {});
}

client.setMaxRPS(100000);
sourceList.slice(1).forEach((source) => source.cancel('cancelled'));
```

`setMaxRPS(rps)` is equivalent to `setRateLimitOptions({ maxRequests: rps, perMilliseconds: 1000 })`.
