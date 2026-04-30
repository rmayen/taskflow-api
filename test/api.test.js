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

test("rejects duplicate registration with the same email", async () => {
  await request("/auth/register", "POST", {
    name: "First",
    email: "dup@example.com",
    password: "secretpass1"
  });

  const second = await request("/auth/register", "POST", {
    name: "Second",
    email: "dup@example.com",
    password: "secretpass2"
  });

  assert.equal(second.status, 409);
});

test("login returns a working token after register", async () => {
  await request("/auth/register", "POST", {
    name: "Login User",
    email: "login@example.com",
    password: "secretpass1"
  });

  const login = await request("/auth/login", "POST", {
    email: "login@example.com",
    password: "secretpass1"
  });

  assert.equal(login.status, 200);
  assert.ok(login.body.token);

  const tasks = await request("/tasks", "GET", undefined, login.body.token);
  assert.equal(tasks.status, 200);
});

test("filters tasks by status query parameter", async () => {
  const register = await request("/auth/register", "POST", {
    name: "Filter User",
    email: "filter@example.com",
    password: "secretpass1"
  });

  const token = register.body.token;
  await request("/tasks", "POST", { title: "One", status: "todo" }, token);
  await request("/tasks", "POST", { title: "Two", status: "done" }, token);

  const done = await request("/tasks?status=done", "GET", undefined, token);
  assert.equal(done.status, 200);
  assert.equal(done.body.length, 1);
  assert.equal(done.body[0].title, "Two");
});

test("updates a task and rejects invalid status values", async () => {
  const register = await request("/auth/register", "POST", {
    name: "Update User",
    email: "update@example.com",
    password: "secretpass1"
  });

  const token = register.body.token;
  const create = await request("/tasks", "POST", { title: "Original" }, token);
  const taskId = create.body.id;

  const update = await request(`/tasks/${taskId}`, "PATCH", { status: "done" }, token);
  assert.equal(update.status, 200);
  assert.equal(update.body.status, "done");

  const bad = await request(`/tasks/${taskId}`, "PATCH", { status: "wat" }, token);
  assert.equal(bad.status, 400);
});

test("deletes a task and returns 404 when missing", async () => {
  const register = await request("/auth/register", "POST", {
    name: "Delete User",
    email: "delete@example.com",
    password: "secretpass1"
  });

  const token = register.body.token;
  const create = await request("/tasks", "POST", { title: "Will be deleted" }, token);
  const taskId = create.body.id;

  const remove = await request(`/tasks/${taskId}`, "DELETE", undefined, token);
  assert.equal(remove.status, 204);

  const missing = await request(`/tasks/${taskId}`, "DELETE", undefined, token);
  assert.equal(missing.status, 404);
});

test("creates and lists a project", async () => {
  const register = await request("/auth/register", "POST", {
    name: "Project User",
    email: "project@example.com",
    password: "secretpass1"
  });

  const token = register.body.token;
  const create = await request("/projects", "POST", { name: "Q2 Roadmap" }, token);
  assert.equal(create.status, 201);

  const list = await request("/projects", "GET", undefined, token);
  assert.equal(list.status, 200);
  assert.ok(list.body.some((project) => project.name === "Q2 Roadmap"));
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
