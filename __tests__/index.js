const axios = require('axios');
const sinon = require('sinon');

const axiosRateLimit = require('../dist');

function delay(milliseconds) {
	return new Promise(resolve => setTimeout(resolve, milliseconds));
}

it('not delay requests less than maxRequests', async () => {
	const maxRequests = 5;
	const perMilliseconds = 1000;
	const totalRequests = 4;
	function adapter(config) {
		return Promise.resolve(config);
	}

	const http = axiosRateLimit(axios.create({ adapter }), { maxRPS: maxRequests });

	const onSuccess = sinon.spy();

	const requests = [];
	const start = Date.now();
	for (let i = 0; i < totalRequests; i++) {
		requests.push(http.get('/users').then(onSuccess));
	}

	await Promise.all(requests);
	const end = Date.now();
	expect(onSuccess.callCount).toEqual(totalRequests);
	expect(end - start).toBeLessThan(perMilliseconds);
});

it('throws an error', async () => {
	const maxRequests = 2;
	const perMilliseconds = 1000;
	function adapter() {
		return Promise.reject(new Error('fail'));
	}

	const http = axiosRateLimit(axios.create({ adapter }), {
		maxRequests,
		perMilliseconds
	});

	expect.assertions(1);
	try {
		await http.get('/users');
	} catch (error) {
		expect(error.message).toEqual('fail');
	}
});

it('support dynamic options', async () => {
	function adapter(config) {
		return Promise.resolve(config);
	}

	// check constructor options
	const http = axiosRateLimit(axios.create({ adapter }), {
		maxRequests: 2,
		perMilliseconds: 100
	});
	expect(http.getMaxRPS()).toEqual(20);

	let onSuccess = sinon.spy();

	let requests = [];
	let start = Date.now();
	for (let i = 0; i < 3; i++) {
		requests.push(http.get('/users').then(onSuccess));
	}
	await delay(90);
	expect(onSuccess.callCount).toEqual(2);

	await Promise.all(requests);
	let end = Date.now();
	expect(onSuccess.callCount).toEqual(3);
	expect(end - start).toBeGreaterThan(100);
	await delay(110);

	// check setRateLimitOptions
	http.setRateLimitOptions({ maxRequests: 3, perMilliseconds: 200 });
	expect(http.getMaxRPS()).toEqual(15);

	onSuccess = sinon.spy();
	requests = [];
	start = Date.now();
	for (let x = 0; x < 4; x++) {
		requests.push(http.get('/users').then(onSuccess));
	}
	await delay(190);
	end = Date.now();
	expect(onSuccess.callCount).toEqual(3);

	await Promise.all(requests);
	end = Date.now();
	expect(onSuccess.callCount).toEqual(4);
	expect(end - start).toBeGreaterThan(200);
	await delay(210);

	// check setMaxRPS
	http.setMaxRPS(3);
	expect(http.getMaxRPS()).toEqual(3);

	onSuccess = sinon.spy();
	requests = [];
	start = Date.now();
	for (let z = 0; z < 4; z++) {
		requests.push(http.get('/users').then(onSuccess));
	}
	await delay(990);
	end = Date.now();
	expect(onSuccess.callCount).toEqual(3);

	await Promise.all(requests);
	end = Date.now();
	expect(onSuccess.callCount).toEqual(4);
	expect(end - start).toBeGreaterThan(1000);
});
