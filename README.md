# 🎯 Centrum Rubáček - Reservation System

A complete reservation management system for exercise classes with lessons, participants, and substitution tracking.

## ✨ Features

- 📅 **Lesson Management** - Create, edit, delete lessons with capacity tracking
- 👥 **Participant Registration** - Register participants with auto-waitlist when full
- 🔄 **Substitution System** - Track missed lessons and allow makeup registration
- 📊 **Excel Import** - Bulk import participants from Excel files
- 💾 **Turso/LibSQL Database** - All data persists across restarts
- 🎨 **Beautiful UI** - Modern, responsive interface in Czech language

## 🚀 Quick Start

```bash
# Install dependencies (first time only)
npm install

# Start the server
npm start

# Open in browser
# http://localhost:3000
```

Server runs on **port 3000** by default.

## 💾 Database Persistence

The system uses **@libsql/client** (Turso-compatible) for data persistence:

- **Local dev**: `file:data/reservations.db` (auto-created on first run)
- **Production**: Remote Turso DB via `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN`
- **Sample data** seeded automatically when database is empty
- **Survives server restarts** - your data is safe!

## 📖 API Endpoints

### Lessons
- `GET /api/lessons` - List all lessons
- `POST /api/lessons` - Create new lesson
- `PUT /api/lessons/:id` - Update lesson
- `DELETE /api/lessons/:id` - Delete lesson

### Registrations
- `POST /api/registrations` - Register participant
- `GET /api/registrations/lesson/:lessonId` - Get registrations

### Excel Import
- `POST /api/excel/import` - Upload Excel file with participants

## 🛠️ Development

```bash
# Start with auto-reload
npm run dev

# Run tests
npm test

# Run tests with UI
npm run test:ui

# Lint code
npm run lint
```

## 📊 Excel File Format

| name | email | phone | ageGroup |
|------|-------|-------|----------|
| Jana Nováková | jana@example.cz | +420777888999 | 3-12 months |

Age groups: `3-12 months`, `1-2 years`, `2-3 years`, `3-4 years`

## 🎯 Technology Stack

- **Backend**: TypeScript + Node.js + Express
- **Database**: @libsql/client (Turso DB)
- **Frontend**: HTML + CSS + JavaScript
- **Testing**: Playwright
- **Linting**: Biome

## 📝 Project Structure

```
reservation-system/
├── src/                    # Business logic (18 modules)
│   ├── database.ts         # DB layer: schema + per-entity gateways
│   ├── auth.ts             # Authentication (bcrypt + sessions)
│   ├── session-store.ts    # libSQL-backed express-session store
│   ├── registration-db.ts  # Registration/booking business logic
│   ├── calendar-db.ts      # DB-backed calendar + bulk lesson creation
│   ├── program.ts / course.ts / lesson.ts / participant.ts / credit.ts  # Domain models
│   ├── email-factory.ts / email-service.ts  # Email (nodemailer)
│   ├── ods-loader.ts       # Participant import from .ods spreadsheets
│   └── age-groups.ts / registration-rules.ts / env-flags.ts / logger.ts / types.ts
├── server.ts               # Express API server (routes + middleware)
├── public/                 # Frontend (static MPA: index.html, login.html, app.js)
├── scripts/                # backup-db.ts (scheduled DB dump)
├── tests/                  # Playwright E2E specs
└── data/                   # Local SQLite (auto-created)
    └── reservations.db     # Dev data (Turso in production)
```

## ✅ What's New

### Turso DB Migration
- Migrated from better-sqlite3 to @libsql/client for Turso compatibility
- Local development uses file-based SQLite via libsql
- Production uses remote Turso database
- Deployed on Render.com (CI via GitHub Actions)

---

**Ready to start?** Run `npm start` and open http://localhost:3000! 🚀