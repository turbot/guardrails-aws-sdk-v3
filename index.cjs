// CommonJS wrapper for backwards compatibility
// This file allows CommonJS consumers to use: const taws = require("@turbot/guardrails-aws-sdk-v3")

const _ = require("lodash");
const errors = require("@turbot/errors");
const log = require("@turbot/log");
const { HttpsProxyAgent } = require("https-proxy-agent");
const { NodeHttpHandler } = require("@aws-sdk/node-http-handler");
const { StandardRetryStrategy } = require("@aws-sdk/util-retry");
const { URL } = require("url");
const aws4 = require("aws4");
const micromatch = require("micromatch");

const defaultMaxRetries = 3;

const proxyAgent = (serviceClient, turbotConfig) => {
  let awsProxy = turbotConfig?.aws?.proxy ? _.cloneDeep(turbotConfig.aws.proxy) : {};

  _.defaults(awsProxy, {
    https_proxy: process.env.https_proxy || process.env.HTTPS_PROXY,
    enabled: ["*"],
    disabled: [],
  });

  const proxy = awsProxy.https_proxy;

  if (!proxy) {
    return null;
  }

  if (serviceClient) {
    const serviceName = serviceClient.name.replace(/Client$/, "").toLowerCase();
    const serviceLower = serviceName.toLowerCase();

    const disabledServices = awsProxy.disabled.map((i) => i.toLowerCase());
    if (micromatch.any(serviceLower, disabledServices)) {
      return null;
    }

    const enabledServices = awsProxy.enabled.map((i) => i.toLowerCase());
    if (!micromatch.any(serviceLower, enabledServices)) {
      return null;
    }
  }

  let proxyObj;
  try {
    proxyObj = new URL(proxy);
  } catch (e) {
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

  let turbotConfig = {};
  if (process.env.TURBOT_CONFIG_ENV) {
    try {
      turbotConfig = JSON.parse(process.env.TURBOT_CONFIG_ENV);
    } catch (e) {
      log.error(errors.badConfiguration("Error parsing TURBOT_CONFIG_ENV", { error: e }));
      turbotConfig = {};
    }
  }

  if (process.env.NODE_ENV === "local-development") {
    if (process.env.TURBOT_DEV_PROFILE && !params.credentials) {
      const { fromIni } = require("@aws-sdk/credential-providers");
      params.credentials = fromIni({ profile: process.env.TURBOT_DEV_PROFILE });
    }
    if (process.env.TURBOT_DEV_MASTER_REGION && !params.region) {
      params.region = process.env.TURBOT_DEV_MASTER_REGION;
    }
  }

  if (!params.region) {
    params.region = process.env.AWS_DEFAULT_REGION || turbotConfig?.env?.region;
  }

  let proxy = proxyAgent(serviceClient, turbotConfig);
  if (proxy) {
    params.requestHandler = new NodeHttpHandler({
      httpsAgent: proxy,
    });
  }

  if (!params.signatureVersion) {
    params.signatureVersion = "v4";
  }

  if (!_.isEmpty(params.customUserAgent)) {
    params.customUserAgent = "Turbot/5 (APN_137229)";
  }

  if (_.isEmpty(params.maxAttempts)) {
    params.maxAttempts = defaultMaxRetries;
  }

  if (_.isEmpty(params.retryStrategy)) {
    params.retryStrategy = new CustomRetryStrategy(params.maxAttempts || defaultMaxRetries);
  }

  return new serviceClient(params);
};

const defaultCustomBackoff = (retryCount) => {
  const total = Math.pow(2, retryCount) * 1000;
  const base = total * 0.9;
  const variation = total * 0.2 * Math.random();
  const result = base + variation;
  return result;
};

class CustomRetryStrategy extends StandardRetryStrategy {
  constructor(maxAttempts) {
    super(async () => maxAttempts);
  }

  delayDecider(_delayBase, attemptCount) {
    return defaultCustomBackoff(attemptCount);
  }
}

const customBackoffForDiscovery = (retryCount) => {
  const total = Math.pow(2, retryCount) * 100;
  const base = total * 0.9;
  const variation = total * 0.2 * Math.random();
  const result = base + variation;
  return result;
};

class CustomDiscoveryRetryStrategy extends StandardRetryStrategy {
  constructor(maxAttempts) {
    super(async () => maxAttempts);
  }

  delayDecider(_delayBase, attemptCount) {
    return customBackoffForDiscovery(attemptCount);
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
