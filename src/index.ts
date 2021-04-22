import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { MemoryStore } from './MemoryStore';

type RateLimitOptions = {
	keyGenerator?: (request: AxiosRequestConfig) => string;
	maxDelayMs?: number;
} & ({ maxRequests?: number; perMilliseconds?: number } | { maxRPS?: number });

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
	private queue: { request: any; resolve(): void; reject(err: Error): void }[] = [];

	private timeslotRequests = 0;

	perMilliseconds: number;

	maxRequests: number;

	timeoutId?: NodeJS.Timeout;

	private store: MemoryStore;

	private instanceId = Math.random();

	private keyGenerator: (request: AxiosRequestConfig) => string;

	maxDelayMs: number;

	constructor(axios: AxiosInstance, options?: RateLimitOptions, store?: MemoryStore) {
		if (options) {
			this.setRateLimitOptions(options, store);
		}

		this.keyGenerator =
			options?.keyGenerator ||
			((_request: AxiosRequestConfig) => `axios-rate-limit-${this.instanceId}`);

		function handleError(error: Error) {
			return Promise.reject(error);
		}

		axios.interceptors.request.use(this.handleRequest.bind(this), handleError);
		axios.interceptors.response.use(this.handleResponse.bind(this), handleError);
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

	setRateLimitOptions(options: RateLimitOptions, store?: MemoryStore): void {
		if (configWithMaxRPS(options)) {
			this.setMaxRPS(options.maxRPS);
			return;
		}

		this.maxDelayMs = options.maxDelayMs || Infinity;

		if (configWithMillisecondsAndMaxRequests(options)) {
			this.perMilliseconds = options.perMilliseconds;
			this.maxRequests = options.maxRequests;
		} else {
			throw new Error('invalid config parameters');
		}

		this.store = store || new MemoryStore(this.perMilliseconds || 1000);
	}

	private handleRequest<V>(request: V) {
		return new Promise<V>((resolve, reject) => {
			this.push({
				request,
				resolve() {
					resolve(request);
				},
				reject
			});
		});
	}

	private handleResponse<V>(response: V) {
		this.shift();
		return response;
	}

	private push(requestHandler: { request: any; resolve(): void; reject(err: Error): void }) {
		this.queue.push(requestHandler);
		this.shiftInitial();
	}

	private shiftInitial() {
		setTimeout(() => this.shift(), 0);
	}

	private shift() {
		if (!this.queue.length) return;

		const queued = this.queue.shift();

		if (!queued) {
			return;
		}

		const key = this.keyGenerator(queued.request);

		console.log('key', key);

		this.store.incr(key, (err, current, resetTime) => {
			if (err) {
				return queued.reject(err);
			}

			let delay = 0;

			if (current > this.maxRequests) {
				const unboundedDelay = (current - this.maxRequests) * this.perMilliseconds;
				delay = Math.min(unboundedDelay, this.maxDelayMs);
			}

			console.log('slowDown', {
				limit: this.maxRequests,
				current,
				remaining: Math.max(this.maxRequests - current, 0),
				resetTime,
				delay
			});

			if (current - 1 === this.maxRequests) {
				console.info('limit reached');
				// options.onLimitReached(req, res, options);
			}

			if (delay !== 0) {
				return setTimeout(queued.resolve, delay);
			}

			queued.resolve();
		});
	}

	private shiftOLD() {
		if (!this.queue.length) return;
		if (this.timeslotRequests === this.maxRequests) {
			if (this.timeoutId && typeof this.timeoutId.ref === 'function') {
				this.timeoutId.ref();
			}

			return;
		}

		const queued = this.queue.shift();
		// queued redis
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
function axiosRateLimit(axios: AxiosInstance, options?: RateLimitOptions, store?: MemoryStore) {
	const rateLimitInstance = new AxiosRateLimit(axios, options, store);
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
