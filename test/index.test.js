const { expect } = require("chai");
const { StandardRetryStrategy } = require("@aws-sdk/util-retry");

const {
  connect,
  discoveryParams,
  customBackoff,
  CustomDiscoveryRetryStrategy,
} = require("../index");

// Mock AWS SDK client for testing
class MockServiceClient {
  constructor(params) {
    this.params = params;
  }
}

describe("guardrails-aws-sdk-v3", function () {
  describe("connect", function () {
    const originalEnv = {};

    beforeEach(function () {
      // Save original env vars
      originalEnv.AWS_DEFAULT_REGION = process.env.AWS_DEFAULT_REGION;
      originalEnv.https_proxy = process.env.https_proxy;
      originalEnv.HTTPS_PROXY = process.env.HTTPS_PROXY;

      // Clear env vars for clean tests
      delete process.env.AWS_DEFAULT_REGION;
      delete process.env.https_proxy;
      delete process.env.HTTPS_PROXY;
    });

    afterEach(function () {
      // Restore original env vars
      if (originalEnv.AWS_DEFAULT_REGION !== undefined) {
        process.env.AWS_DEFAULT_REGION = originalEnv.AWS_DEFAULT_REGION;
      } else {
        delete process.env.AWS_DEFAULT_REGION;
      }
      if (originalEnv.https_proxy !== undefined) {
        process.env.https_proxy = originalEnv.https_proxy;
      } else {
        delete process.env.https_proxy;
      }
      if (originalEnv.HTTPS_PROXY !== undefined) {
        process.env.HTTPS_PROXY = originalEnv.HTTPS_PROXY;
      } else {
        delete process.env.HTTPS_PROXY;
      }
    });

    it("should create a client instance", function () {
      const client = connect(MockServiceClient, { region: "us-east-1" });
      expect(client).to.be.instanceOf(MockServiceClient);
    });

    it("should set default customUserAgent when not provided", function () {
      const client = connect(MockServiceClient, { region: "us-east-1" });
      expect(client.params.customUserAgent).to.equal("Turbot/5 (APN_137229)");
    });

    it("should preserve customUserAgent when provided", function () {
      const client = connect(MockServiceClient, {
        region: "us-east-1",
        customUserAgent: "CustomAgent/1.0",
      });
      expect(client.params.customUserAgent).to.equal("CustomAgent/1.0");
    });

    it("should set default maxAttempts to 3 when not provided", function () {
      const client = connect(MockServiceClient, { region: "us-east-1" });
      expect(client.params.maxAttempts).to.equal(3);
    });

    it("should preserve maxAttempts when provided", function () {
      const client = connect(MockServiceClient, {
        region: "us-east-1",
        maxAttempts: 5,
      });
      expect(client.params.maxAttempts).to.equal(5);
    });

    it("should set default retryStrategy when not provided", function () {
      const client = connect(MockServiceClient, { region: "us-east-1" });
      expect(client.params.retryStrategy).to.be.instanceOf(StandardRetryStrategy);
    });

    it("should preserve retryStrategy when provided", function () {
      const customStrategy = new StandardRetryStrategy(async () => 5);
      const client = connect(MockServiceClient, {
        region: "us-east-1",
        retryStrategy: customStrategy,
      });
      expect(client.params.retryStrategy).to.equal(customStrategy);
    });

    it("should use AWS_DEFAULT_REGION when region not provided", function () {
      process.env.AWS_DEFAULT_REGION = "eu-west-1";
      const client = connect(MockServiceClient, {});
      expect(client.params.region).to.equal("eu-west-1");
    });

    it("should prefer provided region over AWS_DEFAULT_REGION", function () {
      process.env.AWS_DEFAULT_REGION = "eu-west-1";
      const client = connect(MockServiceClient, { region: "us-west-2" });
      expect(client.params.region).to.equal("us-west-2");
    });

    it("should handle null params", function () {
      const client = connect(MockServiceClient, null);
      expect(client).to.be.instanceOf(MockServiceClient);
      expect(client.params.customUserAgent).to.equal("Turbot/5 (APN_137229)");
    });

    it("should handle undefined params", function () {
      const client = connect(MockServiceClient);
      expect(client).to.be.instanceOf(MockServiceClient);
    });

    it("should configure proxy when https_proxy env var is set", function () {
      process.env.https_proxy = "http://proxy.example.com:8080";
      const client = connect(MockServiceClient, { region: "us-east-1" });
      expect(client.params.requestHandler).to.exist;
    });

    it("should configure proxy when HTTPS_PROXY env var is set", function () {
      process.env.HTTPS_PROXY = "http://proxy.example.com:8080";
      const client = connect(MockServiceClient, { region: "us-east-1" });
      expect(client.params.requestHandler).to.exist;
    });

    it("should not configure proxy when no proxy env var is set", function () {
      const client = connect(MockServiceClient, { region: "us-east-1" });
      expect(client.params.requestHandler).to.be.undefined;
    });

    it("should handle invalid proxy URL gracefully", function () {
      process.env.https_proxy = "not-a-valid-url";
      // Should not throw, should continue without proxy
      const client = connect(MockServiceClient, { region: "us-east-1" });
      expect(client).to.be.instanceOf(MockServiceClient);
      expect(client.params.requestHandler).to.be.undefined;
    });
  });

  describe("discoveryParams", function () {
    it("should return params with the provided region", function () {
      const params = discoveryParams("us-west-2");
      expect(params.region).to.equal("us-west-2");
    });

    it("should set maxAttempts to 10 for discovery", function () {
      const params = discoveryParams("us-east-1");
      expect(params.maxAttempts).to.equal(10);
    });

    it("should include CustomDiscoveryRetryStrategy", function () {
      const params = discoveryParams("us-east-1");
      expect(params.retryStrategy).to.be.instanceOf(CustomDiscoveryRetryStrategy);
    });
  });

  describe("customBackoff (discovery)", function () {
    it("should return a number", function () {
      const result = customBackoff(1);
      expect(result).to.be.a("number");
    });

    it("should return values within expected range for retry 1", function () {
      // For retry 1: total = 2^1 * 100 = 200ms
      // base = 200 * 0.9 = 180ms
      // variation = 200 * 0.2 * random = 0-40ms
      // result should be between 180 and 220ms
      for (let i = 0; i < 100; i++) {
        const result = customBackoff(1);
        expect(result).to.be.at.least(180);
        expect(result).to.be.at.most(220);
      }
    });

    it("should return values within expected range for retry 2", function () {
      // For retry 2: total = 2^2 * 100 = 400ms
      // base = 400 * 0.9 = 360ms
      // variation = 400 * 0.2 * random = 0-80ms
      // result should be between 360 and 440ms
      for (let i = 0; i < 100; i++) {
        const result = customBackoff(2);
        expect(result).to.be.at.least(360);
        expect(result).to.be.at.most(440);
      }
    });

    it("should increase exponentially", function () {
      // Get midpoint values for different retry counts
      const midpoints = [];
      for (let retry = 1; retry <= 5; retry++) {
        // Run multiple times and average to reduce randomness
        let sum = 0;
        for (let i = 0; i < 100; i++) {
          sum += customBackoff(retry);
        }
        midpoints.push(sum / 100);
      }

      // Each value should be roughly double the previous
      for (let i = 1; i < midpoints.length; i++) {
        const ratio = midpoints[i] / midpoints[i - 1];
        expect(ratio).to.be.closeTo(2, 0.2);
      }
    });
  });

  describe("CustomDiscoveryRetryStrategy", function () {
    it("should be an instance of StandardRetryStrategy", function () {
      const strategy = new CustomDiscoveryRetryStrategy(10);
      expect(strategy).to.be.instanceOf(StandardRetryStrategy);
    });

    it("should have a delayDecider method", function () {
      const strategy = new CustomDiscoveryRetryStrategy(10);
      expect(strategy.delayDecider).to.be.a("function");
    });

    it("should return custom backoff values from delayDecider", function () {
      const strategy = new CustomDiscoveryRetryStrategy(10);
      const delay = strategy.delayDecider(100, 1);
      // Should be within the customBackoff range for retry 1
      expect(delay).to.be.at.least(180);
      expect(delay).to.be.at.most(220);
    });
  });
});
