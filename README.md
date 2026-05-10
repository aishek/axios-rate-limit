# axios-rate-limit

[![npm version](https://img.shields.io/npm/v/axios-rate-limit.svg?style=flat-square)](https://www.npmjs.com/package/axios-rate-limit)
[![npm downloads](https://img.shields.io/npm/dt/axios-rate-limit.svg?style=flat-square)](https://www.npmjs.com/package/axios-rate-limit)
[![build status](https://img.shields.io/github/actions/workflow/status/aishek/axios-rate-limit/node.js.yml
)](https://github.com/aishek/axios-rate-limit/actions?query=branch%3Amaster++)
[![code coverage](https://img.shields.io/coveralls/aishek/axios-rate-limit.svg?style=flat-square)](https://coveralls.io/r/aishek/axios-rate-limit)
[![install size](https://img.shields.io/badge/dynamic/json?url=https://packagephobia.com/v2/api.json?p=axios-rate-limit&query=$.install.pretty&label=install%20size&style=flat-square)](https://packagephobia.now.sh/result?p=axios-rate-limit)

Zero dependencies, fixed-window, queued rate limiter for [Axios](https://www.npmjs.com/package/axios): set how many requests per interval should perform immediately, other will be delayed automatically.

## Installing

```bash
npm install axios-rate-limit
```

## Usage

```javascript
import axios from 'axios';
import rateLimit from 'axios-rate-limit';

const http = rateLimit(axios.create(), {
  limits: [
    { maxRequests: 5, duration: '2s' },
    { maxRequests: 2, duration: '500ms' }
  ]
})
http.get('https://example.com/api/v1/users.json?page=1')
http.getQueue()
```

## Options

### Recommended: `limits` (multi-window)

`limits` is the recommended format. It accepts an array of independent fixed windows, and a request is executed only when all windows allow it.

```javascript
const http = rateLimit(axios.create(), {
  limits: [
    { maxRequests: 100, duration: '1m' },
    { maxRequests: 10, duration: '1s' }
  ]
})
```

Each `limits[]` entry:

- `maxRequests` (number, required, > 0): max requests per window.
- `duration` (string or number, required, > 0): window size. If a number is provided, it is interpreted as milliseconds (`duration: 1500` means 1.5 seconds). Strings support `ms`, `s`, `m`, `h` (examples: `'500ms'`, `'2s'`, `'1m'`).

### Advanced options

- `queue` (optional): custom queue implementation. Must support `push(item)` and `shift()`, and either `length` or `getLength()`. Sync and async queues are supported.
- `shouldCountRequest` (optional): predicate `(config, response) => boolean`. If it returns `false`, the limiter refunds one occupied slot (useful for cached responses).
- `rateLimiter` (optional): lets you pass an existing limiter instance, so multiple axios clients can share one quota.

### Runtime API

Returned axios instance methods:

- `getQueue()`: returns current queue instance.
- `getMaxRPS()`: returns first window RPS view (`maxRequests / (durationInMs / 1000)`), or `0` when limiter is not configured.
- `setRateLimitOptions(options)`: updates limiter options at runtime.
- `setMaxRPS(rps)`: shorthand runtime update equivalent to `setRateLimitOptions({ maxRequests: rps, perMilliseconds: 1000 })`.

Also available from module:

- `rateLimit.getLimiter(options)`: creates a limiter instance that can be shared across axios clients.

### Legacy single-window options

Single-window constructor shape (`maxRequests` with one of `perMilliseconds`, `duration`, or `maxRPS`) is still supported for compatibility. For new code, prefer `limits[]` format.

## Typical use cases

- [Single rate limit](doc/use-case-single-rate-limit.md) — API enforces one limit; use one window via `limits`.
- [Multiple rate limits](doc/use-case-multiple-rate-limits.md) — API enforces several limits (e.g. per second and per minute); use multiple windows.
- [Custom queue](doc/use-case-custom-queue.md) — Pass your own queue (e.g. to log when requests are added or removed).
- [Retrying failed requests](doc/use-case-retry-failed-requests.md) — Use with axios-retry to rate-limit and retry failed requests (see [issue #24](https://github.com/aishek/axios-rate-limit/issues/24)).
- [Integration with axios-cache-adapter](doc/use-case-axios-cache-adapter.md) — Don't count cached responses toward the limit (see [issue #43](https://github.com/aishek/axios-rate-limit/issues/43)).
- [Mocking in Jest](doc/jest-mocking.md) — How to mock axios-rate-limit in Jest so tests do not hit the network (see [issue #51](https://github.com/aishek/axios-rate-limit/issues/51)).
- [Shared limiter](doc/use-case-shared-rate-limiter.md) — Reuse one limiter instance across multiple axios clients that share the same API quota.

## Alternatives

Consider using Axios built-in [rate-limiting](https://www.npmjs.com/package/axios#user-content--rate-limiting) functionality.
