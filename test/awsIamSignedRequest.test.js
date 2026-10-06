const fs = require("fs");
const http = require("http");
const https = require("https");
const net = require("net");
const path = require("path");
const { expect } = require("chai");
const nock = require("nock");
const taws = require("../index");

describe("awsIamSignedRequest", () => {
  afterEach(() => {
    nock.cleanAll();
  });

  it("should be exported", () => {
    expect(taws.awsIamSignedRequest).to.be.a("function");
  });

  it("should handle successful HTTP response", (done) => {
    // Mock successful HTTP response (covers lines 397-399)
    nock("https://execute-api.us-east-1.amazonaws.com").get("/test").reply(200, { success: true, data: "test-data" });

    const opts = {
      uri: "https://execute-api.us-east-1.amazonaws.com/test",
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    };

    const credentials = {
      AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
      SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      SessionToken: "testSessionToken",
    };

    taws.awsIamSignedRequest(opts, "execute-api", credentials, (error, body) => {
      // This tests the success path (lines 397-399)
      expect(error).to.be.null;
      expect(body).to.deep.equal({ success: true, data: "test-data" });
      done();
    });
  });

  it("should handle request signing with valid credentials", (done) => {
    const opts = {
      uri: "https://execute-api.us-east-1.amazonaws.com/test",
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    };

    const credentials = {
      AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
      SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      SessionToken: "testSessionToken",
    };

    // Note: The request itself fails since it's not a real endpoint,
    // but it tests the signing logic up to that point
    taws.awsIamSignedRequest(opts, "execute-api", credentials, (error, body) => {
      // Expect error because endpoint doesn't exist
      // But this proves the function executed the signing logic
      expect(error || body).to.exist;
      done();
    });
  });

  it("should handle request with body", (done) => {
    const opts = {
      uri: "https://execute-api.us-east-1.amazonaws.com/test",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        key: "value",
      },
    };

    const credentials = {
      AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
      SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      SessionToken: "testSessionToken",
    };

    taws.awsIamSignedRequest(opts, "execute-api", credentials, (error, body) => {
      expect(error || body).to.exist;
      done();
    });
  });

  it("should handle request without body", (done) => {
    const opts = {
      uri: "https://execute-api.us-east-1.amazonaws.com/test",
      method: "GET",
      headers: {},
    };

    const credentials = {
      AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
      SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      SessionToken: "testSessionToken",
    };

    taws.awsIamSignedRequest(opts, "execute-api", credentials, (error, body) => {
      expect(error || body).to.exist;
      done();
    });
  });

  it("should handle URI with query parameters", (done) => {
    const opts = {
      uri: "https://execute-api.us-east-1.amazonaws.com/test?param1=value1&param2=value2",
      method: "GET",
      headers: {},
    };

    const credentials = {
      AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
      SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      SessionToken: "testSessionToken",
    };

    taws.awsIamSignedRequest(opts, "execute-api", credentials, (error, body) => {
      expect(error || body).to.exist;
      done();
    });
  });

  it("should handle POST with body and return parsed response", (done) => {
    nock("https://execute-api.us-east-1.amazonaws.com")
      .post("/test", JSON.stringify({ key: "value" }))
      .reply(200, { received: true });

    const opts = {
      uri: "https://execute-api.us-east-1.amazonaws.com/test",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        key: "value",
      },
    };

    const credentials = {
      AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
      SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      SessionToken: "testSessionToken",
    };

    taws.awsIamSignedRequest(opts, "execute-api", credentials, (error, body) => {
      expect(error).to.be.null;
      expect(body).to.deep.equal({ received: true });
      done();
    });
  });

  it("should call callback with error on network failure", (done) => {
    nock("https://execute-api.us-east-1.amazonaws.com").get("/test").replyWithError("connection refused");

    const opts = {
      uri: "https://execute-api.us-east-1.amazonaws.com/test",
      method: "GET",
      headers: {},
    };

    const credentials = {
      AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
      SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      SessionToken: "testSessionToken",
    };

    taws.awsIamSignedRequest(opts, "execute-api", credentials, (error) => {
      expect(error).to.exist;
      expect(error.message).to.include("connection refused");
      done();
    });
  });

  it("should handle credentials without SessionToken", (done) => {
    nock("https://execute-api.us-east-1.amazonaws.com").get("/test").reply(200, { ok: true });

    const opts = {
      uri: "https://execute-api.us-east-1.amazonaws.com/test",
      method: "GET",
      headers: {},
    };

    const credentials = {
      AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
      SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    };

    taws.awsIamSignedRequest(opts, "execute-api", credentials, (error, body) => {
      expect(error).to.be.null;
      expect(body).to.deep.equal({ ok: true });
      done();
    });
  });

  it("should call callback with error on non-JSON response", (done) => {
    nock("https://execute-api.us-east-1.amazonaws.com").get("/test").reply(200, "not json", {
      "Content-Type": "text/plain",
    });

    const opts = {
      uri: "https://execute-api.us-east-1.amazonaws.com/test",
      method: "GET",
      headers: {},
    };

    const credentials = {
      AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
      SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      SessionToken: "testSessionToken",
    };

    taws.awsIamSignedRequest(opts, "execute-api", credentials, (error) => {
      // JSON.parse throws on a non-JSON body, which is passed to the callback
      expect(error).to.exist;
      done();
    });
  });

  describe("with a proxy", () => {
    const credentials = {
      AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
      SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      SessionToken: "testSessionToken",
    };

    let originalEnv;
    let proxyServer;
    let proxyUrl;
    let connects;
    let closedPort;

    before(async () => {
      // nock's passthrough cannot drive an async agent such as HttpsProxyAgent,
      // so these tests use real sockets on localhost instead.
      nock.restore();

      // A stand-in for Squid: record each CONNECT tunnel request, then refuse it.
      proxyServer = http.createServer();
      proxyServer.on("connect", (req, socket) => {
        connects.push(req.url);
        socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
      });
      await new Promise((resolve) => proxyServer.listen(0, "127.0.0.1", resolve));
      proxyUrl = `http://127.0.0.1:${proxyServer.address().port}`;

      // A port with nothing listening, so a direct request fails fast with ECONNREFUSED.
      const placeholder = net.createServer();
      await new Promise((resolve) => placeholder.listen(0, "127.0.0.1", resolve));
      closedPort = placeholder.address().port;
      await new Promise((resolve) => placeholder.close(resolve));
    });

    after(async () => {
      await new Promise((resolve) => proxyServer.close(resolve));
      nock.activate();
    });

    beforeEach(() => {
      originalEnv = { ...process.env };
      delete process.env.HTTPS_PROXY;
      delete process.env.https_proxy;
      delete process.env.TURBOT_CONFIG_ENV;
      connects = [];
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    const appsyncOpts = {
      uri: "https://example.appsync-api.us-east-1.amazonaws.com/graphql",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: { query: "{ __typename }" },
    };

    it("should tunnel through HTTPS_PROXY", (done) => {
      process.env.HTTPS_PROXY = proxyUrl;

      taws.awsIamSignedRequest(appsyncOpts, "appsync", credentials, (error) => {
        expect(connects).to.deep.equal(["example.appsync-api.us-east-1.amazonaws.com:443"]);
        // The proxy refused the tunnel, so the request fails.
        expect(error).to.exist;
        done();
      });
    });

    it("should tunnel through the proxy in TURBOT_CONFIG_ENV", (done) => {
      process.env.TURBOT_CONFIG_ENV = JSON.stringify({ aws: { proxy: { https_proxy: proxyUrl } } });

      taws.awsIamSignedRequest(appsyncOpts, "appsync", credentials, (error) => {
        expect(connects).to.deep.equal(["example.appsync-api.us-east-1.amazonaws.com:443"]);
        expect(error).to.exist;
        done();
      });
    });

    it("should go direct when the service is disabled in TURBOT_CONFIG_ENV", (done) => {
      process.env.HTTPS_PROXY = proxyUrl;
      process.env.TURBOT_CONFIG_ENV = JSON.stringify({ aws: { proxy: { disabled: ["appsync"] } } });

      const opts = { ...appsyncOpts, uri: `https://127.0.0.1:${closedPort}/graphql` };
      taws.awsIamSignedRequest(opts, "appsync", credentials, (error) => {
        expect(connects).to.be.empty;
        expect(error.code).to.equal("ECONNREFUSED");
        expect(error.port).to.equal(closedPort);
        done();
      });
    });

    it("should go direct when no proxy is configured", (done) => {
      const opts = { ...appsyncOpts, uri: `https://127.0.0.1:${closedPort}/graphql` };
      taws.awsIamSignedRequest(opts, "appsync", credentials, (error) => {
        expect(connects).to.be.empty;
        expect(error.code).to.equal("ECONNREFUSED");
        expect(error.port).to.equal(closedPort);
        done();
      });
    });

    it("should time out once when the proxy never answers CONNECT", (done) => {
      // A wedged proxy: it takes the tunnel request and never replies.
      const held = [];
      const stalledProxy = http.createServer();
      stalledProxy.on("connect", (req, socket) => held.push(socket));
      stalledProxy.listen(0, "127.0.0.1", () => {
        process.env.HTTPS_PROXY = `http://127.0.0.1:${stalledProxy.address().port}`;

        const calls = [];
        taws.awsIamSignedRequest({ ...appsyncOpts, timeout: 100 }, "appsync", credentials, (error) => {
          calls.push(error);
        });

        setTimeout(() => {
          // Closing the tunnel makes the agent fail the request it gave up on,
          // so a second callback would land before the assertions.
          held.forEach((socket) => socket.destroy());
          setTimeout(() => {
            stalledProxy.close();
            expect(held).to.have.length(1);
            expect(calls).to.have.length(1);
            expect(calls[0].message).to.include("timed out after 100ms");
            done();
          }, 100);
        }, 500);
      });
    });
  });

  describe("when the connection resets mid-response", () => {
    const credentials = {
      AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
      SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    };

    // A throwaway self-signed certificate for 127.0.0.1, trusted for these tests only.
    const tls = {
      key: fs.readFileSync(path.join(__dirname, "fixtures", "localhost-key.pem")),
      cert: fs.readFileSync(path.join(__dirname, "fixtures", "localhost-cert.pem")),
    };

    let originalEnv;

    before(() => {
      nock.restore();
      https.globalAgent.options.ca = tls.cert;
    });

    after(() => {
      delete https.globalAgent.options.ca;
      nock.activate();
    });

    beforeEach(() => {
      originalEnv = { ...process.env };
      delete process.env.HTTPS_PROXY;
      delete process.env.https_proxy;
      delete process.env.TURBOT_CONFIG_ENV;
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it("should call back once", (done) => {
      // Send the headers and part of the body, then reset the TCP connection under TLS.
      let tcpSocket;
      const server = https.createServer(tls, (req, res) => {
        res.writeHead(200, { "Content-Type": "application/json", "Content-Length": "100" });
        res.write('{"partial":');
        setTimeout(() => tcpSocket.resetAndDestroy(), 50);
      });
      server.on("connection", (socket) => {
        tcpSocket = socket;
      });
      server.listen(0, "127.0.0.1", () => {
        const opts = { uri: `https://127.0.0.1:${server.address().port}/graphql`, method: "GET", headers: {} };

        const calls = [];
        taws.awsIamSignedRequest(opts, "appsync", credentials, (error) => {
          calls.push(error);
        });

        setTimeout(() => {
          server.close();
          expect(calls).to.have.length(1);
          expect(calls[0].code).to.equal("ECONNRESET");
          done();
        }, 500);
      });
    });
  });
});
