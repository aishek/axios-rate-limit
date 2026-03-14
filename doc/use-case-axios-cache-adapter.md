# Use case: integration with axios-cache-adapter

When using axios-rate-limit with [axios-cache-adapter](https://github.com/RasCarlito/axios-cache-adapter), cached responses would otherwise consume rate-limit slots because the limiter counts when a request is released from the queue, before the adapter runs. A cache hit does not perform a network request but still used one slot.

Use the optional `shouldCountRequest(config, response)` predicate so that cached responses do not count toward the limit. It is called in the response interceptor with the request config and the response. Return `false` to refund one slot (e.g. for cached responses); omit the option or return `true` to count as usual.

**Example:** Rate-limited client with axios-cache-adapter; cache hits do not consume the limit:

```javascript
import axios from 'axios';
import rateLimit from 'axios-rate-limit';
import { setupCache } from 'axios-cache-adapter';

const cache = setupCache({ maxAge: 15 * 60 * 1000 });
const api = axios.create({ adapter: cache.adapter });

const http = rateLimit(api, {
  limits: [{ maxRequests: 10, duration: '1s' }],
  shouldCountRequest: (config, response) => !response.request.fromCache
});

http.get('https://api.example.com/users');
```

axios-cache-adapter sets `response.request.fromCache === true` when the response was served from cache. See [axios-cache-adapter](https://github.com/RasCarlito/axios-cache-adapter) for cache configuration.

See [source code](https://github.com/aishek/axios-rate-limit/blob/master/src/index.js#L233-L258) for all available options. This behavior was added for [issue #43](https://github.com/aishek/axios-rate-limit/issues/43).
