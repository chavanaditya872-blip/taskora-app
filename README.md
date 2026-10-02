# Taskora

A production-style **Task Management Web Application** built with **FastAPI**, **PostgreSQL**, **SQLAlchemy**, **JWT auth**, and a vanilla-JS responsive frontend.

## Features

- User registration, login, logout (JWT + bcrypt)
- Full task CRUD: title, description, priority, status, category, due date, reminder
- Task statuses: To Do, In Progress, Completed, Cancelled
- Priorities: Low, Medium, High, Urgent
- Categories: Work, Personal, Study, Project, Important, Other (auto-seeded)
- Dashboard stats: Total, Pending, In Progress, Completed, Overdue + chart
- Views: All, Today, Upcoming, Pending, Completed, Overdue
- Search, filter, sort on tasks
- Real-time task updates via WebSockets (per-user scoped)
- Responsive UI (desktop/tablet/mobile)
- Full pytest suite
- Docker Compose support

## Tech Stack

**Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2, Alembic, python-jose, passlib[bcrypt], PostgreSQL
**Frontend:** HTML5, CSS3, ES6+ JS, Fetch API, WebSocket API
**Testing:** pytest + httpx

## System Requirements

- Python 3.11+
- PostgreSQL 14+
- Modern web browser
- (Optional) Docker Desktop

---

## 1. PostgreSQL Setup

Open `psql` as a superuser and run:

```sql
CREATE DATABASE taskora_db;
CREATE USER taskora_user WITH ENCRYPTED PASSWORD 'taskora_pass';
GRANT ALL PRIVILEGES ON DATABASE taskora_db TO taskora_user;
ALTER DATABASE taskora_db OWNER TO taskora_user;
\c taskora_db
GRANT ALL ON SCHEMA public TO taskora_user;
```

## 2. Environment Variables

Copy `backend/.env.example` to `backend/.env` and edit:

```env
DATABASE_URL=postgresql+psycopg://taskora_user:taskora_pass@localhost:5432/taskora_db
SECRET_KEY=replace-with-a-long-random-secret
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000
```

## 3. Backend Setup

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

### Database migrations (Alembic)

```bash
# Initialize (first time only) — alembic/ folder is already scaffolded
alembic revision --autogenerate -m "init schema"
alembic upgrade head
```

The app also auto-creates tables on startup for convenience.

### Run the backend

```bash
uvicorn app.main:app --reload
```

- API root: http://127.0.0.1:8000/
- Swagger UI: http://127.0.0.1:8000/docs
- ReDoc: http://127.0.0.1:8000/redoc

## 4. Frontend Setup

The frontend is static. Serve the `frontend/` folder from any static server. Example:

```bash
cd frontend
python -m http.server 5500
```

Then open http://localhost:5500.

By default, `frontend/js/api.js` points to `http://127.0.0.1:8000`. Override by setting `window.TASKORA_API_BASE` before `api.js` loads if needed.

Make sure the backend `CORS_ORIGINS` includes your frontend origin.

## 5. Running with Docker Compose

```bash
docker compose up --build
```

- Backend: http://localhost:8000
- Docs: http://localhost:8000/docs
- Postgres: localhost:5432

## 6. API Documentation

### Authentication

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Obtain JWT |
| POST | `/api/auth/logout` | Logout (client discards token) |
| GET  | `/api/auth/me` | Current user profile |
| PUT  | `/api/auth/me` | Update current user |

### Tasks

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/tasks` | List tasks (filters: `view`, `status`, `priority`, `category_id`, `search`, `sort`, `order`) |
| GET | `/api/tasks/stats` | Aggregated statistics |
| GET | `/api/tasks/{task_id}` | Task details |
| POST | `/api/tasks` | Create task |
| PUT | `/api/tasks/{task_id}` | Update task |
| PATCH | `/api/tasks/{task_id}/status` | Change status |
| DELETE | `/api/tasks/{task_id}` | Delete task |

### Categories

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/categories` | List categories (seeds defaults) |
| POST | `/api/categories` | Create category |
| PUT | `/api/categories/{id}` | Rename category |
| DELETE | `/api/categories/{id}` | Delete category |

### WebSocket

Connect to `ws://127.0.0.1:8000/ws?token=<JWT>`. Events:
- `connected`
- `task.created`
- `task.updated`
- `task.status_changed`
- `task.deleted`

## 7. Testing

```bash
cd backend
pytest -v
```

Uses in-memory SQLite by default (no Postgres needed for tests).

## 8. Project Structure

```
Taskora/
├── backend/
│   ├── app/
│   │   ├── core/         # config, database, security
│   │   ├── models/       # SQLAlchemy models
│   │   ├── schemas/      # Pydantic schemas
│   │   ├── routers/      # auth, tasks, categories
│   │   ├── websocket/    # connection manager
│   │   └── main.py
│   ├── alembic/
│   ├── tests/
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   └── run.py
├── frontend/
│   ├── index.html login.html register.html
│   ├── dashboard.html task.html profile.html
│   ├── css/
│   └── js/
├── docker-compose.yml
└── README.md
```

## 9. Future Enhancements

- Task sharing / team workspaces
- Email reminders and digest notifications
- Recurring tasks
- Drag-and-drop Kanban board
- OAuth (Google/GitHub) login
- Refresh tokens + token revocation list
- File attachments on tasks
- Full i18n and dark mode

---

**License:** MIT