var axios = require('axios')
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

  await Promise.all(requests)
  var end = Date.now()
  expect(onSuccess.callCount).toEqual(3)
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
