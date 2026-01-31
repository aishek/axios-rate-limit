# Rate limit algorithm analysis (src/index.js)

## How the algorithm works

The implementation uses **fixed-window rate limiting** with a **FIFO queue**.

### State

- **Queue** (`this.queue`): Pending request handlers. Each handler has a `resolve` that either passes the request config to axios (so the request is sent) or rejects (e.g. cancellation).
- **Window state**: `timeslotRequests` counts how many requests have been released in the current window; `maxRequests` and `perMilliseconds` define the limit (e.g. 2 per 1000 ms).
- **Timer**: A single `setTimeout` (`timeoutId`) fires at the end of the current window to reset the counter and call `shift()` again to drain the queue.

### Flow

1. **Request interceptor** (`handleRequest`): Every request is not sent immediately. A handler is pushed onto `this.queue`, then `shiftInitial()` schedules `shift()` on the next tick.

2. **Releasing requests** (`shift`):
   - If the queue is empty → return.
   - If the current window is full (`timeslotRequests === maxRequests`) → return (request stays queued; the existing timer will call `shift()` again when the window ends).
   - Otherwise: pop the next handler from the queue and call its `resolve()` so axios sends that request. If that was the first release in this window, start a timer for `perMilliseconds` that will set `timeslotRequests = 0` and call `shift()` again. If the handler rejected (e.g. cancelled), call `shift()` again so the next request can be released. If it resolved, increment `timeslotRequests`.

3. **Response interceptor** (`handleResponse`): On every response, `shift()` is called again. That only releases more work when the window is not full; the real cap is the fixed window.

So: **at most `maxRequests` requests are released (sent) per `perMilliseconds` window**. When the window ends, the timer resets the counter and keeps pulling from the queue. Order is FIFO.

The `.bind(this)` on line 10 (and 11) ensures that when axios invokes these interceptors, `this` inside `handleRequest` / `handleResponse` refers to the `AxiosRateLimit` instance (so `this.queue`, `this.shift`, etc. are correct).

---

## Other common rate-limiting algorithms

| Algorithm | Idea | Typical use |
|-----------|------|-------------|
| **Fixed window** | Count requests in non-overlapping windows (e.g. 0–1s, 1–2s). | Simple "N per second" limits. |
| **Sliding window** | Limit over a window that moves with time (e.g. last 1 second from now). | Smoother, no burst at window boundaries. |
| **Sliding window log** | Store timestamp per request; allow only if count in last W ms is under limit. | Accurate but needs more memory. |
| **Token bucket** | Tokens added at a rate; each request consumes one; requests wait or drop if no token. | Bursts allowed up to bucket size. |
| **Leaky bucket** | Requests enter a queue; they leave at a constant rate. | Strictly smooth output rate. |

---

## This implementation: fixed window + queue

### Pros

- Simple: one counter, one timer, one queue.
- Predictable: exactly `maxRequests` per `perMilliseconds` window.
- No extra storage of timestamps; memory is one counter and the queue.
- Options (e.g. `maxRequests`, `perMilliseconds`) can be changed at runtime via `setRateLimitOptions` / `setMaxRPS`.
- Queued requests are delayed, not dropped, so no "429" from this layer.
- Timer can be `unref()`'d when the queue is empty so it doesn't keep the process alive.

### Cons

- **Burst at window boundaries**: Right after a window reset you can send another `maxRequests` immediately, so you can get 2× limit in a short time (e.g. 2 at end of window 1, 2 at start of window 2).
- **Single global limit**: One queue and one window for the whole axios instance; no per-URL or per-key limits.
- **Order of release**: Release is FIFO by "when they entered the queue," not by response completion; the response-triggered `shift()` only helps when under the limit.

---

## Pros and cons of other algorithms (short)

- **Sliding window (or sliding log)**
  **Pros:** Smoother rate, no double burst at boundaries.
  **Cons:** More state (timestamps or previous window count) and a bit more logic.

- **Token bucket**
  **Pros:** Allows short bursts up to bucket size; good when APIs tolerate bursts.
  **Cons:** Two parameters (rate + capacity); behavior is less "strict N per second" than a fixed window.

- **Leaky bucket**
  **Pros:** Very smooth output rate.
  **Cons:** Can add more latency; often implemented with a separate worker/process that "drains" the bucket.

---

**Summary:** This file implements a **fixed-window, queued rate limiter**. The main tradeoff is simplicity and predictability vs. the possibility of bursts at window boundaries. Other algorithms (sliding window, token bucket, leaky bucket) offer smoother or more flexible behavior at the cost of extra state or complexity.
