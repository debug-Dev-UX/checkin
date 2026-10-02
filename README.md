# Chafé • Café & Lounge Management System

A modern full-stack web application and Admin Dashboard built with **Laravel 12** (Backend), **React 19 with Vite** (Frontend), and **MySQL** (Database).

---

## Dashboard Sections

### 1. 📊 Overview
- **Real-Time KPIs**: Currently Seated / Inside Chafé, Today's Registered Visits, Checked Out Departures, and Total Historical MySQL Records.
- **Right-Aligned Controls**: Search bar, role filter dropdown (Dine-in, Baristas, Workspace, Suppliers), Bulk Check-Out, and CSV export.
- **Attendance Data Grid**: Live guest list with one-click **"Check Out"** action and real-time duration tracking.

### 2. ⏱️ Performance (Staff Punctuality & Attendance)
- **Staff Performance Tracking**: Evaluates whether baristas and staff arrived **On Time (Good)** or **Late**.
- **Punctuality Score**: Visual percentage meter and performance ratings (*Star Performer*, *Good Standing*, *Needs Improvement*).
- **Shift Schedule vs Actual Arrival**: Compares scheduled start time (e.g. 07:00 AM) against actual check-in timestamp and tracks late delay minutes (e.g. `+18 mins late`).
- **Hours Worked**: Auto-calculates total hours logged per barista.

### 3. 👥 Staff Management
- **Staff Roster Table**: View full staff directory with assigned roles (Head Barista, Senior Latte Artist, Artisan Pastry Chef, Front Counter & Cashier, Shift Supervisor, Roastery Specialist).
- **Role & Shift Assignment**: Update staff roles and shift hours (e.g. `07:00 - 15:30`).
- **Create Staff Member**: Modal to add new team members with hourly rate and shift schedules.
- **Live On-Duty Indicator**: Real-time badge showing who is currently on shift.

### 4. 📱 Control Station (QR Codes & Short Today View)
- **Interactive QR Code Generator**:
  - **☕ Guest Table Check-In QR**: Contactless table registration and order notes for customers.
  - **⏱️ Staff Shift QR**: Allows baristas to clock in upon arrival.
  - **Express Check-Out QR**: Fast exit scan.
  - **Flyer Print & Link Copy**: One-click printable flyer for counter and table displays.
- **Short Today-Only Activity Log**: Compact, focused view showing **strictly today's** arrivals and departures with quick checkout actions.

### 5. ⚙️ Settings
- **Café Profile**: Brand name (*Chafé*), Operating Hours, and Guest Wi-Fi details.
- **Punctuality Grace Period**: Configure how many minutes after shift start an arrival is marked as "Late" (default: 10 mins).
- **Seating Capacity**: Set max indoor seating limit.
- **Demo Data Reset**: Instant re-seed button to refresh test records anytime.

---

## Project Structure

```text
Checkin/
├── backend/                  # Laravel 12 API Application
│   ├── .env                  # MySQL configuration (checkin_db)
│   ├── app/
│   │   ├── Http/Controllers/Api/
│   │   │   ├── CheckinController.php   # Overview & checkin/checkout API
│   │   │   ├── StaffController.php     # Staff roster & performance analytics
│   │   │   └── ControlController.php   # Today's short logs, QR, settings
│   │   └── Models/
│   │       ├── Checkin.php             # Checkin model with punctuality fields
│   │       └── Staff.php               # Staff model with roles and shift times
│   ├── database/migrations/  # Migrations: checkins, checkout fields, staff table
│   ├── routes/api.php        # Registered REST API routes
│   └── tests/Feature/        # PHPUnit test suite (MySQL integrated)
│
└── frontend/                 # React 19 + Vite Dashboard
    ├── .env                  # Frontend API URL configuration
    ├── src/
    │   ├── App.jsx           # Tabbed Admin Dashboard (Overview, Performance, Staff, Control, Settings)
    │   ├── App.css           # Right-aligned header, glassmorphism, responsive styles
    │   └── index.css         # Chafé warm amber theme tokens
    └── package.json
```

---

## Running the Application

### 1. MySQL Database
Ensure MySQL (XAMPP / MariaDB) is active on port `3306`.
The application uses the `checkin_db` database.

### 2. Backend (Laravel)
```bash
cd backend
php artisan serve --host=127.0.0.1 --port=8000
```
- API Base URL: `http://127.0.0.1:8000/api`

### 3. Frontend (React + Vite)
```bash
cd frontend
npm run dev
```
- Web Application: `http://127.0.0.1:5173/`

---

## Running Automated Tests

### Backend Tests
```bash
cd backend
php artisan test
```
*12 feature & unit tests covering MySQL connection, staff CRUD, punctuality analytics, QR config, and settings.*

### Frontend Tests
```bash
cd frontend
npm test
```
