# axios-rate-limit

[![npm version](https://img.shields.io/npm/axios-rate-limit.svg?style=flat-square)](https://www.npmjs.com/package/axios-rate-limit)
[![coverage](https://img.shields.io/codecov/c/github/aishek/axios-rate-limit.svg?style=flat-square)](https://codecov.io/gh/aishek/axios-rate-limit)
[![npm downloads](https://img.shields.io/npm/dt/axios-rate-limit.svg?style=flat-square)](https://www.npmjs.com/package/axios-rate-limit)
[![Build Status](https://img.shields.io/travis/aishek/axios-rate-limit.svg?style=flat-square)](https://travis-ci.org/aishek/axios-rate-limit)

A rate limit for axios: set how many requests per interval should perform immediately, other will be delayed automatically.

## Installing

```bash
yarn add axios-rate-limit
```

## Usage

```javascript
import axios from 'axios';
import rateLimit from 'axios-rate-limit';

// sets max 2 requests per 1 second, other will be delayed
const http = rateLimit(axios.create(), { maxRequests: 2, perMilliseconds: 1000 });
http.get('https://example.com/api/v1/users.json') // will perform immediately
http.get('https://example.com/api/v1/users.json') // will perform immediately
http.get('https://example.com/api/v1/users.json') // will perform after 1 second from the first one
```

## A bit of advertising :-)

Since 2010 lead my own software development company [Cifronomika](http://cifronomika.com/). We doing Ruby on Rails and JavaScript development. Feel free to contact
