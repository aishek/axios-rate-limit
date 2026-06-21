# Use case: auto-adapt from rate-limit headers

When an API returns rate-limit headers, you can adapt limiter options at runtime through the same callback path used for user customization.

Default behavior:

- Header auto-adaptation is enabled.
- It reads `X-RateLimit-*`, `X-Rate-Limit-*`, and `RateLimit-*` variants for `Limit` and `Reset`.
- It applies only when user limits are not explicitly configured.

If you need custom parsing rules, set `onResponseRateLimit`.

```javascript
import axios from 'axios';
import rateLimit from 'axios-rate-limit';

const client = rateLimit(axios.create(), {
  onResponseRateLimit: (config, response, error) => {
    const source = response || (error && error.response);
    if (!source || !source.headers) return;

    const options = rateLimit.getHeaderBasedRateLimitOptions(config, source);
    if (!options) return;

    return options;
  }
});

await client.get('/users');
```

Notes:

- `reset` supports both Unix timestamp and delta seconds.
- Invalid or incomplete headers are ignored.
- If explicit limits are set by user config or runtime API, built-in auto-adaptation is not used.
