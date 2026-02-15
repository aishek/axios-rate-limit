# Mocking axios-rate-limit in Jest

This guide addresses [GitHub issue #51](https://github.com/aishek/axios-rate-limit/issues/51): testing application code that uses axios-rate-limit without hitting the network or depending on rate-limit timing.

The library attaches to an axios instance and returns that same instance with extra methods: `getMaxRPS`, `getQueue`, `setMaxRPS`, `setRateLimitOptions`. Your mock must return an object that has the same shape your code uses (axios methods like `get`/`post` and any of the rate-limit methods).

## Approach A: Full module mock

Mock the entire `axios-rate-limit` module so it returns a function that, when called, returns a fake axios instance. All HTTP calls in that test will use the fake; you cannot use real axios or a real mock server in the same file.

```javascript
jest.mock('axios-rate-limit', function () {
  return function () {
    return {
      get: function () { return Promise.resolve({ status: 200, data: { key: 'value' } }) },
      post: function () { return Promise.resolve({ status: 200, data: {} }) },
      getMaxRPS: function () { return 2 },
      getQueue: function () { return [] },
      setMaxRPS: function () {},
      setRateLimitOptions: function () {}
    }
  }
})
```

Your test must await the promise and assert on the resolved value. Example:

```javascript
function fetchData() {
  const http = rateLimit(axios.create(), { maxRequests: 2, perMilliseconds: 1000, maxRPS: 2 })
  return http.get('https://example.com/api/v1/users.json?page=1')
    .then(function (response) {
      if (response.status === 200) return response.data
    })
}

test('backend call returns mock data', async function () {
  const data = await fetchData()
  expect(data).toEqual({ key: 'value' })
})
```

If your code calls `getMaxRPS()` or other rate-limit methods, the mock above includes stubs so they do not throw.

## Approach B: Real rate-limit, custom axios adapter

Use the real axios-rate-limit with an axios instance that has a custom adapter and does no real HTTP. Rate limiting still runs; you control the responses and avoid network delay.

```javascript
var axios = require('axios')
var rateLimit = require('axios-rate-limit')

function adapter(config) {
  return Promise.resolve({ status: 200, data: { key: 'value' }, config: config })
}

var http = rateLimit(axios.create({ adapter: adapter }), { maxRequests: 2, perMilliseconds: 1000 })
```

The library’s own tests use this pattern (see `__tests__/basic.js`, `__tests__/options-behavior.js`).

## Verifying the mock

This repository includes `__tests__/jest-mocking-example.js`, which uses the same pattern (mocking the rate-limit module and asserting on the mock response). In-repo it mocks `../src/index` because the package is the current project; in your app you would mock `axios-rate-limit`. Run `npm test` to confirm.
