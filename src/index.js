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
