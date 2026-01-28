# @turbot/guardrails-aws-sdk-v3

A lightweight, Turbot-optimized wrapper around AWS SDK v3, designed to simplify and standardize AWS interactions within Guardrails. This wrapper provides intelligent defaults, automatic configuration detection, and enterprise-ready features.

## Features

- **Smart Region Fallback**: 3-level region resolution (params → env var → TURBOT_CONFIG_ENV)
- **Advanced Proxy Support**: Per-service proxy control with wildcard patterns
- **Development Mode**: Automatic profile selection in development environments
- **Custom Retry Strategies**: Turbot-optimized retry logic with exponential backoff
- **IAM Signed Requests**: Built-in support for AWS signature v4 signed HTTP requests
- **Discovery Parameters**: Specialized retry strategy for AWS discovery operations
- **Zero Configuration**: Sensible defaults work out of the box

## Installation

```bash
npm install @turbot/guardrails-aws-sdk-v3
```

## Quick Start

### Basic Usage

```javascript
const taws = require("@turbot/guardrails-aws-sdk-v3");
const { S3Client, ListBucketsCommand } = require("@aws-sdk/client-s3");

// Simple connection with explicit region
const s3 = taws.connect(S3Client, { region: "us-east-1" });

async function listBuckets() {
  const data = await s3.send(new ListBucketsCommand({}));
  console.log("Buckets:", data.Buckets);
}

listBuckets();
```

### Region Configuration

The wrapper automatically resolves regions using a 3-level fallback:

```javascript
// 1. Explicit params (highest priority)
const s3 = taws.connect(S3Client, { region: "us-east-1" });

// 2. Environment variable (if params not provided)
process.env.AWS_DEFAULT_REGION = "us-west-2";
const s3 = taws.connect(S3Client, {});

// 3. TURBOT_CONFIG_ENV (lowest priority)
process.env.TURBOT_CONFIG_ENV = JSON.stringify({
  env: { region: "ap-southeast-2" }
});
const s3 = taws.connect(S3Client, {});
```

### Proxy Configuration

#### Simple Proxy (All Services)

```javascript
// Set environment variable
process.env.HTTPS_PROXY = "http://proxy.company.com:8080";

// All AWS service calls automatically use proxy
const s3 = taws.connect(S3Client, { region: "us-east-1" });
```

#### Advanced Proxy (Per-Service Control)

```javascript
// Configure via TURBOT_CONFIG_ENV
process.env.TURBOT_CONFIG_ENV = JSON.stringify({
  aws: {
    proxy: {
      https_proxy: "http://proxy.company.com:8080",
      enabled: ["s3*", "dynamodb*", "sqs*"],  // Services to proxy
      disabled: ["sts*", "iam*"]              // Services to bypass
    }
  }
});

const s3 = taws.connect(S3Client, { region: "us-east-1" });    // Uses proxy
const sts = taws.connect(STSClient, { region: "us-east-1" });  // Bypasses proxy
```

**Wildcard patterns**:
- `*` matches all services
- `s3*` matches S3Client, S3ControlClient, etc.
- `iam*` matches IAMClient, IAMRolesAnywhereClient, etc.

### Development Mode

Automatically uses Turbot dev profile when `NODE_ENV=local-development`:

```javascript
process.env.NODE_ENV = "local-development";
process.env.TURBOT_DEV_PROFILE = "silverwater";
process.env.TURBOT_DEV_MASTER_REGION = "ap-southeast-2";

// Automatically uses silverwater profile credentials
const s3 = taws.connect(S3Client, {});
```

### Custom Retry Strategy

The wrapper includes Turbot-optimized retry logic:

```javascript
const s3 = taws.connect(S3Client, {
  region: "us-east-1",
  maxAttempts: 5  // Default is 10
});

// For discovery operations (uses different backoff)
const ec2 = taws.connect(EC2Client, taws.discoveryParams({ region: "us-east-1" }));
```

### IAM Signed Requests

Make authenticated HTTP requests to AWS services:

```javascript
const taws = require("@turbot/guardrails-aws-sdk-v3");

const options = {
  uri: "https://sts.us-east-1.amazonaws.com/",
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: { Action: "GetCallerIdentity", Version: "2011-06-15" },
  aws: {
    key: "AKIAIOSFODNN7EXAMPLE",
    secret: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
  }
};

taws.awsIamSignedRequest(options, (err, result) => {
  if (err) console.error(err);
  else console.log(result);
});
```

## API Reference

### `connect(ServiceClient, params)`

Creates and configures an AWS SDK v3 client.

**Parameters**:
- `ServiceClient` (class) - AWS SDK v3 client class (e.g., S3Client, DynamoDBClient)
- `params` (object) - Configuration options:
  - `region` (string) - AWS region
  - `maxAttempts` (number) - Maximum retry attempts (default: 10)
  - `retryStrategy` (object) - Custom retry strategy
  - `customUserAgent` (string) - Custom user agent (default: "Turbot/5 (APN_137229)")
  - `signatureVersion` (string) - AWS signature version (default: "v4")
  - Any other AWS SDK v3 client options

**Returns**: Configured AWS SDK v3 client instance

### `discoveryParams(params)`

Returns parameters optimized for AWS discovery operations (uses CustomDiscoveryRetryStrategy).

**Parameters**:
- `params` (object) - Base configuration options

**Returns**: Configuration object with discovery retry strategy

### `awsIamSignedRequest(options, callback)`

Makes an IAM-signed HTTP request to AWS services.

**Parameters**:
- `options` (object):
  - `uri` (string) - Target AWS service URL
  - `method` (string) - HTTP method
  - `headers` (object) - HTTP headers
  - `body` (object) - Request body
  - `aws` (object):
    - `key` (string) - AWS access key ID
    - `secret` (string) - AWS secret access key
    - `session` (string, optional) - AWS session token
- `callback` (function) - Callback function (err, result)

### `CustomRetryStrategy`

Turbot-optimized retry strategy with custom backoff logic.

### `CustomDiscoveryRetryStrategy`

Specialized retry strategy for AWS discovery operations.

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `AWS_DEFAULT_REGION` | Default AWS region | `us-east-1` |
| `HTTPS_PROXY` / `https_proxy` | Proxy server URL | `http://proxy:8080` |
| `NODE_ENV` | Enable dev mode | `local-development` |
| `TURBOT_DEV_PROFILE` | Dev mode AWS profile | `silverwater` |
| `TURBOT_DEV_MASTER_REGION` | Dev mode default region | `ap-southeast-2` |
| `TURBOT_CONFIG_ENV` | JSON config (region, proxy) | See examples above |

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

See LICENSE file for details.
