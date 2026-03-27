import type { AxiosInstance } from 'axios';

type RateLimitRequestHandler = {
  resolve: () => boolean
}

interface RateLimiter {
    getQueue: () => RateLimitRequestHandler[] | Queue,
    getMaxRPS: () => number,
    setMaxRPS: (rps: number) => void,
    setRateLimitOptions: (options?: rateLimitOptions) => void,
}

type RateLimitedAxiosInstance<T = AxiosInstance> = T & RateLimiter;

type RateLimitEntry = {
    maxRequests: number,
    duration: string | number
};

interface Queue<T = RateLimitRequestHandler> {
    push(item: T): void | Promise<void>;
    shift(): T | undefined | Promise<T | undefined>;
    length?: number;
    getLength?(): number | Promise<number>;
}

type rateLimitOptions = {
    maxRequests?: number,
    perMilliseconds?: number,
    maxRPS?: number,
    duration?: string | number,
    limits?: RateLimitEntry[],
    queue?: Queue,
    shouldCountRequest?: (config: any, response: any) => boolean
};

interface AxiosRateLimiter extends RateLimiter {
    enable<T>(axios: T): RateLimitedAxiosInstance<T>;
}

interface AxiosRateLimiterConstructor {
    new (queue?: Queue): AxiosRateLimiter;
    prototype: AxiosRateLimiter;
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
  *   http.getMaxRPS() // 2
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
declare function axiosRateLimit<T = AxiosInstance>(
    axiosInstance: T,
    options?: rateLimitOptions & { rateLimiter?: AxiosRateLimiter }
): RateLimitedAxiosInstance<T>;

declare namespace axiosRateLimit {
    export {
        RateLimitRequestHandler,
        RateLimiter,
        RateLimitedAxiosInstance,
        RateLimitEntry,
        Queue,
        rateLimitOptions,
        AxiosRateLimiterConstructor,
    };
    export const AxiosRateLimiter: AxiosRateLimiterConstructor;
    export function getLimiter(options: rateLimitOptions): AxiosRateLimiter;
}

export = axiosRateLimit;
