import type { AxiosInstance } from 'axios';

type RateLimitOptions = { maxRequests?: number; perMilliseconds?: number } | { maxRPS?: number };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function configWithMaxRPS(options: any): options is { maxRPS: number } {
	return options.maxRPS !== undefined;
}

function configWithMillisecondsAndMaxRequests(
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	options: any
): options is { maxRequests: number; perMilliseconds: number } {
	return options.maxRequests !== undefined && options.perMilliseconds !== undefined;
}

export class AxiosRateLimit {
	private queue: { resolve(): void }[] = [];

	private timeslotRequests = 0;

	perMilliseconds: number;

	maxRequests: number;

	timeoutId?: NodeJS.Timeout;

	constructor(axios: AxiosInstance) {
		this.enable(axios);
	}

	getMaxRPS(): number {
		const perSeconds = this.perMilliseconds / 1000;
		return this.maxRequests / perSeconds;
	}

	setMaxRPS(rps: number): void {
		this.setRateLimitOptions({
			maxRequests: rps,
			perMilliseconds: 1000
		});
	}

	setRateLimitOptions(options: RateLimitOptions): void {
		if (configWithMaxRPS(options)) {
			this.setMaxRPS(options.maxRPS);
		} else if (configWithMillisecondsAndMaxRequests(options)) {
			this.perMilliseconds = options.perMilliseconds;
			this.maxRequests = options.maxRequests;
		} else {
			throw new Error('invalid config parameters');
		}
	}

	private enable(axios: AxiosInstance) {
		function handleError(error: Error) {
			return Promise.reject(error);
		}

		axios.interceptors.request.use(this.handleRequest.bind(this), handleError);
		axios.interceptors.response.use(this.handleResponse.bind(this), handleError);
	}

	private handleRequest<V>(request: V) {
		return new Promise<V>(resolve => {
			this.push({
				resolve() {
					resolve(request);
				}
			});
		});
	}

	private handleResponse<V>(response: V) {
		this.shift();
		return response;
	}

	private push(requestHandler: { resolve(): void }) {
		this.queue.push(requestHandler);
		this.shiftInitial();
	}

	private shiftInitial() {
		setTimeout(() => this.shift(), 0);
	}

	private shift() {
		if (!this.queue.length) return;
		if (this.timeslotRequests === this.maxRequests) {
			if (this.timeoutId && typeof this.timeoutId.ref === 'function') {
				this.timeoutId.ref();
			}

			return;
		}

		const queued = this.queue.shift();
		queued?.resolve();

		if (this.timeslotRequests === 0) {
			this.timeoutId = setTimeout(() => {
				this.timeslotRequests = 0;
				this.shift();
			}, this.perMilliseconds);

			if (typeof this.timeoutId.unref === 'function') {
				if (this.queue.length === 0) this.timeoutId.unref();
			}
		}

		this.timeslotRequests += 1;
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
function axiosRateLimit(axios: AxiosInstance, options?: RateLimitOptions) {
	const rateLimitInstance = new AxiosRateLimit(axios);
	if (options) {
		rateLimitInstance.setRateLimitOptions(options);
	}

	// eslint-disable-next-line no-param-reassign
	axios.getMaxRPS = AxiosRateLimit.prototype.getMaxRPS.bind(rateLimitInstance);
	// eslint-disable-next-line no-param-reassign
	axios.setMaxRPS = AxiosRateLimit.prototype.setMaxRPS.bind(rateLimitInstance);
	// eslint-disable-next-line no-param-reassign
	axios.setRateLimitOptions = AxiosRateLimit.prototype.setRateLimitOptions.bind(rateLimitInstance);

	return axios;
}

module.exports = axiosRateLimit;

declare module 'axios' {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	interface AxiosInstance {
		getMaxRPS: typeof AxiosRateLimit.prototype.getMaxRPS;
		setMaxRPS: typeof AxiosRateLimit.prototype.setMaxRPS;
		setRateLimitOptions: typeof AxiosRateLimit.prototype.setRateLimitOptions;
	}
}
