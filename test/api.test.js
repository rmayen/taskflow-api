const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");
const { after, before, test } = require("node:test");
const { createApp } = require("../src/app");

let server;
let baseUrl;

before(async () => {
  server = http.createServer(createApp({ store: createMemoryStore() }));
  await new Promise((resolve) => server.listen(0, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

test("registers a user and creates a task", async () => {
  const registerResponse = await request("/auth/register", "POST", {
    name: "Rene Mayen",
    email: "rene@example.com",
    password: "securepass123"
  });

  assert.equal(registerResponse.status, 201);
  assert.ok(registerResponse.body.token);

  const taskResponse = await request(
    "/tasks",
    "POST",
    { title: "Finish API docs", status: "in_progress" },
    registerResponse.body.token
  );

  assert.equal(taskResponse.status, 201);
  assert.equal(taskResponse.body.title, "Finish API docs");
  assert.equal(taskResponse.body.status, "in_progress");
});

test("rejects unauthenticated task requests", async () => {
  const response = await request("/tasks", "GET");

  assert.equal(response.status, 401);
  assert.equal(response.body.error, "Authentication required");
});

function request(path, method, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = http.request(
      `${baseUrl}${path}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      },
      (res) => {
        let responseBody = "";

        res.on("data", (chunk) => {
          responseBody += chunk;
        });

        res.on("end", () => {
          resolve({
            status: res.statusCode,
            body: responseBody ? JSON.parse(responseBody) : null
          });
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy(new Error("Request timed out"));
    });
    req.end(payload);
  });
}

function createMemoryStore() {
  let data = { users: [], projects: [], tasks: [] };

  return {
    read: () => structuredClone(data),
    write: (nextData) => {
      data = structuredClone(nextData);
    },
    mutate(callback) {
      const nextData = structuredClone(data);
      const result = callback(nextData);
      data = nextData;
      return result;
    },
    id: () => crypto.randomUUID()
  };
}
