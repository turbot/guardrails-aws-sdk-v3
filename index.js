// Use CommonJS 'require' instead of 'import'

const errors = require("@turbot/errors");
const log = require("@turbot/log");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { NodeHttpHandler } = require("@smithy/node-http-handler");
const { StandardRetryStrategy } = require("@smithy/util-retry");
const aws4 = require("aws4");
const micromatch = require("micromatch");

const defaultMaxRetries = 3;

const proxyAgent = (serviceClient, turbotConfig) => {
  // Get the proxy configuration from the provided turbotConfig
  // Clone the proxy configuration to avoid mutating the original
  let awsProxy = turbotConfig?.aws?.proxy ? JSON.parse(JSON.stringify(turbotConfig.aws.proxy)) : {};

  // Set defaults
  if (awsProxy.https_proxy == null) {
    awsProxy.https_proxy = process.env.https_proxy || process.env.HTTPS_PROXY;
  }
  if (awsProxy.enabled == null) {
    awsProxy.enabled = ["*"];
  }
  if (awsProxy.disabled == null) {
    awsProxy.disabled = [];
  }

  const proxy = awsProxy.https_proxy;

  // If there is no proxy defined, we have nothing to do.
  if (!proxy) {
    return null;
  }

  // Check if this service should use the proxy
  if (serviceClient) {
    const serviceName = serviceClient.name.replace(/Client$/, "").toLowerCase();
    const serviceLower = serviceName.toLowerCase();

    // Check if service is explicitly disabled
    const disabledServices = awsProxy.disabled.map((i) => i.toLowerCase());
    if (micromatch.any(serviceLower, disabledServices)) {
      return null;
    }

    // Check if service is enabled (must match at least one pattern)
    const enabledServices = awsProxy.enabled.map((i) => i.toLowerCase());
    if (!micromatch.any(serviceLower, enabledServices)) {
      return null;
    }
  }

  let proxyObj;
  try {
    proxyObj = new URL(proxy);
  } catch (e) {
    // Do not throw an error here. That would cause all connection attempts to
    // AWS to fail at scale, leaving Turbot inoperable.
    // Instead, log the error and continue with no proxy. That may not work
    // either, but is better than a bad configuration locking us out completely.
    log.error(errors.badConfiguration("Invalid URL configuration in aws.proxy.https_proxy", { error: e }));
    return null;
  }

  const agent = new HttpsProxyAgent(proxyObj.href);

  return agent;
};

const connect = function (serviceClient, params) {
  if (!params) {
    params = {};
  }

  // Parse TURBOT_CONFIG_ENV
  let turbotConfig = {};
  if (process.env.TURBOT_CONFIG_ENV) {
    try {
      turbotConfig = JSON.parse(process.env.TURBOT_CONFIG_ENV);
    } catch (e) {
      log.error(errors.badConfiguration("Error parsing TURBOT_CONFIG_ENV", { error: e }));
      turbotConfig = {};
    }
  }

  // Development mode: load credentials from profile
  if (process.env.NODE_ENV === "local-development") {
    if (process.env.TURBOT_DEV_PROFILE && !params.credentials) {
      const { fromIni } = require("@aws-sdk/credential-providers");
      params.credentials = fromIni({ profile: process.env.TURBOT_DEV_PROFILE });
    }
    if (process.env.TURBOT_DEV_MASTER_REGION && !params.region) {
      params.region = process.env.TURBOT_DEV_MASTER_REGION;
    }
  }

  // If running in Lambda setup, set the default region based on the:
  // https://docs.aws.amazon.com/lambda/latest/dg/current-supported-versions.html
  // Precedence: params.region > AWS_DEFAULT_REGION > turbotConfig.env.region
  if (!params.region) {
    params.region = process.env.AWS_DEFAULT_REGION || turbotConfig?.env?.region;
  }

  // If they have a proxy, configure the agent.
  let proxy = proxyAgent(serviceClient, turbotConfig);
  if (proxy) {
    params.requestHandler = new NodeHttpHandler({
      httpsAgent: proxy, // Attach the proxy agent to the request handler
    });
  }

  // AWS SDK v3 uses Signature Version 4 (SigV4) for securely signing all API requests.
  // SigV4 ensures that requests are authenticated and authorized using access keys or assumed roles.
  // https://stackoverflow.com/questions/71791321/specifying-the-signature-version-of-s3-client-in-aws-sdk-version-3
  if (!params.signatureVersion) {
    params.signatureVersion = "v4";
  }

  if (params.customUserAgent == null) {
    params.customUserAgent = "Turbot/5 (APN_137229)";
  }

  if (params.maxAttempts == null) {
    params.maxAttempts = defaultMaxRetries;
  }

  if (params.retryStrategy == null) {
    params.retryStrategy = new CustomRetryStrategy(params.maxAttempts);
  }

  return new serviceClient(params);
};

const defaultCustomBackoff = (retryCount) => {
  // The standard AWS algorithm does up to 3 retries with exponential backoff. But,
  // the actual delay is random between 0 and the calculated backoff number. So,
  // in reality the delays are:
  //   0. First attempt, immediate.
  //   1. First retry, after a delay of between 0 and 100ms.
  //   2. Second retry, after a delay of between 0 and 200ms.
  //   3. Final retry, after a delay of between 0 and 400ms.
  //
  // Our approach uses 1 second base and similar 3 retries
  // delay is within +/- 10% of the calculated delay (not 0 to 100% of it):
  //   0. First attempt, immediate.
  //   1. First retry, after a delay of between 900 and 1100ms.
  //   2. Second retry, after a delay of between 1800 and 2200ms.
  //   3. Third retry, after a delay of between 3600 and 4400ms.
  //
  // That's it, unlike discovery that has 10 retries, the default backoff should be just
  // the 3 retries
  //
  const total = Math.pow(2, retryCount) * 1000;
  const base = total * 0.9;
  const variation = total * 0.2 * Math.random();
  const result = base + variation;
  return result;
};

// Create a custom retry strategy by extending the StandardRetryStrategy
// Custom retry strategy using the `StandardRetryStrategy`
class CustomRetryStrategy extends StandardRetryStrategy {
  constructor(maxAttempts) {
    super(async () => maxAttempts);
  }

  // Override the `delayDecider` method to use the custom backoff function
  delayDecider(_delayBase, attemptCount) {
    return defaultCustomBackoff(attemptCount); // Use the custom backoff logic
  }
}

const customBackoffForDiscovery = (retryCount) => {
  //
  // For discovery - very expensive to fail after the middle of the page, we
  // want to be very conservative, ergo max retries of 10
  //
  // The standard AWS algorithm does up to 3 retries with exponential backoff. But,
  // the actual delay is random between 0 and the calculated backoff number. So,
  // in reality the delays are:
  //   0. First attempt, immediate.
  //   1. First retry, after a delay of between 0 and 100ms.
  //   2. Second retry, after a delay of between 0 and 200ms.
  //   3. Final retry, after a delay of between 0 and 400ms.
  //
  // We need a more reliable backoff, with a very large delay by the end to try
  // and ensure we can get all of the items even for services with very low
  // throttling rates.
  //
  // Our approach uses the same base (100ms), but does 10 retries and ensures the
  // delay is within +/- 10% of the calculated delay (not 0 to 100% of it):
  //   0. First attempt, immediate.
  //   1. First retry, after a delay of between 90 and 110ms.
  //   2. Second retry, after a delay of between 180 and 220ms.
  //   3. Third retry, after a delay of between 360 and 440ms.
  //   ...
  //   10. Tenth retry, after a delay of between 92160 and 112640ms.
  const total = Math.pow(2, retryCount) * 100;
  const base = total * 0.9;
  const variation = total * 0.2 * Math.random();
  const result = base + variation;
  return result;
};

// Create a custom retry strategy by extending the StandardRetryStrategy
// Custom retry strategy using the `StandardRetryStrategy`
class CustomDiscoveryRetryStrategy extends StandardRetryStrategy {
  constructor(maxAttempts) {
    super(async () => maxAttempts);
  }

  // Override the `delayDecider` method to use the custom backoff function
  delayDecider(_delayBase, attemptCount) {
    return customBackoffForDiscovery(attemptCount); // Use the custom backoff logic
  }
}

const defaultMaxRetriesForDiscovery = 10;

const discoveryParams = (region) => {
  return {
    region: region,
    maxAttempts: defaultMaxRetriesForDiscovery,
    retryStrategy: new CustomDiscoveryRetryStrategy(defaultMaxRetriesForDiscovery),
  };
};

const awsIamSignedRequest = (opts, service, credentials, callback) => {
  const awsOptions = {
    aws: {
      key: credentials.AccessKeyId,
      secret: credentials.SecretAccessKey,
      session: credentials.SessionToken,
      service,
      sign_version: "4",
    },
  };

  // Parse the URL to get the hostname and path
  const url = new URL(opts.uri);
  const hostname = url.hostname;
  const path = url.pathname + url.search;

  const requestOptions = {
    host: hostname,
    path: path,
    method: opts.method,
    headers: {
      ...opts.headers,
      host: new URL(opts.uri).hostname.toString(),
    },
    body: opts.body ? JSON.stringify(opts.body) : null,
    service: service,
  };

  aws4.sign(requestOptions, {
    accessKeyId: awsOptions.aws.key,
    secretAccessKey: awsOptions.aws.secret,
    sessionToken: awsOptions.aws.session,
  });

  fetch(opts.uri, {
    method: requestOptions.method,
    headers: requestOptions.headers,
    body: requestOptions.body,
  })
    .then((response) => response.json())
    .then((body) => {
      callback(null, body);
    })
    .catch((error) => {
      callback(error);
    });
};

module.exports = {
  awsIamSignedRequest,
  connect,
  customBackoff: customBackoffForDiscovery,
  discoveryParams,
  CustomRetryStrategy,
  CustomDiscoveryRetryStrategy,
};
