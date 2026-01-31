var DURATION_MSG = " Expected format: number+unit ms, s, m, h (e.g. '1s')."

var DURATION_UNITS = { ms: 1, s: 1000, m: 60000, h: 3600000 }

function parseDuration (value) {
  if (typeof value === 'number' && !isNaN(value)) {
    return value
  }
  if (typeof value !== 'string') {
    var msg = "Unrecognized duration: '" + String(value) + "'." + DURATION_MSG
    throw new Error(msg)
  }
  var s = value.trim()
  var num
  var mult
  if (s.length >= 2 && s.slice(-2) === 'ms') {
    num = parseFloat(s.slice(0, -2), 10)
    mult = 1
  } else if (s.length >= 1) {
    var u = s.slice(-1)
    mult = DURATION_UNITS[u]
    if (mult == null) {
      var err = "Unrecognized duration: '" + value + "'." + DURATION_MSG
      throw new Error(err)
    }
    num = parseFloat(s.slice(0, -1), 10)
  } else {
    var err2 = "Unrecognized duration: '" + value + "'." + DURATION_MSG
    throw new Error(err2)
  }
  if (isNaN(num) || num < 0) {
    var err3 = "Unrecognized duration: '" + value + "'." + DURATION_MSG
    throw new Error(err3)
  }
  return num * mult
}

function buildWindows (options) {
  var limits = options && options.limits
  if (limits && limits.length > 0) {
    return limits.map(function (limit) {
      var perMs = parseDuration(limit.duration)
      return { count: 0, max: limit.maxRequests, perMs: perMs, timeoutId: null }
    })
  }
  var maxRequests = options.maxRequests
  var perMs
  if (options.maxRPS != null) {
    maxRequests = options.maxRPS
    perMs = 1000
  } else {
    var optD = options.duration
    perMs = optD != null ? parseDuration(optD) : options.perMilliseconds
  }
  return [{ count: 0, max: maxRequests, perMs: perMs, timeoutId: null }]
}

function clearWindowsTimeouts (windows) {
  if (!windows) return
  for (var i = 0; i < windows.length; i++) {
    if (windows[i].timeoutId != null) {
      clearTimeout(windows[i].timeoutId)
      windows[i].timeoutId = null
    }
  }
}

function AxiosRateLimit (axios) {
  this.queue = []
  this.windows = []

  this.interceptors = {
    request: null,
    response: null
  }

  this.handleRequest = this.handleRequest.bind(this)
  this.handleResponse = this.handleResponse.bind(this)

  this.enable(axios)
}

AxiosRateLimit.prototype.getMaxRPS = function () {
  var w = this.windows[0]
  if (!w) return 0
  return w.max / (w.perMs / 1000)
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
  if (!options) return
  clearWindowsTimeouts(this.windows)
  this.windows = buildWindows(options)
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
  var windows = this.windows
  for (var i = 0; i < windows.length; i++) {
    if (windows[i].count === windows[i].max) {
      var tid = windows[i].timeoutId
      if (tid && typeof tid.ref === 'function') {
        tid.ref()
      }
      return
    }
  }

  var queued = this.queue.shift()
  var resolved = queued.resolve()

  if (!resolved) {
    this.shift()
    return
  }

  var self = this
  for (var j = 0; j < windows.length; j++) {
    var w = windows[j]
    w.count += 1
    if (w.count === 1) {
      w.timeoutId = setTimeout(function (win) {
        win.count = 0
        win.timeoutId = null
        self.shift()
      }.bind(null, w), w.perMs)
      if (typeof w.timeoutId.unref === 'function') {
        if (this.queue.length === 0) w.timeoutId.unref()
      }
    }
  }
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
  if (options != null) {
    rateLimitInstance.setRateLimitOptions(options)
  }

  axios.getQueue = AxiosRateLimit.prototype.getQueue.bind(rateLimitInstance)
  axios.getMaxRPS = AxiosRateLimit.prototype.getMaxRPS.bind(rateLimitInstance)
  axios.setMaxRPS = AxiosRateLimit.prototype.setMaxRPS.bind(rateLimitInstance)
  axios.setRateLimitOptions = AxiosRateLimit.prototype.setRateLimitOptions
    .bind(rateLimitInstance)

  return axios
}

module.exports = axiosRateLimit
