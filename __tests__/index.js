function requireAxios (version) {
  switch (version) {
    case '1':
      return require('axios1/dist/browser/axios.cjs') // eslint-disable-line global-require
    case '0':
    default:
      return require('axios0') // eslint-disable-line global-require
  }
}

var axios = requireAxios(process.env.AXIOS_VERSION)
var sinon = require('sinon')

var axiosRateLimit = require('../src/index')

function delay (milliseconds) {
  return new Promise(function (resolve) {
    return setTimeout(resolve, milliseconds)
  })
}

it('not delay requests less than maxRequests', async function () {
  var maxRequests = 5
  var perMilliseconds = 1000
  var totalRequests = 4
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRPS: maxRequests }
  )

  var onSuccess = sinon.spy()

  var requests = []
  var start = Date.now()
  for (var i = 0; i < totalRequests; i++) {
    requests.push(http.get('/users').then(onSuccess))
  }

  await Promise.all(requests)
  var end = Date.now()
  expect(onSuccess.callCount).toEqual(totalRequests)
  expect(end - start).toBeLessThan(perMilliseconds)
})

it('throws an error', async function () {
  var maxRequests = 2
  var perMilliseconds = 1000
  function adapter () { return Promise.reject(new Error('fail')) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: maxRequests, perMilliseconds: perMilliseconds }
  )

  expect.assertions(1)
  try {
    await http.get('/users')
  } catch (error) {
    expect(error.message).toEqual('fail')
  }
})

it('support dynamic options', async function () {
  function adapter (config) { return Promise.resolve(config) }

  // check constructor options
  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 2, perMilliseconds: 100 }
  )
  expect(http.getMaxRPS()).toEqual(20)

  var onSuccess = sinon.spy()

  var requests = []
  var start = Date.now()
  for (var i = 0; i < 3; i++) {
    requests.push(http.get('/users').then(onSuccess))
  }
  await delay(90)
  expect(onSuccess.callCount).toEqual(2)
  expect(http.getQueue().length).toEqual(1)

  await Promise.all(requests)
  var end = Date.now()
  expect(onSuccess.callCount).toEqual(3)
  expect(http.getQueue().length).toEqual(0)
  expect(end - start).toBeGreaterThan(100)
  await delay(110)

  // check setRateLimitOptions
  http.setRateLimitOptions({ maxRequests: 3, perMilliseconds: 200 })
  expect(http.getMaxRPS()).toEqual(15)

  onSuccess = sinon.spy()
  requests = []
  start = Date.now()
  for (var x = 0; x < 4; x++) {
    requests.push(http.get('/users').then(onSuccess))
  }
  await delay(190)
  end = Date.now()
  expect(onSuccess.callCount).toEqual(3)

  await Promise.all(requests)
  end = Date.now()
  expect(onSuccess.callCount).toEqual(4)
  expect(end - start).toBeGreaterThan(200)
  await delay(210)

  // check setMaxRPS
  http.setMaxRPS(3)
  expect(http.getMaxRPS()).toEqual(3)

  onSuccess = sinon.spy()
  requests = []
  start = Date.now()
  for (var z = 0; z < 4; z++) {
    requests.push(http.get('/users').then(onSuccess))
  }
  await delay(990)
  end = Date.now()
  expect(onSuccess.callCount).toEqual(3)

  await Promise.all(requests)
  end = Date.now()
  expect(onSuccess.callCount).toEqual(4)
  expect(end - start).toBeGreaterThan(1000)
})

it('reject request if it was cancelled before executing', async function () {
  var maxRequests = 1
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRPS: maxRequests }
  )

  var onSuccess = sinon.spy()
  var onFailure = sinon.spy()

  var oneCancelTokenSource = axios.CancelToken.source()
  oneCancelTokenSource.cancel('cancelled for testing')
  await http.get('/users', { cancelToken: oneCancelTokenSource.token })
    .then(onSuccess)
    .catch(onFailure)

  expect(onSuccess.callCount).toBe(0)
  expect(onFailure.callCount).toBe(1)
  expect(onFailure.args.toString()).toContain('cancelled for testing')
})

it('not delay requests if requests are cancelled', async function () {
  var maxRequests = 1
  var perMilliseconds = 1000
  var totalRequests = 4
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRPS: maxRequests }
  )

  var onSuccess = sinon.spy()
  var onFailure = sinon.spy()

  var requests = []
  var cancelTokenSources = []
  var start = Date.now()
  for (var i = 0; i < totalRequests; i++) {
    var oneCancelTokenSource = axios.CancelToken.source()
    requests.push(
      http.get('/users', { cancelToken: oneCancelTokenSource.token })
        .then(onSuccess)
        .catch(onFailure)
    )
    cancelTokenSources.push(oneCancelTokenSource)
  }

  expect(cancelTokenSources.length).toBe(4)
  cancelTokenSources[1].cancel('cancelled for testing')
  cancelTokenSources[2].cancel('cancelled for testing')

  await Promise.all(requests)
  var end = Date.now()
  expect(onSuccess.callCount).toEqual(2)
  expect(onFailure.callCount).toEqual(2)
  expect(end - start).toBeLessThan(perMilliseconds * 2)
  expect(end - start).toBeGreaterThan(perMilliseconds)
})

it('parseDuration: valid duration string and number', function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 2, duration: '1s' }
  )
  expect(http.getMaxRPS()).toEqual(2)

  var http2 = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 10, duration: '500ms' }
  )
  expect(http2.getMaxRPS()).toEqual(20)
})

it('parseDuration: invalid duration throws with format hint', function () {
  function adapter (config) { return Promise.resolve(config) }

  expect(function () {
    axiosRateLimit(
      axios.create({ adapter: adapter }),
      { limits: [{ maxRequests: 1, duration: -1 }] }
    )
  }).toThrow(/Unrecognized duration/)
  expect(function () {
    axiosRateLimit(
      axios.create({ adapter: adapter }),
      { limits: [{ maxRequests: 1, duration: 'invalid' }] }
    )
  }).toThrow(/Expected format.*ms.*s.*m.*h/)
})

it('multiple limits: both windows enforced', async function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    {
      limits: [
        { maxRequests: 5, duration: '2s' },
        { maxRequests: 2, duration: '500ms' }
      ]
    }
  )

  var onSuccess = sinon.spy()
  var requests = []
  for (var i = 0; i < 4; i++) {
    requests.push(http.get('/users').then(onSuccess))
  }

  await delay(50)
  expect(onSuccess.callCount).toEqual(2)

  await delay(500)
  expect(onSuccess.callCount).toEqual(4)

  await Promise.all(requests)
  expect(onSuccess.callCount).toEqual(4)
})

it('legacy single limit with duration works', async function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 2, duration: '100ms' }
  )
  expect(http.getMaxRPS()).toEqual(20)

  var onSuccess = sinon.spy()
  var promises = []
  for (var i = 0; i < 3; i++) {
    promises.push(http.get('/users').then(onSuccess))
  }
  await delay(50)
  expect(onSuccess.callCount).toEqual(2)
  await delay(100)
  await Promise.all(promises)
  expect(onSuccess.callCount).toEqual(3)
})

it('parseDuration: number as duration (backward compat)', function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 2, duration: 1000 }
  )
  expect(http.getMaxRPS()).toEqual(2)
})

it('parseDuration: non-string throws', function () {
  function adapter (config) { return Promise.resolve(config) }

  expect(function () {
    axiosRateLimit(
      axios.create({ adapter: adapter }),
      { limits: [{ maxRequests: 1, duration: {} }] }
    )
  }).toThrow(/Unrecognized duration/)
})

it('parseDuration: empty string throws', function () {
  function adapter (config) { return Promise.resolve(config) }

  expect(function () {
    axiosRateLimit(
      axios.create({ adapter: adapter }),
      { limits: [{ maxRequests: 1, duration: '' }] }
    )
  }).toThrow(/Unrecognized duration/)
})

it('parseDuration: invalid number (NaN) throws', function () {
  function adapter (config) { return Promise.resolve(config) }

  expect(function () {
    axiosRateLimit(
      axios.create({ adapter: adapter }),
      { limits: [{ maxRequests: 1, duration: 'xs' }] }
    )
  }).toThrow(/Unrecognized duration/)
})

it('parseDuration: units m and h', function () {
  function adapter (config) { return Promise.resolve(config) }

  var httpM = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 60, duration: '1m' }
  )
  expect(httpM.getMaxRPS()).toEqual(1)

  var httpH = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 3600, duration: '1h' }
  )
  expect(httpH.getMaxRPS()).toEqual(1)
})

it('getMaxRPS returns 0 when no options passed', function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(axios.create({ adapter: adapter }))
  expect(http.getMaxRPS()).toEqual(0)
})

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

it('limits entry requires duration', async function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    {
      limits: [
        { maxRequests: 2, duration: '100ms' }
      ]
    }
  )
  expect(http.getMaxRPS()).toEqual(20)

  var onSuccess = sinon.spy()
  for (var i = 0; i < 3; i++) {
    http.get('/users').then(onSuccess)
  }
  await delay(50)
  expect(onSuccess.callCount).toEqual(2)
})

it('setRateLimitOptions clears previous window timeouts', async function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 1, perMilliseconds: 200 }
  )
  var p1 = http.get('/users')
  await delay(50)
  http.setRateLimitOptions({ maxRequests: 2, perMilliseconds: 100 })
  var onSuccess = sinon.spy()
  var p2 = http.get('/users').then(onSuccess)
  var p3 = http.get('/users').then(onSuccess)
  await delay(60)
  expect(onSuccess.callCount).toEqual(2)
  await Promise.all([p1, p2, p3])
})

it('blocked by full window with timeout triggers ref path', async function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 1, perMilliseconds: 500 }
  )
  var onSuccess = sinon.spy()
  var p1 = http.get('/users').then(onSuccess)
  var p2 = http.get('/users').then(onSuccess)
  await delay(10)
  expect(onSuccess.callCount).toEqual(1)
  expect(http.getQueue().length).toEqual(1)
  await delay(500)
  await Promise.all([p1, p2])
  expect(onSuccess.callCount).toEqual(2)
})

it('single req with max 1 triggers unref when queue empty', async function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 1, perMilliseconds: 1000 }
  )
  var onSuccess = sinon.spy()
  await http.get('/users').then(onSuccess)
  expect(onSuccess.callCount).toEqual(1)
})
