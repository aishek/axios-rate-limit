jest.mock('../src/index', function () {
  return function () {
    return {
      get: function () {
        return Promise.resolve({ status: 200, data: { key: 'value' } })
      },
      getMaxRPS: function () { return 2 },
      getQueue: function () { return [] },
      setMaxRPS: function () {},
      setRateLimitOptions: function () {}
    }
  }
})

var helpers = require('./helpers')
var axios = helpers.requireAxios(process.env.AXIOS_VERSION)
var rateLimit = require('../src/index')

function fetchData () {
  var opts = { maxRequests: 2, perMilliseconds: 1000, maxRPS: 2 }
  var http = rateLimit(axios.create(), opts)
  return http.get('https://example.com/api/v1/users.json?page=1')
    .then(function (response) {
      if (response.status === 200) return response.data
      return undefined
    })
}

it('returns mock response when rate-limit is mocked', async function () {
  var data = await fetchData()
  expect(data).toEqual({ key: 'value' })
})

it('getMaxRPS returns stub value from mock', function () {
  var http = rateLimit(axios.create(), { maxRPS: 2 })
  expect(http.getMaxRPS()).toEqual(2)
})
