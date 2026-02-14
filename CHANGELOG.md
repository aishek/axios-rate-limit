# Change Log
This project adheres to [Semantic Versioning](http://semver.org/).

## Unreleased
* Add "Typical use cases" section in README with links to doc files: single rate limit (`limits` with one entry; note deprecated top-level params), multiple rate limits, custom queue (e.g. logging add/remove).

## 1.6.1
* Support cancellation via `config.signal` (AbortController) so aborted requests no longer consume a rate-limit slot.

## 1.6.0
* Add `queue` option in case you will need to replace built-in array-based requests queue with any compatible object (see https://github.com/aishek/axios-rate-limit/issues/37). Please note that there is no validation for the option value. You have to implement push, shift methods and length property.

## 1.5.0
* Multiple rate limits via optional `limits` array (see https://github.com/aishek/axios-rate-limit/issues/55). Each entry is `{ maxRequests, duration }`; `duration` is a string with numeric value + unit: `ms`, `s`, `m`, `h` (e.g. `'1s'`, `'2m'`). A request is sent only when every window allows one more; each window resets independently after its time. Invalid `duration` throws with a message hinting at valid formats.
* Backward compatibility: if `limits` is not provided, behavior is unchanged (single limit via `maxRequests` + `perMilliseconds` or `maxRPS`). Legacy options `perMilliseconds`, `maxRPS` and existing single-limit API remain supported; `getMaxRPS` / `setMaxRPS` / `setRateLimitOptions` work as before in that mode.

## 1.4.0
* Expose requests queue via getQueue (see https://github.com/aishek/axios-rate-limit/pull/62)

## 1.3.3
* Fix axios dependency specification

## 1.3.2
* Fixed TypeScript typings (see https://github.com/aishek/axios-rate-limit/pull/34)

## 1.3.1
* Fixed cancelled requests behaviour, now they does not affect rate limiting (see https://github.com/aishek/axios-rate-limit/pull/50)

## 1.3.0
* Add TypeScript typings (see https://github.com/aishek/axios-rate-limit/pull/23)
* Upgrade handlebars to 4.5.3
* Upgrade acorn to 5.7.4
* Upgrade lodash to 4.17.19

## 1.2.1
* Fix TypeScript imports (see https://github.com/aishek/axios-rate-limit/pull/19/files)

## 1.2.0
* Add maxRPS options, getMaxRPS, setMaxRPS, setRateLimitOptions methods

## 1.1.3
* Fixed ref/unref timeout behaviour for NodeJS (see https://github.com/aishek/axios-rate-limit/issues/16)

## 1.1.2
* Fixed NodeJS delayed shutdown (see https://github.com/aishek/axios-rate-limit/pull/13/files)

## 1.1.1
* Fixed TypeScript typings bundle (see https://github.com/aishek/axios-rate-limit/pull/12/files)

## 1.1.0
* Added TypeScript typings (see https://github.com/aishek/axios-rate-limit/pull/9)

## 1.0.1
* Updated internals (see https://github.com/aishek/axios-rate-limit/pull/5, https://github.com/aishek/axios-rate-limit/pull/7, https://github.com/aishek/axios-rate-limit/pull/8)

## 1.0.0
* Changed exports to classic NodeJS modules (see https://github.com/aishek/axios-rate-limit/issues/3)

## 0.0.4
* Add errors re-throw by @mcuppi (see https://github.com/aishek/axios-rate-limit/issues/1)

## 0.0.3
* Add jsdoc.

## 0.0.2
* Fix default import.

## 0.0.1
* Initial release.
