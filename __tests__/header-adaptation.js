var helpers = require('./helpers')
var axios = helpers.requireAxios(process.env.AXIOS_VERSION)
var axiosRateLimit = require('../src/index')

it('auto applies x-ratelimit headers on success', async function () {
  function adapter (config) {
    if (config.url === '/seed') {
      return Promise.resolve({
        status: 200,
        data: 'seed',
        config: config,
        headers: {
          'x-ratelimit-limit': '1',
          'x-ratelimit-reset': '0.3'
        }
      })
    }
    return Promise.resolve({
      status: 200,
      data: config.url,
      config: config,
      headers: {}
    })
  }
  var http = axiosRateLimit(axios.create({ adapter: adapter }))
  await http.get('/seed')
  var start = Date.now()
  await Promise.all([http.get('/a'), http.get('/b')])
  var elapsed = Date.now() - start
  expect(elapsed).toBeGreaterThanOrEqual(250)
})

it('auto applies x-rate-limit headers', async function () {
  function adapter (config) {
    if (config.url === '/seed') {
      return Promise.resolve({
        status: 200,
        data: 'seed',
        config: config,
        headers: {
          'x-rate-limit-limit': '1',
          'x-rate-limit-reset': '0.25'
        }
      })
    }
    return Promise.resolve({
      status: 200,
      data: config.url,
      config: config,
      headers: {}
    })
  }
  var http = axiosRateLimit(axios.create({ adapter: adapter }))
  await http.get('/seed')
  var start = Date.now()
  await Promise.all([http.get('/a'), http.get('/b')])
  var elapsed = Date.now() - start
  expect(elapsed).toBeGreaterThanOrEqual(200)
})

it('auto applies headers from error response', async function () {
  function adapter (config) {
    if (config.url === '/limit') {
      var error = new Error('too many requests')
      error.config = config
      error.response = {
        status: 429,
        config: config,
        headers: {
          'x-ratelimit-limit': '1',
          'x-ratelimit-reset': '0.2'
        }
      }
      return Promise.reject(error)
    }
    return Promise.resolve({
      status: 200,
      data: config.url,
      config: config,
      headers: {}
    })
  }
  var http = axiosRateLimit(axios.create({ adapter: adapter }))
  await http.get('/limit').catch(function () {})
  var start = Date.now()
  await Promise.all([http.get('/a'), http.get('/b')])
  var elapsed = Date.now() - start
  expect(elapsed).toBeGreaterThanOrEqual(150)
})

it('ignores invalid reset header values', async function () {
  function adapter (config) {
    if (config.url === '/seed') {
      return Promise.resolve({
        status: 200,
        data: 'seed',
        config: config,
        headers: {
          'x-ratelimit-limit': '1',
          'x-ratelimit-reset': 'nope'
        }
      })
    }
    return Promise.resolve({
      status: 200,
      data: config.url,
      config: config,
      headers: {}
    })
  }
  var http = axiosRateLimit(axios.create({ adapter: adapter }))
  await http.get('/seed')
  var start = Date.now()
  await Promise.all([http.get('/a'), http.get('/b')])
  var elapsed = Date.now() - start
  expect(elapsed).toBeLessThan(120)
})

it('explicit limits disable built-in auto adaptation', async function () {
  function adapter (config) {
    return Promise.resolve({
      status: 200,
      data: config.url,
      config: config,
      headers: {
        'x-ratelimit-limit': '1',
        'x-ratelimit-reset': '1'
      }
    })
  }
  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 2, perMilliseconds: 120 }
  )
  var start = Date.now()
  await Promise.all([http.get('/a'), http.get('/b'), http.get('/c')])
  var elapsed = Date.now() - start
  expect(elapsed).toBeGreaterThanOrEqual(100)
  expect(elapsed).toBeLessThan(260)
})

it('supports explicit disable of header auto adaptation', async function () {
  function adapter (config) {
    if (config.url === '/seed') {
      return Promise.resolve({
        status: 200,
        data: 'seed',
        config: config,
        headers: {
          'x-ratelimit-limit': '1',
          'x-ratelimit-reset': '0.4'
        }
      })
    }
    return Promise.resolve({
      status: 200,
      data: config.url,
      config: config,
      headers: {}
    })
  }
  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { autoRateLimitByHeaders: false }
  )
  await http.get('/seed')
  var start = Date.now()
  await Promise.all([http.get('/a'), http.get('/b')])
  var elapsed = Date.now() - start
  expect(elapsed).toBeLessThan(120)
})

it('does not reapply identical auto options repeatedly', async function () {
  var callCount = 0
  function adapter (config) {
    callCount += 1
    return Promise.resolve({
      status: 200,
      data: config.url,
      config: config,
      headers: {
        'x-ratelimit-limit': '1',
        'x-ratelimit-reset': '0.3'
      }
    })
  }
  var limiter = axiosRateLimit.getLimiter()
  var originalSetRateLimitOptions = limiter.setRateLimitOptions.bind(limiter)
  var appliedAutoCount = 0
  limiter.setRateLimitOptions = function (options, meta) {
    if (meta && meta.fromAuto === true) {
      appliedAutoCount += 1
    }
    return originalSetRateLimitOptions(options, meta)
  }
  var http = limiter.enable(axios.create({ adapter: adapter }))
  await http.get('/a')
  await http.get('/b')
  expect(callCount).toEqual(2)
  expect(appliedAutoCount).toEqual(1)
})
