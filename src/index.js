function AxiosRateLimit (options) {
  this.maxRequests = options.maxRequests
  this.perMilliseconds = options.perMilliseconds

  this.queue = []
  this.timeslotRequests = 0

  this.interceptors = {
    request: null,
    response: null
  }

  this.requestHandler = this.requestHandler.bind(this)
  this.responseHandler = this.responseHandler.bind(this)

  this.enable(options.axios)
}

AxiosRateLimit.prototype.enable = function (axios) {
  this.interceptors.request = axios.interceptors.request.use(
    this.requestHandler
  )
  this.interceptors.response = axios.interceptors.response.use(
    this.responseHandler,
    this.responseHandler
  )
}

AxiosRateLimit.prototype.requestHandler = function (request) {
  return new Promise(function (resolver) {
    this.push({ request: request, resolver: resolver })
  }.bind(this))
}

AxiosRateLimit.prototype.responseHandler = function (response) {
  this.shift()
  return response
}

AxiosRateLimit.prototype.push = function (requestHandler) {
  this.queue.push(requestHandler)
  this.shiftInitial()
}

AxiosRateLimit.prototype.shiftInitial = function () {
  setTimeout(function () { return this.shift() }.bind(this), 0)
}

AxiosRateLimit.prototype.shift = function () {
  if (!this.queue.length) return
  if (this.timeslotRequests === this.maxRequests) return

  var queued = this.queue.shift()
  queued.resolver(queued.request)

  if (this.timeslotRequests === 0) {
    setTimeout(function () {
      this.timeslotRequests = 0
      this.shift()
    }.bind(this), this.perMilliseconds)
  }
  this.timeslotRequests += 1
}

/**
 * Apply rate limit to axios instance.
 *
 * @example
 *   import axios from 'axios';
 *   import rateLimit from 'axios-rate-limit';
 *
 *   // sets max 2 requests per 1 second, other will be delayed
 *   const http = rateLimit(axios.create(), { maxRequests: 2, perMilliseconds: 1000 });
 *   http.get('https://example.com/api/v1/users.json?page=1') // will perform immediately
 *   http.get('https://example.com/api/v1/users.json?page=2') // will perform immediately
 *   http.get('https://example.com/api/v1/users.json?page=3') // will perform after 1 second from the first one
 *
 * @param {Object} axios axios instance
 * @param {Object} options options for rate limit.
 * @param {Number} options.maxRequests max requests to perform concurrently in given amount of time.
 * @param {Number} options.perMilliseconds amount of time to limit concurrent requests.
 * @returns {Object} axios instance with interceptors added
 */
function axiosRateLimit (axios, options) {
  new AxiosRateLimit({
    maxRequests: options.maxRequests,
    perMilliseconds: options.perMilliseconds,
    axios: axios
  })

  return axios
}

exports.__esModule = true
exports.name = 'axiosRateLimit'
exports.default = axiosRateLimit
