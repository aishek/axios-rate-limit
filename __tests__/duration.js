var sinon = require('sinon')

var helpers = require('./helpers')
var axios = helpers.requireAxios(process.env.AXIOS_VERSION)
var axiosRateLimit = require('../src/index')
var delay = helpers.delay

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
