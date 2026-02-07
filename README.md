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

See [source code](https://github.com/aishek/axios-rate-limit/blob/master/src/index.js#L233-L258) for all available options.

## Alternatives

Consider using Axios built-in [rate-limiting](https://www.npmjs.com/package/axios#user-content--rate-limiting) functionality.
