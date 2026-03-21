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
| **AI Import** | Upload a Word (.docx) or PDF document; chat with an LLM to extract and refine requirements, then bulk-import them into any module |

### Role permissions

| Action | Viewer | Manager | Admin |
|---|:---:|:---:|:---:|
| View requirements, projects, matrix | ✓ | ✓ | ✓ |
| Create / edit requirements, projects, modules | | ✓ | ✓ |
| Manage tags | | ✓ | ✓ |
| Use AI Import | | ✓ | ✓ |
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
| AI / LLM | `openai` SDK (OpenAI-compatible, configurable base URL) |
| Document parsing | `mammoth` (.docx), `pdf-parse` (.pdf), `multer` (file upload) |

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
├── railway.toml            # Railway deployment configuration
├── .env.example            # Environment variable template
├── backend/
│   ├── server.js           # Express app entry point (also serves frontend/dist in production)
│   ├── database.js         # SQLite schema, migrations, seed
│   ├── middleware/
│   │   └── auth.js         # JWT authentication + role guards
│   └── routes/
│       ├── auth.js         # POST /api/auth/login|register, GET /api/auth/me
│       ├── requirements.js # CRUD, tags, traceability links, meta endpoints
│       ├── projects.js     # Project CRUD + module creation
│       ├── modules.js      # Module CRUD + list
│       ├── users.js        # User management (admin)
│       ├── export.js       # GET /api/projects/:id/export → .docx
│       └── llm.js          # POST /api/llm/upload|chat|import (AI Import)
├── frontend/
│   ├── vite.config.js      # Vite config (proxies /api → :3001 in dev)
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
│           ├── UsersPage.jsx
│           ├── UserGuidePage.jsx
│           └── LlmImportPage.jsx
└── package.json            # Root scripts (install:all, dev:*, build, start)
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
| `POST` | `/api/llm/upload` | Parse a `.docx` or `.pdf` to plain text (manager+) |
| `POST` | `/api/llm/chat` | Send a message to the LLM with conversation history (manager+) |
| `POST` | `/api/llm/import` | Bulk-insert extracted requirements into a module (manager+) |

All endpoints except `/api/auth/login` and `/api/auth/register` require a `Bearer` token in the `Authorization` header.

---

## AI Import

The **AI Import** feature (accessible via the sidebar for managers and admins) lets you populate a module with requirements extracted from an existing document.

### How it works

1. Navigate to **AI Import** in the sidebar.
2. Select the target **project** and **module**.
3. Upload a `.docx` or `.pdf` file (max 50 MB).
4. The document is parsed server-side and sent to the LLM, which extracts structured requirements automatically.
5. Chat with the AI to refine, add, or remove requirements from the list.
6. When satisfied, say something like *"import these"* — the AI will return a finalised JSON list.
7. Review the editable requirements table (adjust titles, descriptions, priorities, or statuses).
8. Click **Import N requirements** to bulk-insert them into the selected module.

### Configuration

The AI Import uses any **OpenAI-compatible API**. Configure it via `backend/.env`:

```env
LLM_BASE_URL=https://api.openai.com/v1   # or any compatible endpoint
LLM_API_KEY=your-api-key-here
LLM_MODEL=gpt-4o                          # or any model the provider supports
```

Supported providers include OpenAI, Groq, Together AI, LM Studio, Ollama (with OpenAI-compatible mode), and others. If `LLM_API_KEY` is not set, the upload and chat endpoints return a `503` error with a clear message.

### Supported file formats

| Format | Extension | Notes |
|--------|-----------|-------|
| Word (Open XML) | `.docx` | Full text extraction via `mammoth` |
| PDF | `.pdf` | Text extraction via `pdf-parse`; scanned/image-only PDFs return no text |

> Old binary Word format (`.doc`) is not supported. Save as `.docx` first.

---

## Production Build

Build the frontend for production:

```bash
npm run build:frontend
# Output: frontend/dist/
```

When `frontend/dist/` is present, the backend automatically detects and serves it as a static site — no separate static file server or proxy is needed.

To run the backend in production mode:

```bash
npm run start:backend
```

---

## Deploying to Railway

[Railway](https://railway.com) can host the full stack as a **single service** — the backend builds and serves the frontend automatically.

### 1. Push your code to GitHub

Ensure your repository is pushed to GitHub (or GitLab / Bitbucket).

### 2. Create a new Railway project

1. Go to [railway.com](https://railway.com) and sign in.
2. Click **New Project → Deploy from GitHub repo**.
3. Select your repository. Railway will detect the `railway.toml` configuration automatically.

### 3. Set environment variables

In your Railway service, open **Variables** and add:

| Variable | Value |
|---|---|
| `JWT_SECRET` | A long random string (see below) |
| `LLM_BASE_URL` | Base URL of your LLM provider (e.g. `https://api.openai.com/v1`) |
| `LLM_API_KEY` | Your LLM provider API key |
| `LLM_MODEL` | Model name (e.g. `gpt-4o`) |

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> Railway sets `PORT` automatically — do **not** override it.

### 4. Deploy

Railway will run the build command, then start the server. Once the deployment is green, click the generated **public URL** to open ReqPlan.

The build process:
1. Installs backend dependencies (`npm install --prefix backend`)
2. Installs frontend dependencies (`npm install --prefix frontend`)
3. Builds the React app (`npm run build:frontend` → `frontend/dist/`)
4. Starts the Express server, which serves both the API and the built frontend

### 5. Persistent storage (SQLite)

Railway's filesystem is **ephemeral** by default — the SQLite database (`backend/data.db`) will be reset on each redeploy. For a persistent database, add a **Railway Volume**:

1. In your service, go to **Settings → Volumes**.
2. Click **Add Volume** and mount it to `/app/backend`.
3. This directory persists across deploys and restarts.

> Without a Volume, data resets on every deploy. A Volume is strongly recommended for production use.

### Re-deploying updates

Push new commits to your connected branch — Railway will automatically rebuild and redeploy.

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend listening port (set automatically by Railway) |
| `JWT_SECRET` | `req-plan-secret-change-in-production` | JWT signing secret — **must** be changed in production |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Base URL for any OpenAI-compatible API (OpenAI, Groq, Together AI, LM Studio, etc.) |
| `LLM_API_KEY` | *(none)* | API key for the LLM provider |
| `LLM_MODEL` | `gpt-4o` | Model name to use (must be supported by the configured provider) |

Create `backend/.env` for local development:

```bash
# backend/.env
JWT_SECRET=your-long-random-secret
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=your-api-key-here
LLM_MODEL=gpt-4o
```

Set `JWT_SECRET` to a long random string in production:

```bash
JWT_SECRET=your-long-random-secret npm run start:backend
```

---

## Database

The SQLite database file is created automatically at `backend/data.db` on first run. No setup is required. The schema and any migrations run at startup.

To reset the database, delete `backend/data.db` and restart the backend.
