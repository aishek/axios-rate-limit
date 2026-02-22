var sinon = require('sinon')

var helpers = require('./helpers')
var axios = helpers.requireAxios(process.env.AXIOS_VERSION)
var axiosRateLimit = require('../src/index')
var delay = helpers.delay

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

it('does not slow down on error when requests reject', async function () {
  var maxRPS = 10
  var totalRequests = 15
  var maxSettleTimeMs = 1500
  function adapter () { return Promise.reject(new Error('fail')) }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRPS: maxRPS }
  )

  var start = Date.now()
  var promises = []
  for (var i = 0; i < totalRequests; i++) {
    promises.push(http.get('/users').catch(function (err) { return err }))
  }
  var results = await Promise.all(promises)
  var elapsed = Date.now() - start

  expect(results.length).toEqual(totalRequests)
  results.forEach(function (r) {
    expect(r).toBeInstanceOf(Error)
    expect(r.message).toEqual('fail')
  })
  expect(elapsed).toBeLessThan(maxSettleTimeMs)
})

it('does not double shift on request interceptor reject', async function () {
  var concurrent = 0
  var maxConcurrent = 0
  function adapter (config) {
    concurrent++
    if (concurrent > maxConcurrent) maxConcurrent = concurrent
    return delay(50).then(function () {
      concurrent--
      return config
    })
  }
  var axiosInstance = axios.create({ adapter: adapter })
  axiosInstance.interceptors.request.use(function (config) {
    if (config.url === '/reject') return Promise.reject(new Error('reject'))
    return config
  })
  var opts = { maxRequests: 1, perMilliseconds: 1000 }
  var http = axiosRateLimit(axiosInstance, opts)

  var p1 = http.get('/first').catch(function (e) { return e })
  var p2 = http.get('/second').catch(function (e) { return e })
  var p3 = http.get('/reject').catch(function (e) { return e })

  await Promise.all([p1, p2, p3])

  expect(maxConcurrent).toBe(1)
})

it('request interceptor error handler propagates rejection', async function () {
  var requestRejected = new Error('request rejected')
  function adapter (config) { return Promise.resolve(config) }
  var axiosInstance = axios.create({ adapter: adapter })
  var http = axiosRateLimit(axiosInstance, { maxRPS: 1 })
  axiosInstance.interceptors.request.use(function () {
    return Promise.reject(requestRejected)
  })
  var caught
  await http.get('/any').catch(function (err) { caught = err })
  expect(caught).toBe(requestRejected)
  expect(caught.message).toBe('request rejected')
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

it('releases full batch when window resets (issue 63)', async function () {
  var dispatchTimes = []
  var adapterDelay = 25
  function adapter (config) {
    dispatchTimes.push(Date.now())
    return delay(adapterDelay).then(function () { return config })
  }
  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 2, perMilliseconds: 50 }
  )
  var onSuccess = sinon.spy()
  var promises = []
  for (var i = 0; i < 4; i++) {
    promises.push(http.get('/users').then(onSuccess))
  }
  await delay(60)
  await Promise.all(promises)
  expect(dispatchTimes.length).toEqual(4)
  expect(onSuccess.callCount).toEqual(4)
  var thirdFourthGap = dispatchTimes[3] - dispatchTimes[2]
  expect(thirdFourthGap).toBeLessThan(15)
})
