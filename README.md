# ReqPlan — Requirement Management Software

A full-stack web application for managing software requirements, organised into projects and modules, with traceability links between requirements and Word document export.

---

## Features

| Area | Details |
|---|---|
| **Projects & Modules** | Requirements are organised into projects → modules → requirements |
| **Requirements** | CRUD with auto-generated IDs (`REQ-0001`), status, priority, description, and tags |
| **Traceability** | Link requirements across modules with types: Related, Depends On, Parent, Child |
| **Traceability Matrix** | Interactive N×N matrix view, scoped by project or module |
| **Word Export** | Export a full project (requirements table + links list + matrix) to `.docx` |
| **Tags** | Colour-coded tags for filtering and categorisation |
| **User Management** | Admin can create accounts and assign roles (admin / manager / viewer) |
| **Authentication** | JWT-based login; new users can self-register as viewers |

### Role permissions

| Action | Viewer | Manager | Admin |
|---|:---:|:---:|:---:|
| View requirements, projects, matrix | ✓ | ✓ | ✓ |
| Create / edit requirements, projects, modules | | ✓ | ✓ |
| Manage tags | | ✓ | ✓ |
| Create user accounts | | | ✓ |
| Change user roles / delete users | | | ✓ |
| Delete tags | | | ✓ |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router 6, Vite 5 |
| Backend | Node.js 22, Express 4 |
| Database | SQLite via `node:sqlite` (built-in, no compilation required) |
| Auth | JSON Web Tokens (`jsonwebtoken`) + bcrypt (`bcryptjs`) |
| Word export | `docx` v9 |

---

## Prerequisites

- **Node.js 22.12 or later** (uses the built-in `node:sqlite` module)
  Download from [nodejs.org](https://nodejs.org) — select the LTS release.

Verify your version:

```bash
node --version   # must be v22.12.0 or higher
```

---

## Installation

Clone the repository and install dependencies for both backend and frontend:

```bash
# Install all dependencies at once
npm run install:all
```

Or install them separately:

```bash
npm install --prefix backend
npm install --prefix frontend
```

---

## Running the Application

Start the backend and frontend in **two separate terminals**:

**Terminal 1 — Backend (API server)**
```bash
npm run dev:backend
# Runs on http://localhost:3001
```

**Terminal 2 — Frontend (Dev server)**
```bash
npm run dev:frontend
# Runs on http://localhost:5173
```

Then open **http://localhost:5173** in your browser.

### Default admin credentials

```
Username: admin
Password: admin123
```

> Change the admin password after first login via the Users page.

---

## Project Structure

```
req_plan/
├── backend/
│   ├── server.js           # Express app entry point
│   ├── database.js         # SQLite schema, migrations, seed
│   ├── middleware/
│   │   └── auth.js         # JWT authentication + role guards
│   └── routes/
│       ├── auth.js         # POST /api/auth/login|register, GET /api/auth/me
│       ├── requirements.js # CRUD, tags, traceability links, meta endpoints
│       ├── projects.js     # Project CRUD + module creation
│       ├── modules.js      # Module CRUD + list
│       ├── users.js        # User management (admin)
│       └── export.js       # GET /api/projects/:id/export → .docx
├── frontend/
│   ├── vite.config.js      # Vite config (proxies /api → :3001)
│   └── src/
│       ├── App.jsx          # Routes
│       ├── api.js           # API client (all fetch calls)
│       ├── contexts/
│       │   └── AuthContext.jsx
│       ├── components/
│       │   └── Layout.jsx   # Sidebar navigation
│       └── pages/
│           ├── LoginPage.jsx
│           ├── RegisterPage.jsx
│           ├── DashboardPage.jsx
│           ├── ProjectsPage.jsx
│           ├── ProjectDetailPage.jsx
│           ├── ModuleDetailPage.jsx
│           ├── RequirementsPage.jsx
│           ├── RequirementDetailPage.jsx
│           ├── TraceabilityPage.jsx
│           ├── TagsPage.jsx
│           └── UsersPage.jsx
└── package.json            # Root scripts (install:all, dev:backend, dev:frontend)
```

---

## API Overview

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Self-register (viewer role) |
| `POST` | `/api/auth/login` | Log in, returns JWT |
| `GET` | `/api/auth/me` | Current user info |
| `GET/POST` | `/api/requirements` | List (filterable) / create |
| `GET/PUT/DELETE` | `/api/requirements/:id` | Get / update / delete |
| `POST/DELETE` | `/api/requirements/:id/tags` | Add / remove tag |
| `POST/DELETE` | `/api/requirements/:id/links` | Add / remove traceability link |
| `GET` | `/api/requirements/meta/tags` | List all tags |
| `POST/DELETE` | `/api/requirements/meta/tags` | Create / delete tag |
| `GET` | `/api/requirements/meta/links` | All links (filter by `project_id` or `module_id`) |
| `GET` | `/api/requirements/stats` | Dashboard stats |
| `GET/POST` | `/api/projects` | List / create projects |
| `GET/PUT/DELETE` | `/api/projects/:id` | Get (with modules) / update / delete |
| `POST` | `/api/projects/:id/modules` | Create module in project |
| `GET` | `/api/projects/:id/export` | Download `.docx` export |
| `GET/PUT/DELETE` | `/api/modules/:id` | Get / update / delete module |
| `GET` | `/api/modules` | List all modules |
| `GET/POST` | `/api/users` | List users / create user (admin) |
| `PUT` | `/api/users/:id/role` | Change role (admin) |
| `DELETE` | `/api/users/:id` | Delete user (admin) |

All endpoints except `/api/auth/login` and `/api/auth/register` require a `Bearer` token in the `Authorization` header.

---

## Production Build

Build the frontend for production:

```bash
npm run build:frontend
# Output: frontend/dist/
```

Serve the `frontend/dist/` folder with any static file server, and ensure `/api` requests are proxied to the backend.

To run the backend in production mode:

```bash
npm run start:backend
```

---

## Environment Variables

The backend reads the following optional environment variables:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend listening port |
| `JWT_SECRET` | `req-plan-secret-change-in-production` | JWT signing secret |

Set `JWT_SECRET` to a long random string in production:

```bash
JWT_SECRET=your-long-random-secret npm run start:backend
```

---

## Database

The SQLite database file is created automatically at `backend/data.db` on first run. No setup is required. The schema and any migrations run at startup.

To reset the database, delete `backend/data.db` and restart the backend.
