# TaskFlow API

TaskFlow API is a dependency-light Node.js REST API for managing projects and tasks. It demonstrates backend fundamentals that matter in software engineering interviews: authentication, route design, validation, persistence, error handling, and automated tests.

## Features

- User registration and login
- Signed bearer-token authentication
- Project creation and listing
- Task creation, filtering, updating, and deletion
- JSON-file persistence for local development
- Input validation and consistent error responses
- Automated API tests using Node's built-in test runner

## Tech Stack

- Node.js
- Built-in `http` module
- Built-in `crypto` module
- Node test runner

## Getting Started

```bash
npm install
npm test
npm start
```

The API runs at:

```text
http://localhost:3000
```

## API Examples

Register a user:

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Rene Mayen","email":"rene@example.com","password":"securepass123"}'
```

Create a task:

```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title":"Finish project documentation","status":"in_progress"}'
```

List tasks:

```bash
curl http://localhost:3000/tasks \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Update a task:

```bash
curl -X PATCH http://localhost:3000/tasks/TASK_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"status":"done"}'
```

Delete a task:

```bash
curl -X DELETE http://localhost:3000/tasks/TASK_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Routes

| Method | Route | Description | Auth |
| --- | --- | --- | --- |
| `GET` | `/health` | Health check | No |
| `POST` | `/auth/register` | Create account | No |
| `POST` | `/auth/login` | Login and receive token | No |
| `GET` | `/projects` | List projects | Yes |
| `POST` | `/projects` | Create project | Yes |
| `GET` | `/tasks` | List tasks | Yes |
| `POST` | `/tasks` | Create task | Yes |
| `PATCH` | `/tasks/:id` | Update task | Yes |
| `DELETE` | `/tasks/:id` | Delete task | Yes |

## Project Structure

```text
taskflow-api/
  src/
    app.js
    auth.js
    server.js
    store.js
  test/
    api.test.js
```

## Notes

This project intentionally avoids web-framework dependencies so the core HTTP, authentication, and persistence logic is easy to inspect. A production version would move persistence to PostgreSQL, rotate secrets through environment management, and add rate limiting.
