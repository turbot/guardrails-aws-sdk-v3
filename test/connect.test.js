const { expect } = require("chai");
const { S3Client } = require("@aws-sdk/client-s3");
const taws = require("../index");

describe("connect", () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    delete process.env.AWS_DEFAULT_REGION;
    delete process.env.HTTPS_PROXY;
    delete process.env.https_proxy;
  });

  afterEach(() => {
    process.env = originalEnv;
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
});
