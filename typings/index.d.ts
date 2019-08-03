import { AxiosInstance } from 'axios';

declare function axiosRateLimit(
    axiosInstance: AxiosInstance,
    options: { maxRequests: number, perMilliseconds: number },
): AxiosInstance;

export default axiosRateLimit;