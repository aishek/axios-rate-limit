var DURATION_MSG = " Expected format: number+unit ms, s, m, h (e.g. '1s')."

var DURATION_UNITS = { ms: 1, s: 1000, m: 60000, h: 3600000 }

function throwDurationError (value) {
  var msg = "Unrecognized duration: '" + String(value) + "'." + DURATION_MSG
  throw new Error(msg)
}

function parseDuration (value) {
  if (typeof value === 'number' && !isNaN(value)) {
    if (value < 0) throwDurationError(value)
    return value
  }
  if (typeof value !== 'string') {
    throwDurationError(value)
  }
  var s = value.trim()
  var num
  var mult
  if (s.length >= 2 && s.slice(-2) === 'ms') {
    num = parseFloat(s.slice(0, -2))
    mult = DURATION_UNITS.ms
  } else if (s.length >= 1) {
    var u = s.slice(-1)
    mult = DURATION_UNITS[u]
    if (mult == null) throwDurationError(value)
    num = parseFloat(s.slice(0, -1))
  } else {
    throwDurationError(value)
  }
  if (isNaN(num) || num < 0) {
    throwDurationError(value)
  }
  return num * mult
}

function buildWindows (options) {
  var limits = options && options.limits
  if (limits && limits.length > 0) {
    return limits.map(function (limit, i) {
      var max = limit.maxRequests
      if (typeof max !== 'number' || !isFinite(max) || max <= 0) {
        throw new Error(
          'Invalid rate limit option at limits[' + i + ']: ' +
          'maxRequests is required and must be a positive number.'
        )
      }
      var perMs = parseDuration(limit.duration)
      if (typeof perMs !== 'number' || !isFinite(perMs) || perMs <= 0) {
        throw new Error(
          'Invalid rate limit option at limits[' + i + ']: ' +
          'duration must be a positive finite number.'
        )
      }
      return { count: 0, max: max, perMs: perMs, timeoutId: null }
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
  if (typeof perMs !== 'number' || !isFinite(perMs) || perMs <= 0) {
    throw new Error(
      'Invalid rate limit options: one of maxRPS, duration, or ' +
      'perMilliseconds is required and must be positive.'
    )
  }
  var maxInvalid = typeof maxRequests !== 'number' ||
    !isFinite(maxRequests) || maxRequests <= 0
  if (maxInvalid) {
    throw new Error(
      'Invalid rate limit options: maxRequests is required and ' +
      'must be a positive number.'
    )
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

function getQueueLength (queue) {
  if (typeof queue.getLength === 'function') {
    return Promise.resolve(queue.getLength())
  }
  return Promise.resolve(queue.length)
}

function isAsyncQueue (queue) {
  return typeof queue.getLength === 'function'
}

function AxiosRateLimit (axios, queue) {
  this.queue = queue
  this.windows = []
  this._shiftPromise = Promise.resolve()

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
  var newWindows = buildWindows(options)
  clearWindowsTimeouts(this.windows)
  this.windows = newWindows
  this.shift().catch(function () {})
}

AxiosRateLimit.prototype.enable = function (axios) {
  var self = this

  this.interceptors.request = axios.interceptors.request.use(
    this.handleRequest,
    function (error) { return Promise.reject(error) }
  )
  this.interceptors.response = axios.interceptors.response.use(
    this.handleResponse,
    function (error) {
      self.shift().catch(function () {})
      return Promise.reject(error)
    }
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
  if (config.signal && config.signal.aborted) {
    var reason = config.signal.reason
    throw reason != null ? reason : new Error('canceled')
  }
}

AxiosRateLimit.prototype.handleRequest = function (request) {
  var self = this
  return new Promise(function (resolve, reject) {
    var handler = {
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
    }
    Promise.resolve(self.queue.push(handler)).then(function () {
      self.shiftInitial()
    }).catch(reject)
  })
}

AxiosRateLimit.prototype.handleResponse = function (response) {
  var self = this
  return Promise.resolve(self.shift()).then(function () { return response })
}

AxiosRateLimit.prototype.shiftInitial = function () {
  var self = this
  setTimeout(function () { self.shift().catch(function () {}) }, 0)
}

AxiosRateLimit.prototype.shift = function () {
  var self = this
  function doShift () {
    return getQueueLength(self.queue).then(function (len) {
      if (!len) return undefined
      var windows = self.windows
      for (var i = 0; i < windows.length; i++) {
        if (windows[i].count === windows[i].max) {
          var tid = windows[i].timeoutId
          if (tid && typeof tid.ref === 'function') {
            tid.ref()
          }
          return undefined
        }
      }

      return Promise.resolve(self.queue.shift()).then(function (queued) {
        if (queued == null) return undefined
        var resolved = queued.resolve()

        if (!resolved) {
          return self.shift()
        }

        for (var j = 0; j < windows.length; j++) {
          var w = windows[j]
          w.count += 1
          if (w.count === 1) {
            w.timeoutId = setTimeout(function (win) {
              win.count = 0
              win.timeoutId = null
              function next () {
                getQueueLength(self.queue).then(function (queueLen) {
                  if (!queueLen) return
                  var wins = self.windows
                  var blocked = false
                  for (var k = 0; k < wins.length; k++) {
                    if (wins[k].count >= wins[k].max) {
                      blocked = true
                      break
                    }
                  }
                  if (blocked) return
                  self.shift().then(next).catch(function () {})
                })
              }
              next()
            }.bind(null, w), w.perMs)
            if (typeof w.timeoutId.unref === 'function') {
              getQueueLength(self.queue).then(function (queueLen) {
                if (queueLen === 0) w.timeoutId.unref()
              })
            }
          }
        }
        return undefined
      })
    })
  }
  if (isAsyncQueue(self.queue)) {
    var p = self._shiftPromise.then(doShift)
    self._shiftPromise = p.catch(function () {})
    return p
  }
  return doShift()
}

/**
 * Apply rate limit to axios instance.
 *
 * @example
 *   import axios from 'axios';
 *   import rateLimit from 'axios-rate-limit';
 *
 *   const http = rateLimit(axios.create(), { limits: [{ maxRequests: 2, duration: '1s' }] })
 *   http.getMaxRPS() // 2
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
 * @param {Object} options.queue optional queue (push, shift; length or getLength()). May be sync or async.
 * @param {Object} options.limits optional array of rate limit entries.
 * @param {Number} options.limits[].maxRequests max requests to perform concurrently in given amount of time.
 * @param {String} options.limits[].duration duration of the rate limit window.
 * @returns {Object} axios instance with interceptors added
 */
function axiosRateLimit (axios, options) {
  var queue = (options && options.queue) || []
  var rateLimitInstance = new AxiosRateLimit(axios, queue)
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

axiosRateLimit._clearWindowsTimeouts = clearWindowsTimeouts
module.exports = axiosRateLimit
