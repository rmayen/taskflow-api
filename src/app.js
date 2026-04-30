const { hashPassword, signToken, verifyPassword, verifyToken } = require("./auth");
const { createStore } = require("./store");

function createApp(options = {}) {
  const store = options.store || createStore();

  async function handle(req, res) {
    try {
      const url = new URL(req.url, "http://localhost");
      const method = req.method.toUpperCase();

      if (method === "GET" && url.pathname === "/health") {
        return send(res, 200, { status: "ok" });
      }

      if (method === "POST" && url.pathname === "/auth/register") {
        return register(req, res, store);
      }

      if (method === "POST" && url.pathname === "/auth/login") {
        return login(req, res, store);
      }

      const user = requireUser(req, store);

      if (!user) {
        return send(res, 401, { error: "Authentication required" });
      }

      if (method === "GET" && url.pathname === "/projects") {
        const data = store.read();
        return send(res, 200, data.projects.filter((project) => project.userId === user.id));
      }

      if (method === "POST" && url.pathname === "/projects") {
        return createProject(req, res, store, user);
      }

      if (method === "GET" && url.pathname === "/tasks") {
        const status = url.searchParams.get("status");
        const data = store.read();
        let tasks = data.tasks.filter((task) => task.userId === user.id);

        if (status) {
          tasks = tasks.filter((task) => task.status === status);
        }

        return send(res, 200, tasks);
      }

      if (method === "POST" && url.pathname === "/tasks") {
        return createTask(req, res, store, user);
      }

      const taskMatch = url.pathname.match(/^\/tasks\/([a-f0-9-]+)$/);

      if (taskMatch && method === "PATCH") {
        return updateTask(req, res, store, user, taskMatch[1]);
      }

      if (taskMatch && method === "DELETE") {
        return deleteTask(res, store, user, taskMatch[1]);
      }

      return send(res, 404, { error: "Route not found" });
    } catch (error) {
      return send(res, 500, { error: "Internal server error", detail: error.message });
    }
  }

  return handle;
}

async function register(req, res, store) {
  const body = await readJson(req);
  const validationError = requireFields(body, ["name", "email", "password"]);

  if (validationError) {
    return send(res, 400, { error: validationError });
  }

  if (body.password.length < 8) {
    return send(res, 400, { error: "Password must be at least 8 characters" });
  }

  const email = body.email.trim().toLowerCase();
  const result = store.mutate((data) => {
    if (data.users.some((user) => user.email === email)) {
      return null;
    }

    const user = {
      id: store.id(),
      name: body.name.trim(),
      email,
      passwordHash: hashPassword(body.password),
      createdAt: new Date().toISOString()
    };

    data.users.push(user);
    return publicUser(user);
  });

  if (!result) {
    return send(res, 409, { error: "Email already registered" });
  }

  return send(res, 201, {
    user: result,
    token: signToken({ userId: result.id })
  });
}

async function login(req, res, store) {
  const body = await readJson(req);
  const validationError = requireFields(body, ["email", "password"]);

  if (validationError) {
    return send(res, 400, { error: validationError });
  }

  const data = store.read();
  const user = data.users.find((candidate) => candidate.email === body.email.trim().toLowerCase());

  if (!user || !verifyPassword(body.password, user.passwordHash)) {
    return send(res, 401, { error: "Invalid email or password" });
  }

  return send(res, 200, {
    user: publicUser(user),
    token: signToken({ userId: user.id })
  });
}

async function createProject(req, res, store, user) {
  const body = await readJson(req);
  const validationError = requireFields(body, ["name"]);

  if (validationError) {
    return send(res, 400, { error: validationError });
  }

  const project = store.mutate((data) => {
    const nextProject = {
      id: store.id(),
      userId: user.id,
      name: body.name.trim(),
      description: body.description?.trim() || "",
      createdAt: new Date().toISOString()
    };

    data.projects.push(nextProject);
    return nextProject;
  });

  return send(res, 201, project);
}

async function createTask(req, res, store, user) {
  const body = await readJson(req);
  const validationError = requireFields(body, ["title"]);

  if (validationError) {
    return send(res, 400, { error: validationError });
  }

  const task = store.mutate((data) => {
    if (body.projectId && !data.projects.some((project) => project.id === body.projectId && project.userId === user.id)) {
      return null;
    }

    const nextTask = {
      id: store.id(),
      userId: user.id,
      projectId: body.projectId || null,
      title: body.title.trim(),
      description: body.description?.trim() || "",
      status: body.status || "todo",
      dueDate: body.dueDate || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    data.tasks.push(nextTask);
    return nextTask;
  });

  if (!task) {
    return send(res, 400, { error: "Project does not exist" });
  }

  return send(res, 201, task);
}

async function updateTask(req, res, store, user, taskId) {
  const body = await readJson(req);
  const allowedStatuses = new Set(["todo", "in_progress", "done"]);

  if (body.status && !allowedStatuses.has(body.status)) {
    return send(res, 400, { error: "Status must be todo, in_progress, or done" });
  }

  const task = store.mutate((data) => {
    const existing = data.tasks.find((candidate) => candidate.id === taskId && candidate.userId === user.id);

    if (!existing) {
      return null;
    }

    if (body.title) existing.title = body.title.trim();
    if (body.description !== undefined) existing.description = body.description.trim();
    if (body.status) existing.status = body.status;
    if (body.dueDate !== undefined) existing.dueDate = body.dueDate;
    existing.updatedAt = new Date().toISOString();

    return existing;
  });

  if (!task) {
    return send(res, 404, { error: "Task not found" });
  }

  return send(res, 200, task);
}

function deleteTask(res, store, user, taskId) {
  const removed = store.mutate((data) => {
    const index = data.tasks.findIndex((task) => task.id === taskId && task.userId === user.id);

    if (index === -1) {
      return false;
    }

    data.tasks.splice(index, 1);
    return true;
  });

  if (!removed) {
    return send(res, 404, { error: "Task not found" });
  }

  return send(res, 204, null);
}

function requireUser(req, store) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  const payload = verifyToken(token);

  if (!payload?.userId) {
    return null;
  }

  return store.read().users.find((user) => user.id === payload.userId) || null;
}

function requireFields(body, fields) {
  for (const field of fields) {
    if (!body[field] || String(body[field]).trim() === "") {
      return `${field} is required`;
    }
  }

  return null;
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt
  };
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      if (!body) {
        return resolve({});
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
  });
}

function send(res, statusCode, payload) {
  res.statusCode = statusCode;

  if (statusCode === 204) {
    return res.end();
  }

  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

module.exports = {
  createApp
};
