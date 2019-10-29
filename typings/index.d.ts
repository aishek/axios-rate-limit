import { AxiosInstance } from 'axios';

interface RateLimitedAxiosInstance extends AxiosInstance {}

declare function axiosRateLimit(
    axiosInstance: AxiosInstance,
    options: { maxRequests: number, perMilliseconds: number },
): RateLimitedAxiosInstance;

export = axiosRateLimit;
