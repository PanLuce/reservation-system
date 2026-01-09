# 🎯 Centrum Rubáček - Reservation System

A complete reservation management system for exercise classes with lessons, participants, and substitution tracking.

## ✨ Features

- 📅 **Lesson Management** - Create, edit, delete lessons with capacity tracking
- 👥 **Participant Registration** - Register participants with auto-waitlist when full
- 🔄 **Substitution System** - Track missed lessons and allow makeup registration
- 📊 **Excel Import** - Bulk import participants from Excel files
- 💾 **SQLite Database** - All data persists across restarts
- 🎨 **Beautiful UI** - Modern, responsive interface in Czech language

## 🚀 Quick Start

### **Option 1: Test UI Only (No Setup)**

1. Open `standalone.html` in your browser
2. Click around to test all features with mock data
3. Perfect for UI testing!

### **Option 2: Run Full Server with Database**

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

The system now uses **SQLite** for data persistence:

- **Location**: `data/reservations.db`
- **Auto-created** on first run
- **Sample data** seeded automatically
- **Survives server restarts** - your data is safe! ✨

### Backup Your Data

```bash
# Simple backup
cp data/reservations.db data/backup-$(date +%Y%m%d).db
```

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
- **Database**: SQLite (better-sqlite3) ✨
- **Frontend**: HTML + CSS + JavaScript
- **Testing**: Playwright (19/19 tests passing ✅)
- **Linting**: Biome

## 📝 Project Structure

```
reservation-system/
├── src/                    # Business logic
│   ├── database.ts         # Database layer ✨
│   ├── calendar-db.ts      # DB-backed calendar ✨
│   ├── registration-db.ts  # DB-backed registrations ✨
│   └── ...
├── server.ts               # API server
├── public/                 # Frontend
├── data/                   # Database (auto-created) ✨
│   └── reservations.db     # Your data lives here!
└── standalone.html         # Test version
```

## ✅ What's New

### Database Persistence ✨
- All lessons, participants, and registrations now saved to SQLite
- Data survives server restarts and crashes
- Easy to backup (just copy the .db file)
- No external database server needed!

---

**Ready to start?** Run `npm start` and open http://localhost:3000! 🚀