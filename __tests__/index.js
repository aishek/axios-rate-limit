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

it('can share a limiter between multiple axios instances', async function () {
  function adapter (config) { return Promise.resolve(config) }

  var limiter = axiosRateLimit.getLimiter({
    maxRequests: 2, perMilliseconds: 100
  })

  var http1 = limiter.enable(axios.create({ adapter: adapter }))
  // another way of doing the same thing:
  var http2 = axiosRateLimit(
    axios.create({ adapter: adapter }), { rateLimiter: limiter }
  )

  var onSuccess = sinon.spy()

  var requests = []
  requests.push(http1.get('/users/1').then(onSuccess))
  requests.push(http1.get('/users/2').then(onSuccess))

  requests.push(http2.get('/users/3').then(onSuccess))
  requests.push(http2.get('/users/4').then(onSuccess))

  await delay(90)
  expect(onSuccess.callCount).toEqual(2)
  await Promise.all(requests)
  expect(onSuccess.callCount).toEqual(4)
})
