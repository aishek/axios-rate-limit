var helpers = require('./helpers')
var axios = helpers.requireAxios(process.env.AXIOS_VERSION)
var axiosRateLimit = require('../src/index')

it(
  'cached response refunds slot when shouldCountRequest returns false',
  async function () {
    function adapter (config) {
      var isCacheHit = config.url === '/cached'
      return Promise.resolve({
        data: config.url,
        status: 200,
        config: config,
        request: { fromCache: isCacheHit }
      })
    }

    var http = axiosRateLimit(
      axios.create({ adapter: adapter }),
      {
        maxRequests: 1,
        perMilliseconds: 1000,
        shouldCountRequest: function (config, response) {
          return !response.request.fromCache
        }
      }
    )

    var start = Date.now()
    var results = await Promise.all([
      http.get('/cached'),
      http.get('/network')
    ])
    var elapsed = Date.now() - start

    expect(results[0].data).toEqual('/cached')
    expect(results[1].data).toEqual('/network')
    expect(elapsed).toBeLessThan(500)
  })

it(
  'without shouldCountRequest cached responses still consume rate limit',
  async function () {
    function adapter (config) {
      var isCacheHit = config.url === '/cached'
      return Promise.resolve({
        data: config.url,
        status: 200,
        config: config,
        request: { fromCache: isCacheHit }
      })
    }

    var http = axiosRateLimit(
      axios.create({ adapter: adapter }),
      { maxRequests: 2, perMilliseconds: 500 }
    )

    var start = Date.now()
    var results = await Promise.all([
      http.get('/network1'),
      http.get('/network2'),
      http.get('/cached'),
      http.get('/network3')
    ])
    var elapsed = Date.now() - start

    expect(results.map(function (r) { return r.data })).toEqual([
      '/network1', '/network2', '/cached', '/network3'
    ])
    expect(elapsed).toBeGreaterThanOrEqual(500)
  })
