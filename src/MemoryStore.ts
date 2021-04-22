function calculateNextResetTime(windowMs: number) {
	const d = new Date();
	d.setMilliseconds(d.getMilliseconds() + windowMs);
	return d;
}

export class MemoryStore {
	hits: { [key: string]: number } = {};

	resetTime: Date;

	constructor(private windowMs: number) {
		this.resetTime = calculateNextResetTime(windowMs);

		// simply reset ALL hits every windowMs
		const interval = setInterval(this.resetAll, windowMs);
		if (interval.unref) {
			interval.unref();
		}
	}

	incr(key: string, cb: (...args: any) => any) {
		if (this.hits[key]) {
			this.hits[key]++;
		} else {
			this.hits[key] = 1;
		}

		cb(null, this.hits[key], this.resetTime);
	}

	decrement(key: string) {
		if (this.hits[key]) {
			this.hits[key]--;
		}
	}

	resetAll() {
		this.hits = {};
		this.resetTime = calculateNextResetTime(this.windowMs);
	}

	resetKey(key: string) {
		delete this.hits[key];
	}
}
