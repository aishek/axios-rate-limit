import { AxiosInstance } from 'axios';

export interface RateLimitedAxiosInstance extends AxiosInstance {}

declare function axiosRateLimit(
    axiosInstance: AxiosInstance,
    options: { maxRequests: number, perMilliseconds: number },
): RateLimitedAxiosInstance;

export default axiosRateLimit;