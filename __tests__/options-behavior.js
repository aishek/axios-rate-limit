var sinon = require('sinon')

var helpers = require('./helpers')
var axios = helpers.requireAxios(process.env.AXIOS_VERSION)
var axiosRateLimit = require('../src/index')
var delay = helpers.delay

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

it('setRateLimitOptions when window timeoutId already null', async function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 1, perMilliseconds: 50 }
  )
  await http.get('/users')
  await delay(60)
  http.setRateLimitOptions({ maxRequests: 2, perMilliseconds: 100 })
  expect(http.getMaxRPS()).toEqual(20)
})

it('setRateLimitOptions processes queued reqs', async function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    {
      limits: [
        { maxRequests: 2, duration: '2s' },
        { maxRequests: 1, duration: '200ms' }
      ]
    }
  )
  var onSuccess = sinon.spy()
  var p1 = http.get('/users').then(onSuccess)
  var p2 = http.get('/users').then(onSuccess)
  await delay(10)
  expect(onSuccess.callCount).toEqual(1)
  expect(http.getQueue().length).toEqual(1)
  await p1
  expect(http.getQueue().length).toEqual(1)
  http.setRateLimitOptions({ maxRequests: 2, perMilliseconds: 100 })
  await p2
  expect(onSuccess.callCount).toEqual(2)
})

it('setRateLimitOptions invalid leaves windows intact', async function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 1, perMilliseconds: 200 }
  )
  var onSuccess = sinon.spy()
  var p1 = http.get('/users').then(onSuccess)
  var p2 = http.get('/users').then(onSuccess)
  await delay(10)
  expect(onSuccess.callCount).toEqual(1)
  expect(http.getQueue().length).toEqual(1)
  expect(function () {
    http.setRateLimitOptions({
      limits: [{ maxRequests: 1, duration: 'invalid' }]
    })
  }).toThrow(/Expected format.*ms.*s.*m.*h/)
  await delay(250)
  await Promise.all([p1, p2])
  expect(onSuccess.callCount).toEqual(2)
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

it('uses default array when queue option is omitted', function () {
  function adapter (config) { return Promise.resolve(config) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 1, perMilliseconds: 1000 }
  )
  var queue = http.getQueue()
  expect(Array.isArray(queue)).toEqual(true)
  expect(queue).toEqual([])
})

it('uses custom queue when queue option is provided', async function () {
  function adapter (config) { return Promise.resolve(config) }

  var customQueue = []
  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 1, perMilliseconds: 100, queue: customQueue }
  )
  expect(http.getQueue()).toBe(customQueue)

  var onSuccess = sinon.spy()
  var p1 = http.get('/users').then(onSuccess)
  var p2 = http.get('/users').then(onSuccess)
  await delay(10)
  expect(onSuccess.callCount).toEqual(1)
  expect(customQueue.length).toEqual(1)

  await Promise.all([p1, p2])
  expect(onSuccess.callCount).toEqual(2)
  expect(customQueue.length).toEqual(0)
})

it('calls timeout ref when blocked by full window', async function () {
  function adapter (config) { return Promise.resolve(config) }

  var realSetTimeout = global.setTimeout
  var refSpy = sinon.spy()
  function fakeSetTimeout (fn, ms) {
    if (ms === 0) {
      return realSetTimeout.apply(global, arguments)
    }
    realSetTimeout.apply(global, arguments)
    return { ref: refSpy, unref: function () {} }
  }
  var setTimeoutStub =
    sinon.stub(global, 'setTimeout').callsFake(fakeSetTimeout)

  try {
    var opts = { maxRequests: 1, perMilliseconds: 500 }
    var http = axiosRateLimit(axios.create({ adapter: adapter }), opts)
    var onSuccess = sinon.spy()
    var p1 = http.get('/users').then(onSuccess)
    var p2 = http.get('/users').then(onSuccess)
    await delay(10)
    expect(onSuccess.callCount).toEqual(1)
    expect(http.getQueue().length).toEqual(1)
    expect(refSpy.called).toEqual(true)
    await delay(500)
    await Promise.all([p1, p2])
    expect(onSuccess.callCount).toEqual(2)
  } finally {
    setTimeoutStub.restore()
  }
})

it('calls timeout unref when single req leaves queue empty', async function () {
  function adapter (config) { return Promise.resolve(config) }

  var realSetTimeout = global.setTimeout
  var unrefSpy = sinon.spy()
  function fakeSetTimeout (fn, ms) {
    if (ms === 0) {
      return realSetTimeout.apply(global, arguments)
    }
    realSetTimeout.apply(global, arguments)
    return { ref: function () {}, unref: unrefSpy }
  }
  var setTimeoutStub =
    sinon.stub(global, 'setTimeout').callsFake(fakeSetTimeout)

  try {
    var opts = { maxRequests: 1, perMilliseconds: 1000 }
    var http = axiosRateLimit(axios.create({ adapter: adapter }), opts)
    var onSuccess = sinon.spy()
    await http.get('/users').then(onSuccess)
    expect(onSuccess.callCount).toEqual(1)
    expect(unrefSpy.called).toEqual(true)
  } finally {
    setTimeoutStub.restore()
  }
})
