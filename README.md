# axios-rate-limit

[![npm version](https://img.shields.io/npm/v/axios-rate-limit.svg?style=flat-square)](https://www.npmjs.com/package/axios-rate-limit)
[![npm downloads](https://img.shields.io/npm/dt/axios-rate-limit.svg?style=flat-square)](https://www.npmjs.com/package/axios-rate-limit)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/axios-rate-limit?style=flat-square)](https://bundlephobia.com/package/axios-rate-limit@latest)
[![build status](https://img.shields.io/github/actions/workflow/status/aishek/axios-rate-limit/node.js.yml
)](https://github.com/aishek/axios-rate-limit/actions?query=branch%3Amaster++)
[![code coverage](https://img.shields.io/coveralls/aishek/axios-rate-limit.svg?style=flat-square)](https://coveralls.io/r/aishek/axios-rate-limit)
[![install size](https://img.shields.io/badge/dynamic/json?url=https://packagephobia.com/v2/api.json?p=axios-rate-limit&query=$.install.pretty&label=install%20size&style=flat-square)](https://packagephobia.now.sh/result?p=axios-rate-limit)
[![known vulnerabilities](https://snyk.io/test/npm/axios-rate-limit/badge.svg)](https://snyk.io/test/npm/axios-rate-limit)

A rate limit for [Axios](https://www.npmjs.com/package/axios): set how many requests per interval should perform immediately, other will be delayed automatically.

## Installing

```bash
npm install axios-rate-limit
```

## Usage

```javascript
import axios from 'axios';
import rateLimit from 'axios-rate-limit';

// sets max 2 requests per 1 second, other will be delayed
// note maxRPS is a shorthand for perMilliseconds: 1000, and it takes precedence
// if specified both with maxRequests and perMilliseconds
const http = rateLimit(axios.create(), { maxRequests: 2, perMilliseconds: 1000, maxRPS: 2 })
http.getMaxRPS() // 2
http.get('https://example.com/api/v1/users.json?page=1') // will perform immediately
http.get('https://example.com/api/v1/users.json?page=2') // will perform immediately
http.get('https://example.com/api/v1/users.json?page=3') // will perform after 1 second from the first one

// options hot-reloading also available
http.setMaxRPS(3)
http.getMaxRPS() // 3
http.setRateLimitOptions({ maxRequests: 6, perMilliseconds: 150 }) // same options as constructor
```

## Alternatives

Consider using Axios built-in [rate-limiting](https://www.npmjs.com/package/axios#user-content--rate-limiting) functionality.
