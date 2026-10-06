# Turbot AWS SDK

# Release History

## 5.1.1 [TBD]

- Fixed: `awsIamSignedRequest()` ignored the HTTPS proxy because it sent with Node's built-in `fetch`. It now uses the same proxy settings as `connect()`. To keep it direct while other services use the proxy, add `appsync` to `aws.proxy.disabled`. Network failures now reach the callback as Node's own errors (`ECONNREFUSED`, `ECONNRESET`) rather than `TypeError: fetch failed`. (#37)
- Added: `awsIamSignedRequest()` takes an optional `timeout` in milliseconds, a deadline for the whole request. The default, 300000, matches the 300s `fetch` allowed for headers and for each pause in the body. (#37)
- Updated: `@smithy/node-http-handler` to 4.5.0 and `@smithy/util-retry` to 4.2.12. (#22)

## 5.1.0 [2026-02-27]

- Added: Wildcard proxy patterns, `TURBOT_CONFIG_ENV` support, region fallback, development mode, and exported `CustomRetryStrategy`. (#9)
- Fixed: `_.isEmpty` misuse in `connect()` default parameters. (#14)

## 5.0.1 [2024-12-11]

- Update package version.

## 5.0.0 [2024-12-11]

- Initial version.
