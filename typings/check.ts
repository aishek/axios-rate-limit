import axios from 'axios';
import rateLimit from './index';
import type { RateLimitedAxiosInstance, rateLimitOptions } from './index';
import { getLimiter } from './index';

const options: rateLimitOptions = { maxRequests: 2, perMilliseconds: 1000 };
const client: RateLimitedAxiosInstance = rateLimit(axios.create(), options);
client.getMaxRPS();

getLimiter(options);
