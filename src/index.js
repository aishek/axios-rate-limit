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

function hasOwn (obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function hasExplicitRateLimitOptions (options) {
  if (!options) return false
  return (
    hasOwn(options, 'limits') ||
    hasOwn(options, 'maxRequests') ||
    hasOwn(options, 'perMilliseconds') ||
    hasOwn(options, 'maxRPS') ||
    hasOwn(options, 'duration')
  )
}

function normalizeHeaders (headers) {
  var normalized = {}
  if (!headers) return normalized
  var keys = Object.keys(headers)
  for (var i = 0; i < keys.length; i++) {
    normalized[keys[i].toLowerCase()] = headers[keys[i]]
  }
  return normalized
}

function getHeaderValue (headers, names) {
  for (var i = 0; i < names.length; i++) {
    var value = headers[names[i]]
    if (value != null && value !== '') return value
  }
  return null
}

function parsePositiveNumber (value) {
  var num = Number(value)
  if (!isFinite(num) || num <= 0) return null
  return num
}

function getResetMs (resetRaw) {
  var reset = parsePositiveNumber(resetRaw)
  if (reset == null) return null
  var nowSeconds = Date.now() / 1000
  var deltaSeconds = reset >= 1000000000 ? (reset - nowSeconds) : reset
  if (!isFinite(deltaSeconds)) return null
  return Math.max(1, Math.ceil(Math.max(0, deltaSeconds) * 1000))
}

function getHeaderBasedRateLimitOptions (config, response) {
  if (!response || !response.headers) return null
  var headers = normalizeHeaders(response.headers)
  var limitRaw = getHeaderValue(headers, [
    'x-ratelimit-limit',
    'x-rate-limit-limit',
    'ratelimit-limit'
  ])
  var resetRaw = getHeaderValue(headers, [
    'x-ratelimit-reset',
    'x-rate-limit-reset',
    'ratelimit-reset'
  ])
  var remainingRaw = getHeaderValue(headers, [
    'x-ratelimit-remaining',
    'x-rate-limit-remaining',
    'ratelimit-remaining'
  ])
  var limit = parsePositiveNumber(limitRaw)
  var perMs = getResetMs(resetRaw)
  if (limit == null || perMs == null) return null
  if (remainingRaw != null) {
    var remaining = Number(remainingRaw)
    if (!isFinite(remaining)) return null
  }
  return {
    maxRequests: limit,
    perMilliseconds: perMs
  }
}

function AxiosRateLimit (queue) {
  this.queue = queue
  this.windows = []
  this._shiftPromise = Promise.resolve()
  this._headerAutoEnabled = true
  this._hasExplicitRateLimitOptions = false
  this._onResponseRateLimit = null

  this.handleRequest = this.handleRequest.bind(this)
  this.handleResponse = this.handleResponse.bind(this)
  this.handleErrorResponse = this.handleErrorResponse.bind(this)
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

AxiosRateLimit.prototype._getResolvedOnResponseRateLimit = function () {
  if (typeof this._onResponseRateLimit === 'function') {
    return this._onResponseRateLimit
  }
  if (!this._headerAutoEnabled || this._hasExplicitRateLimitOptions) {
    return null
  }
  return getHeaderBasedRateLimitOptions
}

AxiosRateLimit.prototype._isSameSingleWindow = function (options) {
  if (!options || options.limits) return false
  var hasMax = hasOwn(options, 'maxRequests')
  var hasPer = (
    hasOwn(options, 'perMilliseconds') ||
    hasOwn(options, 'duration') ||
    hasOwn(options, 'maxRPS')
  )
  if (!hasMax || !hasPer) return false
  if (this.windows.length !== 1) return false
  var candidate = buildWindows(options)
  var current = this.windows[0]
  var maxMatches = candidate[0].max === current.max
  var perMsMatches = candidate[0].perMs === current.perMs
  return maxMatches && perMsMatches
}

AxiosRateLimit.prototype.setRateLimitOptions = function (options, meta) {
  if (!options) return
  var context = meta || {}
  this._shouldCountRequest = options.shouldCountRequest
  if (hasOwn(options, 'onResponseRateLimit')) {
    this._onResponseRateLimit = options.onResponseRateLimit
  }
  if (hasOwn(options, 'autoRateLimitByHeaders')) {
    this._headerAutoEnabled = options.autoRateLimitByHeaders !== false
  }
  if (context.fromAuto !== true && hasExplicitRateLimitOptions(options)) {
    this._hasExplicitRateLimitOptions = true
  }
  if (context.fromAuto === true && this._hasExplicitRateLimitOptions) {
    return
  }
  if (context.fromAuto === true && this._isSameSingleWindow(options)) {
    return
  }
  if (!hasExplicitRateLimitOptions(options)) {
    var hasOnlyBehaviorOptions = (
      hasOwn(options, 'shouldCountRequest') ||
      hasOwn(options, 'onResponseRateLimit') ||
      hasOwn(options, 'autoRateLimitByHeaders')
    )
    if (hasOnlyBehaviorOptions) return
    buildWindows(options)
    return
  }
  var newWindows = buildWindows(options)
  clearWindowsTimeouts(this.windows)
  this.windows = newWindows
  this.shift().catch(function () {})
}

AxiosRateLimit.prototype.enable = function (axios) {
  var self = this

  function handleError (error) {
    return self.handleErrorResponse(error)
  }

  axios.interceptors.request.use(
    function (request) {
      return self.handleRequest(request)
    },
    function (error) { return Promise.reject(error) }
  )
  axios.interceptors.response.use(
    function (response) {
      return self.handleResponse(response)
    },
    handleError
  )

  axios.getQueue = function () {
    return self.getQueue()
  }
  axios.getMaxRPS = function () {
    return self.getMaxRPS()
  }
  axios.setMaxRPS = function (rps) {
    self.setMaxRPS(rps)
  }
  axios.setRateLimitOptions = function (options) {
    self.setRateLimitOptions(options)
  }

  return axios
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

// Handle response rate limit adaptation
AxiosRateLimit.prototype._handleResponseRateLimit = function (config, response, error) {
  var self = this
  var onResponseRateLimit = self._getResolvedOnResponseRateLimit()
  if (typeof onResponseRateLimit === 'function') {
    try {
      var nextOptions = onResponseRateLimit(config, response, error)
      if (nextOptions && !self._isSameSingleWindow(nextOptions)) {
        self.setRateLimitOptions(nextOptions, { fromAuto: true })
      }
    } catch (e) {}
  }
}

AxiosRateLimit.prototype.handleResponse = function (response) {
  var self = this
  if (typeof self._shouldCountRequest === 'function') {
    try {
      if (self._shouldCountRequest(response.config, response) === false) {
        for (var i = 0; i < self.windows.length; i++) {
          var w = self.windows[i]
          w.count = Math.max(0, w.count - 1)
        }
      }
    } catch (e) {}
  }
  self._handleResponseRateLimit(response.config, response, null)
  return Promise.resolve(self.shift()).then(function () { return response })
}

AxiosRateLimit.prototype.handleErrorResponse = function (error) {
  var self = this
  var response = error && error.response
  var config = error && error.config
  if (response && response.config) {
    config = response.config
  }
  self._handleResponseRateLimit(config, response, error)
  return Promise.resolve(self.shift()).then(function () {
    return Promise.reject(error)
  })
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
 * @param {Function} options.shouldCountRequest optional predicate (config, response) => boolean; when false the limiter refunds one slot (e.g. for cached responses). Omitted or true means count.
 * @returns {Object} axios instance with interceptors added
 */
function axiosRateLimit (axios, options) {
  var queue = (options && options.queue) || []
  var rateLimitInstance
  if (options && options.rateLimiter) {
    rateLimitInstance = options.rateLimiter
  } else {
    rateLimitInstance = new AxiosRateLimit(queue)
    if (options != null) {
      rateLimitInstance.setRateLimitOptions(options)
    }
  }

  return rateLimitInstance.enable(axios)
}

function getLimiter (options) {
  var queue = (options && options.queue) || []
  var rateLimitInstance = new AxiosRateLimit(queue)
  if (options != null) {
    rateLimitInstance.setRateLimitOptions(options)
  }
  return rateLimitInstance
}

axiosRateLimit._clearWindowsTimeouts = clearWindowsTimeouts
axiosRateLimit.getHeaderBasedRateLimitOptions = getHeaderBasedRateLimitOptions
module.exports = axiosRateLimit
module.exports.AxiosRateLimiter = AxiosRateLimit
module.exports.getLimiter = getLimiter
