import { AxiosInstance } from 'axios';

export interface RateLimitedAxiosInstance extends AxiosInstance {
    updateRateLimitOptions: (options: { maxRequests?: number, perMilliseconds?: number }) => void;
}

declare function axiosRateLimit(
    axiosInstance: AxiosInstance,
    options: { maxRequests: number, perMilliseconds: number },
): RateLimitedAxiosInstance;

export default axiosRateLimit;