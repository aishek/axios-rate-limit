var sinon = require('sinon')

var helpers = require('./helpers')
var axios = helpers.requireAxios(process.env.AXIOS_VERSION)
var axiosRateLimit = require('../src/index')

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

it('reject if aborted via signal before executing', async function () {
  var maxRequests = 1
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRPS: maxRequests }
  )

  var onSuccess = sinon.spy()
  var onFailure = sinon.spy()

  var controller = new AbortController()
  controller.abort('cancelled for testing')
  await http.get('/users', { signal: controller.signal })
    .then(onSuccess)
    .catch(onFailure)

  expect(onSuccess.callCount).toBe(0)
  expect(onFailure.callCount).toBe(1)
  expect(onFailure.firstCall.args[0]).toBeInstanceOf(Error)
})

it('not delay requests if requests are aborted via signal', async function () {
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
  var controllers = []
  var start = Date.now()
  for (var i = 0; i < totalRequests; i++) {
    var controller = new AbortController()
    requests.push(
      http.get('/users', { signal: controller.signal })
        .then(onSuccess)
        .catch(onFailure)
    )
    controllers.push(controller)
  }

  expect(controllers.length).toBe(4)
  controllers[1].abort('cancelled for testing')
  controllers[2].abort('cancelled for testing')

  await Promise.all(requests)
  var end = Date.now()
  expect(onSuccess.callCount).toEqual(2)
  expect(onFailure.callCount).toEqual(2)
  expect(end - start).toBeLessThan(perMilliseconds * 2)
  expect(end - start).toBeGreaterThan(perMilliseconds)
})
