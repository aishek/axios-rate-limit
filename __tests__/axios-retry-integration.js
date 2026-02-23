var axiosRetry = require('axios-retry').default

var helpers = require('./helpers')
var axios = helpers.requireAxios(process.env.AXIOS_VERSION)
var axiosRateLimit = require('../src/index')

it(
  'retried request eventually succeeds when used with axios-retry',
  async function () {
    var attempt = 0
    function adapter (config) {
      attempt++
      if (attempt === 1) {
        var err = new Error('server error')
        err.config = config
        err.response = { status: 500, data: '', headers: {} }
        return Promise.reject(err)
      }
      return Promise.resolve({ data: 'ok', status: 200, config: config })
    }

    var http = axiosRateLimit(
      axios.create({ adapter: adapter }),
      { maxRequests: 2, perMilliseconds: 1000 }
    )
    axiosRetry(http, { retries: 2 })

    var result = await http.get('/test')
    expect(result.data).toEqual('ok')
    expect(attempt).toBe(2)
  })

it(
  'rate limit still applies to retries when used with axios-retry',
  async function () {
    var callOrder = []
    var attemptByUrl = { '/first': 0, '/second': 0 }
    function adapter (config) {
      var url = config.url
      attemptByUrl[url]++
      var attempt = attemptByUrl[url]
      callOrder.push({ url: url, attempt: attempt })
      if (attempt === 1 && url === '/first') {
        var err1 = new Error('fail')
        err1.config = config
        err1.response = { status: 502, data: '', headers: {} }
        return Promise.reject(err1)
      }
      if (attempt === 1 && url === '/second') {
        var err2 = new Error('fail')
        err2.config = config
        err2.response = { status: 502, data: '', headers: {} }
        return Promise.reject(err2)
      }
      return Promise.resolve({ data: url, status: 200, config: config })
    }

    var http = axiosRateLimit(
      axios.create({ adapter: adapter }),
      { maxRequests: 1, perMilliseconds: 200 }
    )
    axiosRetry(http, { retries: 2 })

    var start = Date.now()
    var results = await Promise.all([
      http.get('/first'),
      http.get('/second')
    ])
    var elapsed = Date.now() - start

    expect(results[0].data).toEqual('/first')
    expect(results[1].data).toEqual('/second')
    expect(callOrder.length).toBe(4)
    expect(callOrder[0].url).toEqual('/first')
    expect(callOrder[1].url).toEqual('/second')
    expect(callOrder[2].url).toEqual('/first')
    expect(callOrder[3].url).toEqual('/second')
    expect(elapsed).toBeGreaterThanOrEqual(400)
  })
