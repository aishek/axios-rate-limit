import { AxiosInstance } from 'axios';

export type RateLimitRequestHandler = {
  resolve: () => boolean
}

export interface RateLimiter {
    getQueue: () => RateLimitRequestHandler[],
    getMaxRPS: () => number,
    setMaxRPS: (rps: number) => void,
    setRateLimitOptions: (options: rateLimitOptions) => void,
    // handleRequest(request:any):any,
    // handleResponse(response: any): any,
    // push(requestHandler:any):any,
    // shiftInitial():any,
    // shift():any
}

export interface RateLimitedAxiosInstance extends AxiosInstance, RateLimiter {}

export type rateLimitOptions = {
    maxRequests?: number,
    perMilliseconds?: number,
    maxRPS?: number
};

export interface AxiosRateLimiter extends RateLimiter {}

export class AxiosRateLimiter implements RateLimiter {
  constructor(options: rateLimitOptions);
  enable(axios: AxiosInstance): RateLimitedAxiosInstance;
}

/**
 * Create a new rate limiter instance. It can be shared between multiple axios instances.
 * The rate-limiting is shared between axios instances that are enabled with this rate limiter.
 *
 * @example
 *   import rateLimit, { getLimiter } from 'axios-rate-limit';
 *
 *   const limiter = getLimiter({ maxRequests: 2, perMilliseconds: 1000 })
 *   // limit an axios instance with this rate limiter:
 *   const http1 = limiter.enable(axios.create())
 *   // another way of doing the same thing:
 *   const http2 = rateLimit(axios.create(), { rateLimiter: limiter })
 *
 * @param {Object} options options for rate limit, same as for rateLimit()
 * @returns {Object} rate limiter instance
 */
export function getLimiter (options: rateLimitOptions): AxiosRateLimiter;

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
  * @param {Object} axiosInstance axios instance
  * @param {Object} options options for rate limit, available for live update
  * @param {Number} options.maxRequests max requests to perform concurrently in given amount of time.
  * @param {Number} options.perMilliseconds amount of time to limit concurrent requests.
  * @returns {Object} axios instance with interceptors added
  */
export default function axiosRateLimit(
    axiosInstance: AxiosInstance,
    options: rateLimitOptions & { rateLimiter?: AxiosRateLimiter }
): RateLimitedAxiosInstance;
