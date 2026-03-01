var sinon = require('sinon')

var helpers = require('./helpers')
var axios = helpers.requireAxios(process.env.AXIOS_VERSION)
var axiosRateLimit = require('../src/index')
var delay = helpers.delay

it('works with sync custom queue (push, shift, length)', async function () {
  function adapter (config) { return Promise.resolve(config) }

  var backing = []
  var syncQueue = {
    push: function (handler) {
      backing.push(handler)
    },
    shift: function () {
      return backing.shift()
    },
    get length () {
      return backing.length
    }
  }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 1, perMilliseconds: 100, queue: syncQueue }
  )
  expect(http.getQueue()).toBe(syncQueue)

  var onSuccess = sinon.spy()
  var p1 = http.get('/users').then(onSuccess)
  var p2 = http.get('/users').then(onSuccess)
  await delay(10)
  expect(onSuccess.callCount).toEqual(1)
  expect(syncQueue.length).toEqual(1)

  await Promise.all([p1, p2])
  expect(onSuccess.callCount).toEqual(2)
  expect(syncQueue.length).toEqual(0)
})

it('works with async custom queue', async function () {
  function adapter (config) { return Promise.resolve(config) }

  var backing = []
  var asyncQueue = {
    push: function (handler) {
      backing.push(handler)
      return delay(1)
    },
    shift: function () {
      var item = backing.shift()
      return delay(1).then(function () { return item })
    },
    getLength: function () {
      return Promise.resolve(backing.length)
    }
  }

  var http = axiosRateLimit(
    axios.create({ adapter: adapter }),
    { maxRequests: 1, perMilliseconds: 100, queue: asyncQueue }
  )
  expect(http.getQueue()).toBe(asyncQueue)

  var onSuccess = sinon.spy()
  var p1 = http.get('/users').then(onSuccess)
  var p2 = http.get('/users').then(onSuccess)
  await delay(20)
  expect(onSuccess.callCount).toEqual(1)
  var len = await asyncQueue.getLength()
  expect(len).toEqual(1)

  await Promise.all([p1, p2])
  expect(onSuccess.callCount).toEqual(2)
  len = await asyncQueue.getLength()
  expect(len).toEqual(0)
})
