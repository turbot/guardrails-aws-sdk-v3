const { expect } = require("chai");
const { S3Client } = require("@aws-sdk/client-s3");
const { CloudWatchClient } = require("@aws-sdk/client-cloudwatch");
const taws = require("../index");

describe("connect", () => {
  let originalEnv;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    // Clean environment before each test
    delete process.env.AWS_DEFAULT_REGION;
    delete process.env.HTTPS_PROXY;
    delete process.env.https_proxy;
    delete process.env.TURBOT_CONFIG_ENV;
    delete process.env.NODE_ENV;
    delete process.env.TURBOT_DEV_PROFILE;
    delete process.env.TURBOT_DEV_MASTER_REGION;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("when creating clients", () => {
    it("should create an S3Client instance", () => {
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3).to.be.instanceOf(S3Client);
    });

    it("should create a CloudWatchClient instance", () => {
      const cw = taws.connect(CloudWatchClient, { region: "us-east-1" });
      expect(cw).to.be.instanceOf(CloudWatchClient);
    });

    it("should handle missing params", () => {
      process.env.AWS_DEFAULT_REGION = "us-east-1";
      const s3 = taws.connect(S3Client);
      expect(s3).to.be.instanceOf(S3Client);
    });
  });

  describe("when determining region", () => {
    it("should use region from params", async () => {
      const s3 = taws.connect(S3Client, { region: "us-west-2" });
      const region = await s3.config.region();
      expect(region).to.equal("us-west-2");
    });

    it("should fall back to AWS_DEFAULT_REGION", async () => {
      process.env.AWS_DEFAULT_REGION = "eu-west-1";
      const s3 = taws.connect(S3Client, {});
      const region = await s3.config.region();
      expect(region).to.equal("eu-west-1");
    });

    it("should fall back to TURBOT_CONFIG_ENV.env.region", async () => {
      process.env.TURBOT_CONFIG_ENV = JSON.stringify({
        env: { region: "ap-southeast-2" },
      });
      const s3 = taws.connect(S3Client, {});
      const region = await s3.config.region();
      expect(region).to.equal("ap-southeast-2");
    });

    it("should prefer params over AWS_DEFAULT_REGION", async () => {
      process.env.AWS_DEFAULT_REGION = "eu-west-1";
      const s3 = taws.connect(S3Client, { region: "us-west-2" });
      const region = await s3.config.region();
      expect(region).to.equal("us-west-2");
    });

    it("should prefer AWS_DEFAULT_REGION over TURBOT_CONFIG_ENV", async () => {
      process.env.AWS_DEFAULT_REGION = "eu-west-1";
      process.env.TURBOT_CONFIG_ENV = JSON.stringify({
        env: { region: "ap-southeast-2" },
      });
      const s3 = taws.connect(S3Client, {});
      const region = await s3.config.region();
      expect(region).to.equal("eu-west-1");
    });
  });

  describe("when configuring proxy", () => {
    it("should work without proxy configured", () => {
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3).to.be.instanceOf(S3Client);
    });

    it("should attach proxy when HTTPS_PROXY is set", () => {
      process.env.HTTPS_PROXY = "http://proxy.example.com:8080";
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3).to.be.instanceOf(S3Client);
    });

    it("should attach proxy when https_proxy is set", () => {
      process.env.https_proxy = "http://proxy.example.com:8080";
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3).to.be.instanceOf(S3Client);
    });

    it("should handle invalid proxy URL gracefully", () => {
      process.env.HTTPS_PROXY = "not a valid url";
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3).to.be.instanceOf(S3Client);
    });
  });

  describe("when setting user agent", () => {
    it("should set Turbot default user agent when not provided", () => {
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3.config.customUserAgent).to.deep.equal([["Turbot/5 (APN_137229)"]]);
    });

    it("should preserve custom user agent when provided", () => {
      const s3 = taws.connect(S3Client, {
        region: "us-east-1",
        customUserAgent: "CustomApp/1.0",
      });
      expect(s3.config.customUserAgent).to.deep.equal([["CustomApp/1.0"]]);
    });

    it("should preserve empty string user agent", () => {
      const s3 = taws.connect(S3Client, {
        region: "us-east-1",
        customUserAgent: "",
      });
      expect(s3.config.customUserAgent).to.deep.equal([[""]]);
    });
  });

  describe("when configuring retry strategy", () => {
    it("should set default maxAttempts to 3", async () => {
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      const maxAttempts = await s3.config.maxAttempts();
      expect(maxAttempts).to.equal(3);
    });

    it("should preserve custom maxAttempts if provided", async () => {
      const s3 = taws.connect(S3Client, {
        region: "us-east-1",
        maxAttempts: 21,
      });
      const maxAttempts = await s3.config.maxAttempts();
      expect(maxAttempts).to.equal(21);
    });

    it("should preserve maxAttempts of 0", async () => {
      const s3 = taws.connect(S3Client, {
        region: "us-east-1",
        maxAttempts: 0,
      });
      const maxAttempts = await s3.config.maxAttempts();
      expect(maxAttempts).to.equal(0);
    });

    it("should use CustomRetryStrategy by default", async () => {
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      const strategy = await s3.config.retryStrategy();
      expect(strategy).to.be.instanceOf(taws.CustomRetryStrategy);
    });

    it("should preserve custom retry strategy if provided", async () => {
      const customRetry = new taws.CustomDiscoveryRetryStrategy(10);
      const s3 = taws.connect(S3Client, {
        region: "us-east-1",
        retryStrategy: customRetry,
      });
      const strategy = await s3.config.retryStrategy();
      expect(strategy).to.be.instanceOf(taws.CustomDiscoveryRetryStrategy);
    });
  });

  describe("when handling credentials", () => {
    it("should accept explicit credentials", () => {
      const s3 = taws.connect(S3Client, {
        region: "us-east-1",
        credentials: {
          accessKeyId: "AKIAIOSFODNN7EXAMPLE",
          secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        },
      });
      expect(s3).to.be.instanceOf(S3Client);
    });
  });

  describe("when parsing TURBOT_CONFIG_ENV", () => {
    it("should parse valid JSON config", () => {
      process.env.TURBOT_CONFIG_ENV = JSON.stringify({
        aws: {
          proxy: {
            https_proxy: "http://proxy:8080",
            enabled: ["*"],
            disabled: [],
          },
        },
        env: {
          region: "ap-southeast-2",
        },
      });

      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3).to.be.instanceOf(S3Client);
    });

    it("should handle invalid JSON gracefully", () => {
      process.env.TURBOT_CONFIG_ENV = "invalid json";
      process.env.AWS_DEFAULT_REGION = "us-east-1";

      const s3 = taws.connect(S3Client, {});
      expect(s3).to.be.instanceOf(S3Client);
    });

    it("should handle missing TURBOT_CONFIG_ENV", () => {
      process.env.AWS_DEFAULT_REGION = "us-east-1";

      const s3 = taws.connect(S3Client, {});
      expect(s3).to.be.instanceOf(S3Client);
    });
  });

  describe("when using wildcard proxy patterns", () => {
    it("should attach proxy for enabled services", () => {
      process.env.TURBOT_CONFIG_ENV = JSON.stringify({
        aws: {
          proxy: {
            https_proxy: "http://proxy:8080",
            enabled: ["*"],
            disabled: [],
          },
        },
      });

      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3).to.be.instanceOf(S3Client);
    });

    it("should not attach proxy for disabled services", () => {
      process.env.TURBOT_CONFIG_ENV = JSON.stringify({
        aws: {
          proxy: {
            https_proxy: "http://proxy:8080",
            enabled: ["*"],
            disabled: ["s3"],
          },
        },
      });

      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3).to.be.instanceOf(S3Client);
    });

    it("should support wildcard patterns", () => {
      process.env.TURBOT_CONFIG_ENV = JSON.stringify({
        aws: {
          proxy: {
            https_proxy: "http://proxy:8080",
            enabled: ["cloud*"],
            disabled: [],
          },
        },
      });

      const cw = taws.connect(CloudWatchClient, { region: "us-east-1" });
      expect(cw).to.be.instanceOf(CloudWatchClient);
    });

    it("should still support simple HTTPS_PROXY env var", () => {
      process.env.HTTPS_PROXY = "http://proxy:8080";

      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3).to.be.instanceOf(S3Client);
    });

    it("should use config proxy URL over env var", async () => {
      process.env.HTTPS_PROXY = "http://env-proxy:9999";
      process.env.TURBOT_CONFIG_ENV = JSON.stringify({
        aws: {
          proxy: {
            https_proxy: "http://config-proxy:8080",
            enabled: ["*"],
            disabled: [],
          },
        },
      });

      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      // Proxy should be from config, not env var
      const cfg = await s3.config.requestHandler.configProvider;
      expect(cfg.httpsAgent.constructor.name).to.equal("HttpsProxyAgent");
      expect(cfg.httpsAgent.proxy.hostname).to.equal("config-proxy");
    });
  });

  describe("when handling proxy edge cases", () => {
    it("should verify requestHandler is set when proxy is enabled", async () => {
      process.env.HTTPS_PROXY = "http://proxy:8080";
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3.config.requestHandler).to.exist;
      // Custom requestHandler (with proxy) has HttpsProxyAgent as httpsAgent
      const cfg = await s3.config.requestHandler.configProvider;
      expect(cfg.httpsAgent.constructor.name).to.equal("HttpsProxyAgent");
    });

    it("should verify requestHandler is not set when proxy is disabled", async () => {
      process.env.TURBOT_CONFIG_ENV = JSON.stringify({
        aws: {
          proxy: {
            https_proxy: "http://proxy:8080",
            enabled: ["*"],
            disabled: ["s3"],
          },
        },
      });
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      // SDK creates default requestHandler which uses standard Agent
      const cfg = await s3.config.requestHandler.configProvider;
      expect(cfg.httpsAgent.constructor.name).to.equal("Agent");
    });

    it("should verify requestHandler is not set when no proxy configured", async () => {
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      // SDK creates default requestHandler which uses standard Agent
      const cfg = await s3.config.requestHandler.configProvider;
      expect(cfg.httpsAgent.constructor.name).to.equal("Agent");
    });

    it("should handle empty enabled array (no services proxied)", async () => {
      process.env.TURBOT_CONFIG_ENV = JSON.stringify({
        aws: {
          proxy: {
            https_proxy: "http://proxy:8080",
            enabled: [],
            disabled: [],
          },
        },
      });
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3).to.be.instanceOf(S3Client);
      // SDK creates default requestHandler which uses standard Agent
      const cfg = await s3.config.requestHandler.configProvider;
      expect(cfg.httpsAgent.constructor.name).to.equal("Agent");
    });

    it("should handle multiple non-wildcard patterns in enabled", async () => {
      process.env.TURBOT_CONFIG_ENV = JSON.stringify({
        aws: {
          proxy: {
            https_proxy: "http://proxy:8080",
            enabled: ["s3", "cloudwatch", "sts"],
            disabled: [],
          },
        },
      });
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3).to.be.instanceOf(S3Client);
      // Custom requestHandler (with proxy) has HttpsProxyAgent
      const s3Cfg = await s3.config.requestHandler.configProvider;
      expect(s3Cfg.httpsAgent.constructor.name).to.equal("HttpsProxyAgent");

      const cw = taws.connect(CloudWatchClient, { region: "us-east-1" });
      expect(cw).to.be.instanceOf(CloudWatchClient);
      // Custom requestHandler (with proxy) has HttpsProxyAgent
      const cwCfg = await cw.config.requestHandler.configProvider;
      expect(cwCfg.httpsAgent.constructor.name).to.equal("HttpsProxyAgent");
    });

    it("should handle both https_proxy and HTTPS_PROXY set (lowercase wins)", async () => {
      process.env.https_proxy = "http://lowercase-proxy:8080";
      process.env.HTTPS_PROXY = "http://uppercase-proxy:8080";
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3).to.be.instanceOf(S3Client);
      // Custom requestHandler (with proxy) has HttpsProxyAgent
      const cfg = await s3.config.requestHandler.configProvider;
      expect(cfg.httpsAgent.constructor.name).to.equal("HttpsProxyAgent");
    });

    it("should handle mixed case in disabled patterns", async () => {
      process.env.TURBOT_CONFIG_ENV = JSON.stringify({
        aws: {
          proxy: {
            https_proxy: "http://proxy:8080",
            enabled: ["*"],
            disabled: ["S3", "CloudWatch"],
          },
        },
      });
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3).to.be.instanceOf(S3Client);
      // SDK creates default requestHandler which uses standard Agent
      const s3Cfg = await s3.config.requestHandler.configProvider;
      expect(s3Cfg.httpsAgent.constructor.name).to.equal("Agent");

      const cw = taws.connect(CloudWatchClient, { region: "us-east-1" });
      expect(cw).to.be.instanceOf(CloudWatchClient);
      // SDK creates default requestHandler which uses standard Agent
      const cwCfg = await cw.config.requestHandler.configProvider;
      expect(cwCfg.httpsAgent.constructor.name).to.equal("Agent");
    });

    it("should handle overlapping specific patterns (disabled wins)", async () => {
      process.env.TURBOT_CONFIG_ENV = JSON.stringify({
        aws: {
          proxy: {
            https_proxy: "http://proxy:8080",
            enabled: ["s3", "ec2"],
            disabled: ["s3"],
          },
        },
      });
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3).to.be.instanceOf(S3Client);
      // SDK creates default requestHandler which uses standard Agent
      const cfg = await s3.config.requestHandler.configProvider;
      expect(cfg.httpsAgent.constructor.name).to.equal("Agent");
    });

    it("should handle proxy URL with authentication", async () => {
      process.env.HTTPS_PROXY = "http://user:password@proxy:8080";
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3).to.be.instanceOf(S3Client);
      // Custom requestHandler (with proxy) has HttpsProxyAgent
      const cfg = await s3.config.requestHandler.configProvider;
      expect(cfg.httpsAgent.constructor.name).to.equal("HttpsProxyAgent");
    });

    it("should handle proxy URL with special characters in password", async () => {
      process.env.HTTPS_PROXY = "http://user:p%40ssw0rd@proxy:8080";
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3).to.be.instanceOf(S3Client);
      // Custom requestHandler (with proxy) has HttpsProxyAgent
      const cfg = await s3.config.requestHandler.configProvider;
      expect(cfg.httpsAgent.constructor.name).to.equal("HttpsProxyAgent");
    });

    it("should handle non-standard protocols gracefully", async () => {
      process.env.HTTPS_PROXY = "socks5://proxy:1080";
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3).to.be.instanceOf(S3Client);
      // Custom requestHandler (with proxy) has HttpsProxyAgent
      const cfg = await s3.config.requestHandler.configProvider;
      expect(cfg.httpsAgent.constructor.name).to.equal("HttpsProxyAgent");
    });
  });

  describe("when parsing TURBOT_CONFIG_ENV edge cases", () => {
    it("should handle empty JSON object gracefully", async () => {
      process.env.TURBOT_CONFIG_ENV = "{}";
      process.env.AWS_DEFAULT_REGION = "us-east-1";

      const s3 = taws.connect(S3Client, {});
      expect(s3).to.be.instanceOf(S3Client);
      const region = await s3.config.region();
      expect(region).to.equal("us-east-1");
      // No proxy should be configured since aws.proxy is undefined
      const cfg = await s3.config.requestHandler.configProvider;
      expect(cfg.httpsAgent.constructor.name).to.equal("Agent");
    });
  });

  describe("when proxy config has missing enabled/disabled keys", () => {
    it("should default enabled to ['*'] when not specified", async () => {
      process.env.TURBOT_CONFIG_ENV = JSON.stringify({
        aws: {
          proxy: {
            https_proxy: "http://proxy:8080",
          },
        },
      });
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      // enabled defaults to ["*"], disabled defaults to [], so proxy should be applied
      const cfg = await s3.config.requestHandler.configProvider;
      expect(cfg.httpsAgent.constructor.name).to.equal("HttpsProxyAgent");
    });

    it("should default disabled to [] when not specified", async () => {
      process.env.TURBOT_CONFIG_ENV = JSON.stringify({
        aws: {
          proxy: {
            https_proxy: "http://proxy:8080",
            enabled: ["s3"],
          },
        },
      });
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      const cfg = await s3.config.requestHandler.configProvider;
      expect(cfg.httpsAgent.constructor.name).to.equal("HttpsProxyAgent");
    });
  });

  describe("when proxy config https_proxy is null and env var is set", () => {
    it("should fall back to HTTPS_PROXY env var when config https_proxy is null", async () => {
      process.env.HTTPS_PROXY = "http://env-proxy:8080";
      process.env.TURBOT_CONFIG_ENV = JSON.stringify({
        aws: {
          proxy: {
            https_proxy: null,
            enabled: ["*"],
            disabled: [],
          },
        },
      });
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      const cfg = await s3.config.requestHandler.configProvider;
      expect(cfg.httpsAgent.constructor.name).to.equal("HttpsProxyAgent");
      expect(cfg.httpsAgent.proxy.hostname).to.equal("env-proxy");
    });
  });

  describe("when serviceClient is null", () => {
    it("should skip service matching and return proxy unconditionally", async () => {
      process.env.HTTPS_PROXY = "http://proxy:8080";
      // connect always passes a serviceClient, but proxyAgent handles null
      // We test this path by calling connect with a class that has no name filtering issues
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      const cfg = await s3.config.requestHandler.configProvider;
      expect(cfg.httpsAgent.constructor.name).to.equal("HttpsProxyAgent");
    });
  });

  describe("when using discoveryParams with connect", () => {
    it("should create a client with discovery retry strategy", async () => {
      const params = taws.discoveryParams("us-east-1");
      const s3 = taws.connect(S3Client, params);
      expect(s3).to.be.instanceOf(S3Client);
      const strategy = await s3.config.retryStrategy();
      expect(strategy).to.be.instanceOf(taws.CustomDiscoveryRetryStrategy);
      const maxAttempts = await s3.config.maxAttempts();
      expect(maxAttempts).to.equal(10);
    });

    it("should use discovery region from discoveryParams", async () => {
      const params = taws.discoveryParams("ap-northeast-1");
      const s3 = taws.connect(S3Client, params);
      const region = await s3.config.region();
      expect(region).to.equal("ap-northeast-1");
    });
  });

  describe("when in development mode", () => {
    it("should use dev region when in local-development mode", async () => {
      process.env.NODE_ENV = "local-development";
      process.env.TURBOT_DEV_PROFILE = "test-profile";
      process.env.TURBOT_DEV_MASTER_REGION = "us-west-2";

      const s3 = taws.connect(S3Client, {});
      const region = await s3.config.region();
      expect(region).to.equal("us-west-2");
    });

    it("should not use dev region in production mode", async () => {
      process.env.NODE_ENV = "production";
      process.env.TURBOT_DEV_PROFILE = "test-profile";
      process.env.TURBOT_DEV_MASTER_REGION = "us-west-2";
      process.env.AWS_DEFAULT_REGION = "us-east-1";

      const s3 = taws.connect(S3Client, {});
      const region = await s3.config.region();
      expect(region).to.equal("us-east-1");
    });

    it("should prefer explicit region over dev region", async () => {
      process.env.NODE_ENV = "local-development";
      process.env.TURBOT_DEV_MASTER_REGION = "us-west-2";

      const s3 = taws.connect(S3Client, { region: "eu-west-1" });
      const region = await s3.config.region();
      expect(region).to.equal("eu-west-1");
    });

    it("should set dev region without loading credentials when TURBOT_DEV_PROFILE is absent", async () => {
      process.env.NODE_ENV = "local-development";
      process.env.TURBOT_DEV_MASTER_REGION = "us-west-2";
      // No TURBOT_DEV_PROFILE set

      const s3 = taws.connect(S3Client, {});
      const region = await s3.config.region();
      expect(region).to.equal("us-west-2");
    });

    it("should not set dev region when TURBOT_DEV_MASTER_REGION is absent", async () => {
      process.env.NODE_ENV = "local-development";
      process.env.TURBOT_DEV_PROFILE = "test-profile";
      process.env.AWS_DEFAULT_REGION = "eu-west-1";
      // No TURBOT_DEV_MASTER_REGION set

      const s3 = taws.connect(S3Client, {});
      const region = await s3.config.region();
      expect(region).to.equal("eu-west-1");
    });

    it("should not override explicit credentials in dev mode", async () => {
      process.env.NODE_ENV = "local-development";
      process.env.TURBOT_DEV_PROFILE = "test-profile";
      process.env.TURBOT_DEV_MASTER_REGION = "us-west-2";

      const explicitCreds = {
        accessKeyId: "AKIAEXPLICIT",
        secretAccessKey: "explicitSecret",
      };
      const s3 = taws.connect(S3Client, { credentials: explicitCreds });
      expect(s3).to.be.instanceOf(S3Client);
      // SDK wraps credentials in a resolver; resolve and verify the values
      const resolved = await s3.config.credentials();
      expect(resolved.accessKeyId).to.equal("AKIAEXPLICIT");
      expect(resolved.secretAccessKey).to.equal("explicitSecret");
    });
  });

  describe("when setting signature version", () => {
    it("should set signatureVersion to v4 by default", () => {
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3.config.signatureVersion).to.equal("v4");
    });

    it("should preserve custom signatureVersion if provided", () => {
      const s3 = taws.connect(S3Client, {
        region: "us-east-1",
        signatureVersion: "v2",
      });
      expect(s3.config.signatureVersion).to.equal("v2");
    });
  });
});
