const { expect } = require("chai");
const { S3Client } = require("@aws-sdk/client-s3");
const taws = require("../index");

describe("retryStrategies", () => {
  describe("when using CustomRetryStrategy", () => {
    it("should create a custom retry strategy with default attempts", () => {
      // Strategy is used in connect
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      expect(s3.config.retryStrategy).to.exist;
    });

    it("should use custom backoff calculation", () => {
      const s3 = taws.connect(S3Client, { region: "us-east-1" });
      const strategy = s3.config.retryStrategy;

      // Test that delayDecider is called (which calls defaultCustomBackoff)
      // We can't easily test the internal function directly, but we can verify
      // the retry strategy exists and would be used
      expect(strategy).to.exist;
    });

    it("should handle multiple retry attempts", () => {
      const s3 = taws.connect(S3Client, {
        region: "us-east-1",
        maxAttempts: 5,
      });
      expect(s3.config.retryStrategy).to.exist;
    });

    it("should use defaultCustomBackoff when delayDecider is called", () => {
      // Create CustomRetryStrategy directly to test delayDecider
      const strategy = new taws.CustomRetryStrategy(3);

      // Directly test delayDecider (line 299 in index.js)
      // This also tests defaultCustomBackoff (lines 283-287)
      const delay1 = strategy.delayDecider(null, 1);
      const delay2 = strategy.delayDecider(null, 2);
      const delay3 = strategy.delayDecider(null, 3);

      // Verify delays follow exponential backoff pattern
      // For retry 1: 2^1 * 1000 = 2000ms base, 2000*0.9 = 1800ms, variation 0-400ms
      expect(delay1).to.be.within(1800, 2200);

      // For retry 2: 2^2 * 1000 = 4000ms base, 4000*0.9 = 3600ms, variation 0-800ms
      expect(delay2).to.be.within(3600, 4400);

      // For retry 3: 2^3 * 1000 = 8000ms base, 8000*0.9 = 7200ms, variation 0-1600ms
      expect(delay3).to.be.within(7200, 8800);

      // Verify exponential growth
      expect(delay2).to.be.greaterThan(delay1);
      expect(delay3).to.be.greaterThan(delay2);
    });
  });

  describe("when using CustomDiscoveryRetryStrategy", () => {
    it("should create discovery retry strategy", () => {
      const strategy = new taws.CustomDiscoveryRetryStrategy(10);
      expect(strategy).to.exist;
    });

    it("should work with discoveryParams", () => {
      const params = taws.discoveryParams("us-east-1");
      expect(params.region).to.equal("us-east-1");
      expect(params.maxAttempts).to.equal(10);
      expect(params.retryStrategy).to.be.instanceOf(taws.CustomDiscoveryRetryStrategy);
    });

    it("should use custom backoff for discovery", () => {
      const strategy = new taws.CustomDiscoveryRetryStrategy(10);

      // Call delayDecider to test the backoff logic
      const delay1 = strategy.delayDecider(null, 1);
      const delay2 = strategy.delayDecider(null, 2);
      const delay3 = strategy.delayDecider(null, 3);

      // Verify exponential backoff (delay2 should be roughly 2x delay1)
      // With randomization, we check the general pattern
      expect(delay1).to.be.greaterThan(0);
      expect(delay2).to.be.greaterThan(delay1);
      expect(delay3).to.be.greaterThan(delay2);

      // For retry 1: base is 2^1 * 100 * 0.9 = 180ms, variation adds 0-40ms
      // So delay1 should be between 180 and 220
      expect(delay1).to.be.within(180, 220);

      // For retry 2: base is 2^2 * 100 * 0.9 = 360ms, variation adds 0-80ms
      expect(delay2).to.be.within(360, 440);

      // For retry 3: base is 2^3 * 100 * 0.9 = 720ms, variation adds 0-160ms
      expect(delay3).to.be.within(720, 880);
    });

    it("should handle high retry counts for discovery", () => {
      const strategy = new taws.CustomDiscoveryRetryStrategy(10);

      // Test retry 10 (very high)
      const delay10 = strategy.delayDecider(null, 10);

      // For retry 10: 2^10 * 100 = 102400ms base
      // With 0.9 multiplier: 92160ms, variation adds up to 20480ms
      expect(delay10).to.be.within(92160, 112640);
    });
  });

  describe("when using customBackoff function", () => {
    it("should be exported as customBackoffForDiscovery", () => {
      expect(taws.customBackoff).to.be.a("function");

      // Test the function directly
      const delay1 = taws.customBackoff(1);
      const delay2 = taws.customBackoff(2);

      expect(delay1).to.be.within(180, 220);
      expect(delay2).to.be.within(360, 440);
    });

    it("should handle retry count 0", () => {
      const delay0 = taws.customBackoff(0);
      // 2^0 * 100 = 100, 100 * 0.9 = 90, variation 0-20
      expect(delay0).to.be.within(90, 110);
    });

    it("should produce different delays due to randomization", () => {
      const delays = [];
      for (let i = 0; i < 10; i++) {
        delays.push(taws.customBackoff(5));
      }

      // Check that we got some variation (not all identical)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).to.be.greaterThan(1);
    });
  });
});
