var helpers = require('./helpers')
var axios = helpers.requireAxios(process.env.AXIOS_VERSION)
var axiosRateLimit = require('../src/index')

it('setRateLimitOptions with null does not throw', function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 1, perMilliseconds: 1000 }
  )
  http.setRateLimitOptions(null)
  http.setRateLimitOptions(undefined)
  expect(http.getQueue()).toEqual([])
})

it('setRateLimitOptions with empty object throws', function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 1, perMilliseconds: 1000 }
  )
  expect(function () {
    http.setRateLimitOptions({})
  }).toThrow(/Invalid rate limit options/)
})

it('constructor with empty options throws', function () {
  function adapter (config) { return Promise.resolve(config) }

  expect(function () {
    axiosRateLimit(axios.create({ adapter: adapter }), {})
  }).toThrow(/Invalid rate limit options/)
})

it('setRateLimitOptions with only maxRequests throws', function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 1, perMilliseconds: 1000 }
  )
  expect(function () {
    http.setRateLimitOptions({ maxRequests: 5 })
  }).toThrow(/one of maxRPS, duration, or perMilliseconds is required/)
})

it('setRateLimitOptions with only perMilliseconds throws', function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 1, perMilliseconds: 1000 }
  )
  expect(function () {
    http.setRateLimitOptions({ perMilliseconds: 1000 })
  }).toThrow(/maxRequests is required and must be a positive number/)
})

it('setRateLimitOptions with maxRequests 0 throws', function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 1, perMilliseconds: 1000 }
  )
  expect(function () {
    http.setRateLimitOptions({ maxRequests: 0, perMilliseconds: 1000 })
  }).toThrow(/maxRequests is required and must be a positive number/)
})

it('setRateLimitOptions with maxRequests negative throws', function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 1, perMilliseconds: 1000 }
  )
  expect(function () {
    http.setRateLimitOptions({ maxRequests: -1, perMilliseconds: 1000 })
  }).toThrow(/maxRequests is required and must be a positive number/)
})

it('limits with missing maxRequests throws', function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 1, perMilliseconds: 1000 }
  )
  expect(function () {
    http.setRateLimitOptions({
      limits: [{ duration: '1s' }]
    })
  }).toThrow(/limits\[0\].*maxRequests is required/)
})

it('limits with maxRequests 0 throws', function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 1, perMilliseconds: 1000 }
  )
  expect(function () {
    http.setRateLimitOptions({
      limits: [{ maxRequests: 0, duration: '1s' }]
    })
  }).toThrow(/limits\[0\].*maxRequests is required/)
})

it('limits with maxRequests negative throws', function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 1, perMilliseconds: 1000 }
  )
  expect(function () {
    http.setRateLimitOptions({
      limits: [{ maxRequests: -1, duration: '1s' }]
    })
  }).toThrow(/limits\[0\].*maxRequests is required/)
})

it('limits with duration 0 throws', function () {
  function adapter (config) { return Promise.resolve(config) }

  expect(function () {
    axiosRateLimit(
      axios.create({ adapter: adapter }),
      { limits: [{ maxRequests: 5, duration: 0 }] }
    )
  }).toThrow(/duration must be a positive finite number/)
})

it('limits with duration Infinity throws', function () {
  function adapter (config) { return Promise.resolve(config) }

  expect(function () {
    axiosRateLimit(
      axios.create({ adapter: adapter }),
      { limits: [{ maxRequests: 5, duration: Infinity }] }
    )
  }).toThrow(/duration must be a positive finite number/)
})
