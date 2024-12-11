# @turbot/aws-sdk

A lightweight, Turbot-specific wrapper around AWS SDK v3, designed to simplify and standardize common AWS interactions within Turbot. This wrapper includes built-in support for:

- **Proxy Server Configuration**: Seamless integration with proxy configurations for environments where internet access is routed through a proxy.

## Features

- **AWS SDK v3 Wrapper**: Leverages the modular AWS SDK v3 for efficient service calls and easy customization.
- **Proxy Server Support**: Automatically detects and applies proxy settings to AWS service calls using `https-proxy-agent`.

## Installation

To install the package, use the following command:

```bash
npm install @turbot/guardrails-aws-sdk-v3
```



## Usage

### Basic Example

```javascript
const taws = require("@turbot/guardrails-aws-sdk-v3");
const { S3Client, ListBucketsCommand } = require("@aws-sdk/client-s3");

const connParams = {};
connParams.region = "us-east-1";
const conn = taws.connect(S3Client, connParams);

async function listS3Buckets() {
  try {
    const data = await conn.send(new ListBucketsCommand({}));
    console.log("Buckets:", data.Buckets);
  } catch (error) {
    console.error("Error listing S3 buckets:", error);
  }
}

listS3Buckets();
```

### Proxy Server Support

`@turbot/guardrails-aws-sdk-v3` automatically detects the proxy settings from the environment variables (`HTTPS_PROXY` or `https_proxy`) and applies the proxy settings to AWS SDK service calls.


### Custom Configuration

If you have specific configurations such as custom user agents, retries, or timeouts, you can easily extend the AWS clients with these settings:

```javascript
const taws = require("@turbot/guardrails-aws-sdk-v3");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const connParams = {
  region: "us-west-2",
  maxRetries: 5, // Customize retries
  customUserAgent: "TurbotClient/1.0", // Custom User Agent
};
const conn = taws.connect(DynamoDBClient, connParams);
```
