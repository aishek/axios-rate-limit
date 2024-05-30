function AxiosRateLimit (axios) {
  this.queue = []
  this.timeslotRequests = 0

  this.interceptors = {
    request: null,
    response: null
  }

  this.handleRequest = this.handleRequest.bind(this)
  this.handleResponse = this.handleResponse.bind(this)

  this.enable(axios)
}

AxiosRateLimit.prototype.getMaxRPS = function () {
  var perSeconds = (this.perMilliseconds / 1000)
  return this.maxRequests / perSeconds
}

AxiosRateLimit.prototype.getQueue = function () {
  return this.queue
}

AxiosRateLimit.prototype.setMaxRPS = function (rps) {
  this.setRateLimitOptions({
    maxRequests: rps,
    perMilliseconds: 1000
  })
}

AxiosRateLimit.prototype.setRateLimitOptions = function (options) {
  if (options.maxRPS) {
    this.setMaxRPS(options.maxRPS)
  } else {
    this.perMilliseconds = options.perMilliseconds
    this.maxRequests = options.maxRequests
  }
}

AxiosRateLimit.prototype.enable = function (axios) {
  function handleError (error) {
    return Promise.reject(error)
  }

  this.interceptors.request = axios.interceptors.request.use(
    this.handleRequest,
    handleError
  )
  this.interceptors.response = axios.interceptors.response.use(
    this.handleResponse,
    handleError
  )
}

/*
 * from axios library (dispatchRequest.js:11)
 * @param config
 */
function throwIfCancellationRequested (config) {
  if (config.cancelToken) {
    config.cancelToken.throwIfRequested()
  }
}

AxiosRateLimit.prototype.handleRequest = function (request) {
  return new Promise(function (resolve, reject) {
    this.push({
      /*
       * rejects a cancelled request and returns request has been resolved or not
       * @returns {boolean}
       */
      resolve: function () {
        try {
          throwIfCancellationRequested(request)
        } catch (error) {
          reject(error)
          return false
        }
        resolve(request)
        return true
      }
    })
  }.bind(this))
}

AxiosRateLimit.prototype.handleResponse = function (response) {
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
  if (this.timeslotRequests === this.maxRequests) {
    if (this.timeoutId && typeof this.timeoutId.ref === 'function') {
      this.timeoutId.ref()
    }

    return
  }

  var queued = this.queue.shift()
  var resolved = queued.resolve()

  if (this.timeslotRequests === 0) {
    this.timeoutId = setTimeout(function () {
      this.timeslotRequests = 0
      this.shift()
    }.bind(this), this.perMilliseconds)

    if (typeof this.timeoutId.unref === 'function') {
      if (this.queue.length === 0) this.timeoutId.unref()
    }
  }

  if (!resolved) {
    this.shift() // rejected request --> shift another request
    return
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
 *   // note maxRPS is a shorthand for perMilliseconds: 1000, and it takes precedence
 *   // if specified both with maxRequests and perMilliseconds
 *   const http = rateLimit(axios.create(), { maxRequests: 2, perMilliseconds: 1000, maxRPS: 2 })
*    http.getMaxRPS() // 2
 *   http.get('https://example.com/api/v1/users.json?page=1') // will perform immediately
 *   http.get('https://example.com/api/v1/users.json?page=2') // will perform immediately
 *   http.get('https://example.com/api/v1/users.json?page=3') // will perform after 1 second from the first one
 *   http.setMaxRPS(3)
 *   http.getMaxRPS() // 3
 *   http.setRateLimitOptions({ maxRequests: 6, perMilliseconds: 150 }) // same options as constructor
 *
 * @param {Object} axios axios instance
 * @param {Object} options options for rate limit, available for live update
 * @param {Number} options.maxRequests max requests to perform concurrently in given amount of time.
 * @param {Number} options.perMilliseconds amount of time to limit concurrent requests.
 * @returns {Object} axios instance with interceptors added
 */
function axiosRateLimit (axios, options) {
  var rateLimitInstance = new AxiosRateLimit(axios)
  rateLimitInstance.setRateLimitOptions(options)

  axios.getQueue = AxiosRateLimit.prototype.getQueue.bind(rateLimitInstance)
  axios.getMaxRPS = AxiosRateLimit.prototype.getMaxRPS.bind(rateLimitInstance)
  axios.setMaxRPS = AxiosRateLimit.prototype.setMaxRPS.bind(rateLimitInstance)
  axios.setRateLimitOptions = AxiosRateLimit.prototype.setRateLimitOptions
    .bind(rateLimitInstance)

  return axios
}

module.exports = axiosRateLimit
