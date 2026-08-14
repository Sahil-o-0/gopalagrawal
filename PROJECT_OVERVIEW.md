# Project Overview & Architecture Guide

Welcome to the **Fleet and Workforce Management System** project. This documentation explains the architecture of the application, how the backend and frontend components interact, the data structures used, and the file-by-file structure of the codebase.

---

## 🏗️ System Architecture

The application is structured as a client-server architecture split into two main directories:

1. **`backend/`**: A REST API built with **FastAPI** (Python), using **SQLAlchemy** with an **SQLite** database (`fleet_app.db`) for storage.
2. **`frontend/`**: A mobile application built with **React Native / Expo**, supporting offline data collection, queue-based background synchronization, and a Role-Based Access Control (RBAC) user interface with **multi-site management**.

---

## 🌐 Multi-Site Architecture

Every major data entity (`TripLog`, `Attendance`, `LeaveRequest`, `AdvanceWageRequest`, `VehicleEMI`, `FinancialLedger`, `StaffLedger`, `DailyLedger`) now carries a **`site_id` foreign key** pointing to the `sites` table. This enables independent data isolation per site.

---

## 📱 App Navigation Flow (Post-Refactor)

```
Login Screen
    │
    └─► Home Screen  ← SiteSelector + Big Nav Cards
            ├── 📒 Daily Ledger  (Admin/Manager)
            ├── 🚛 Log Book      (All roles)
            ├── 👷 HR/Workforce  (Admin/Manager)
            └── 🏗️ Site Mgmt    (Admin/Manager)
```

After login, all users land on `HomeScreen` and **must select a site** before navigating to any feature screen. Cards are role-filtered.

---

## 📁 Repository Directory Structure

### Root Files
* [**`clean_file.py`**](file:///D:/GopalAgrawal/clean_file.py): Helper utility script.
* [**`check_data.py`**](file:///D:/GopalAgrawal/check_data.py): Script to check or inspect database records.
* [**`sync_data.py`**](file:///D:/GopalAgrawal/sync_data.py): Script to test or perform data synchronization tasks.
* [**`test_api.py`**](file:///D:/GopalAgrawal/test_api.py) / [**`test_fastapi.py`**](file:///D:/GopalAgrawal/test_fastapi.py) / [**`test_sqlalchemy.py`**](file:///D:/GopalAgrawal/test_sqlalchemy.py) / [**`test_token.py`**](file:///D:/GopalAgrawal/test_token.py): Testing and verification scripts.

---

### 🖥️ Backend (`backend/`)

#### Core Configuration
* [**`backend/main.py`**](file:///D:/GopalAgrawal/backend/main.py): FastAPI entry point. Registers all routers: `site`, `auth`, `trip`, `workforce`. Initializes all DB tables on startup.
* [**`backend/database.py`**](file:///D:/GopalAgrawal/backend/database.py): SQLAlchemy engine, session factory, and `get_db` dependency. Defaults to SQLite (`fleet_app.db`).
* [**`backend/dependencies.py`**](file:///D:/GopalAgrawal/backend/dependencies.py): JWT token validation, role-guarded dependencies (`get_current_active_user`, `get_admin_user`, `get_manager_user`), and `validate_site_exists` helper.
* [**`backend/requirements.txt`**](file:///D:/GopalAgrawal/backend/requirements.txt): All Python package dependencies.

#### Database Models (`backend/models/`)
* [**`backend/models/site.py`**](file:///D:/GopalAgrawal/backend/models/site.py): **`Site`** table — `id`, `name`, `location`, `code`, `status`, `created_at`.
* [**`backend/models/user.py`**](file:///D:/GopalAgrawal/backend/models/user.py): **`User`** model and `UserRole` enum (`ADMIN`, `MANAGER`, `STAFF`).
* [**`backend/models/trip.py`**](file:///D:/GopalAgrawal/backend/models/trip.py): **`TripLog`** — logistics trips with `site_id`, odometer readings, fuel tracking, image URLs.
* [**`backend/models/workforce.py`**](file:///D:/GopalAgrawal/backend/models/workforce.py): `Attendance`, `LeaveRequest`, `AdvanceWageRequest`, `VehicleEMI`, `FinancialLedger`, `StaffLedger`, `DailyLedger` — all with `site_id`.

#### Schemas (`backend/schemas/`)
* [**`backend/schemas/site.py`**](file:///D:/GopalAgrawal/backend/schemas/site.py): `SiteCreate`, `SiteUpdate`, `SiteResponse` Pydantic models.
* [**`backend/schemas/user.py`**](file:///D:/GopalAgrawal/backend/schemas/user.py): User creation, token, and response schemas.
* [**`backend/schemas/trip.py`**](file:///D:/GopalAgrawal/backend/schemas/trip.py): Trip log create/update/response schemas.
* [**`backend/schemas/workforce.py`**](file:///D:/GopalAgrawal/backend/schemas/workforce.py): Attendance, leave, advance, ledger schemas.

#### Routers (`backend/routers/`)
* [**`backend/routers/site.py`**](file:///D:/GopalAgrawal/backend/routers/site.py): **`/sites`** CRUD — list, create, get by ID, update. MANAGER/ADMIN to create/update.
* [**`backend/routers/auth.py`**](file:///D:/GopalAgrawal/backend/routers/auth.py): Signup, login (JWT token), user profile.
* [**`backend/routers/trip.py`**](file:///D:/GopalAgrawal/backend/routers/trip.py): Trip log CRUD with site-aware filtering.
* [**`backend/routers/workforce.py`**](file:///D:/GopalAgrawal/backend/routers/workforce.py): Attendance, leaves, advances, ledger entries — all site-aware.

---

### 📱 Frontend (`frontend/`)

#### Root Files
* [**`frontend/App.js`**](file:///D:/GopalAgrawal/frontend/App.js): App root — wraps everything in `AuthProvider` → `SiteProvider` → `NavigationContainer` → `AppNavigator`.
* [**`frontend/src/config.js`**](file:///D:/GopalAgrawal/frontend/src/config.js): `API_BASE_URL` pointing to the live backend.

#### Navigation (`frontend/src/navigation/`)
* [**`frontend/src/navigation/AppNavigator.js`**](file:///D:/GopalAgrawal/frontend/src/navigation/AppNavigator.js): Stack navigator. Unauthenticated → Login. Authenticated → `HomeScreen` → role-filtered feature screens.

#### Context & State (`frontend/src/context/`)
* [**`frontend/src/context/AuthContext.js`**](file:///D:/GopalAgrawal/frontend/src/context/AuthContext.js): Manages `userToken`, `user`, `login`, `signup`, `logout`.
* [**`frontend/src/context/SiteContext.js`**](file:///D:/GopalAgrawal/frontend/src/context/SiteContext.js): Fetches all sites from `/sites`, stores selected site in `AsyncStorage` for persistence. Exposes `sites`, `selectedSite`, `setSelectedSiteId`, `fetchSites`, `loading`, `error`.
* [**`frontend/src/context/OfflineStorage.js`**](file:///D:/GopalAgrawal/frontend/src/context/OfflineStorage.js): Queues offline trip data to `AsyncStorage` for later sync.
* [**`frontend/src/context/useBackgroundSync.js`**](file:///D:/GopalAgrawal/frontend/src/context/useBackgroundSync.js): Listens for network recovery via NetInfo and auto-syncs queued offline data.

#### Screens (`frontend/src/screens/`)
* [**`frontend/src/screens/LoginScreen.js`**](file:///D:/GopalAgrawal/frontend/src/screens/LoginScreen.js): Login and admin signup form.
* [**`frontend/src/screens/HomeScreen.js`**](file:///D:/GopalAgrawal/frontend/src/screens/HomeScreen.js): ⭐ **New.** Site selector + big navigation cards (Ledger, Log Book, HR, Site Management). Role-filtered. Shows error card if site fetch fails.
* [**`frontend/src/screens/SiteManagementScreen.js`**](file:///D:/GopalAgrawal/frontend/src/screens/SiteManagementScreen.js): ⭐ **New.** Lists all sites. Allows switching active site. ADMIN/MANAGER can create new sites via bottom-sheet modal. Shows error cards and empty states.
* [**`frontend/src/screens/AdminDashboard.js`**](file:///D:/GopalAgrawal/frontend/src/screens/AdminDashboard.js): Full admin feature set (staff management, approvals, financial overview).
* [**`frontend/src/screens/ManagerDashboard.js`**](file:///D:/GopalAgrawal/frontend/src/screens/ManagerDashboard.js): Manager trip/attendance/advance workflows.
* [**`frontend/src/screens/StaffDashboard.js`**](file:///D:/GopalAgrawal/frontend/src/screens/StaffDashboard.js): Driver trip logging and personal ledger.
* [**`frontend/src/screens/DailyLedgerScreen.js`**](file:///D:/GopalAgrawal/frontend/src/screens/DailyLedgerScreen.js): Income/expense listings with filters.

#### Components (`frontend/src/components/`)
* [**`frontend/src/components/ErrorCard.js`**](file:///D:/GopalAgrawal/frontend/src/components/ErrorCard.js): ⭐ **New.** Reusable error display card with title, message, and optional retry button. Used anywhere a network request can fail.
* [**`frontend/src/components/SiteSelector.js`**](file:///D:/GopalAgrawal/frontend/src/components/SiteSelector.js): Dropdown/picker to switch the active site, integrated into HomeScreen.
* [**`frontend/src/components/TripLogForm.js`**](file:///D:/GopalAgrawal/frontend/src/components/TripLogForm.js): Full trip entry form with photo capture support.
* [**`frontend/src/components/AttendanceCalendar.js`**](file:///D:/GopalAgrawal/frontend/src/components/AttendanceCalendar.js): Calendar view for marking/viewing attendance.

---

## 🔒 Role-Based Access Control (RBAC)

| Role | Home Screen Cards Visible | Key Operations |
| :--- | :--- | :--- |
| **`ADMIN`** | Ledger, Log Book, HR, Site Management | Full access — approvals, financials, site creation, staff management |
| **`MANAGER`** | Ledger, Log Book, HR, Site Management | Attendance, trips, advances, ledger entries, site creation |
| **`STAFF`** | Log Book only | Self trip logging, personal ledger view |

---

## 🔑 Default Development Accounts (from `backend/seed.py`)

| Username | Password | Role |
|----------|----------|------|
| `admin` | `123` | ADMIN |
| `manager` | `123` | MANAGER |
| `staff` | `123` | STAFF |
