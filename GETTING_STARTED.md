# 🚀 Getting Started - Centrum Rubáček Reservation System

## 📋 How to Run Locally

### 1. Start the Server

Open your terminal in this folder and run:

```bash
npm start
```

You should see:
```
🚀 Reservation System running at http://localhost:3000
📅 Sample lessons loaded

✨ Open http://localhost:3000 in your browser
```

### 2. Open in Browser

Open your web browser and go to:
```
http://localhost:3000
```

## 🎯 What You Can Do

### 📅 **Lekce (Lessons) Tab**
- View all lessons with capacity bars
- Add new lessons (click "+ Přidat Lekci")
- Delete lessons
- See real-time enrollment status

### 👥 **Registrace (Registration) Tab**
- Register participants to lessons
- Automatic waitlist when lesson is full
- Form with name, email, phone, age group

### 🔄 **Náhradní Lekce (Substitution) Tab**
- Select age group to see available makeup lessons
- Shows only lessons with available spots
- Filter by age group automatically

### 📊 **Import Excel Tab**
- Upload Excel file with participants
- Bulk register multiple participants at once
- Excel format guide included in the tab

## 📝 Excel File Format

Your Excel file should have these columns:
- **name** - Participant name
- **email** - Email address
- **phone** - Phone number
- **ageGroup** - One of: "3-12 months", "1-2 years", "2-3 years", "3-4 years"

Example:
| name | email | phone | ageGroup |
|------|-------|-------|----------|
| Jana Nováková | jana@example.cz | +420777888999 | 3-12 months |
| Petr Svoboda | petr@example.cz | +420666555444 | 1-2 years |

## 🔧 Development Mode

If you want auto-reload when making changes:

```bash
npm run dev
```

This will restart the server automatically when you edit code.

## 🛑 Stop the Server

Press `Ctrl+C` in the terminal to stop the server.

## 💡 Sample Data

The system loads with 3 sample lessons automatically:
- Monday 10:00 - CVČ Vietnamská (3-12 months)
- Tuesday 14:00 - CVČ Jeremiáše (1-2 years)
- Wednesday 10:00 - DK Poklad (2-3 years)

You can delete these and add your own!

## 🎨 Features

✅ **Real-time Updates** - Changes reflect immediately
✅ **Beautiful UI** - Modern, responsive design
✅ **Mobile Friendly** - Works on all devices
✅ **Czech Language** - All text in Czech
✅ **Capacity Management** - Visual bars show availability
✅ **Waitlist Support** - Auto-adds to waitlist when full
✅ **Excel Import** - Bulk operations made easy

## 📞 Need Help?

If something doesn't work:
1. Make sure `npm start` shows no errors
2. Check that port 3000 is available
3. Try refreshing the browser

Enjoy testing your reservation system! 🎉
