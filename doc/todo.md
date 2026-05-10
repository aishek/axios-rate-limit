# TODO items

[x] improve README.md by describing in details all of the options, do not rely on "people will read the source code" because they don't
[x] improve AGENTS.md, use https://github.com/rails/rails/pull/55991/changes as an inspiration
[x] provide in example in doc/use-case-...-something.md for changing RPS on the fly, I believe it is possible, need a clear example how to achieve that, see https://github.com/aishek/axios-rate-limit/issues/48
[x] add some kind of callback to support X-RateLimit headers, and provide the use case for it's usage, see https://github.com/aishek/axios-rate-limit/issues/77
[ ] example https://github.com/aishek/axios-rate-limit/issues/26 and find the core concept that allow to have common rps limit in distributed env, I beleive it's some kind of async storage for current state of limits, implement something similar and the use case inside the lib
[ ] upgrade tooling to `npm ci` will not provide so many warnings
