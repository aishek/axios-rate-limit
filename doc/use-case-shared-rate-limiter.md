# Use case: shared rate limiter

When you have multiple axios instances that should share the same API quota (for example, different base URLs or clients talking to the same backend), use a single shared rate limiter instance.

The limiter tracks windows and queued requests once, and you enable it on as many axios instances as needed.

**Options:** same as for the main API (`maxRequests`, `perMilliseconds`, `maxRPS`, `duration`, `limits`, `queue`), passed when creating the limiter.

**Example:** two axios instances sharing a 2 requests per 100ms limit:

```javascript
import axios from 'axios';
import rateLimit, { getLimiter } from 'axios-rate-limit';

const limiter = getLimiter({ maxRequests: 2, perMilliseconds: 100 });

const http1 = limiter.enable(axios.create({ baseURL: 'https://api.example.com/users' }));
const http2 = rateLimit(
  axios.create({ baseURL: 'https://api.example.com/admin' }),
  { rateLimiter: limiter }
);

http1.get('/1');
http1.get('/2');
http2.get('/3');
http2.get('/4');
```

All four requests go through the same rate limiter; at most two will start within the first 100ms window.

