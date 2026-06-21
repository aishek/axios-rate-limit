# Use case: disable header auto-adaptation

You can explicitly disable automatic adaptation from response headers and keep limiter changes fully manual.

```javascript
import axios from 'axios';
import rateLimit from 'axios-rate-limit';

const client = rateLimit(axios.create(), {
  autoRateLimitByHeaders: false
});

client.setRateLimitOptions({ maxRequests: 5, perMilliseconds: 1000 });
```

Use this when you prefer stable, manually controlled limits even if the server returns `X-RateLimit*` headers.
