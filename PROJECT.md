# Project: Fleet & Workforce Management React Native/Expo Application Refactoring

## Architecture
- **Frontend**: React Native with Expo SDK 54, `@react-navigation/native-stack`, React Context API (`AuthContext`, `SiteContext`), Stitch design system styling/components, custom `ErrorCard` component.
- **Backend**: FastAPI (Python), SQLAlchemy ORM, SQLite (`fleet_app.db`), Pydantic schemas, JWT authentication, modular routers (`auth`, `site`, `trip`, `workforce`).
- **Data Partitioning**: `sites` table + mandatory `site_id` foreign key across operational models (`trip_logs`, `attendance`, `daily_ledger`, `leave_requests`, `advance_requests`, `vehicle_emi`, `users`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Site Context & Global Site Selection | Global `SiteContext` provider, site selector modal/dropdown component | M1 | R1 |
| 2 | Site-Wise Database Filtering & Schemas | `Site` model, migration adding `site_id` foreign key to operational tables & default site seed | M2 | R2 |
| 3 | Site Management API & Router | Backend CRUD routes (`POST /sites`, `GET /sites`) | M2 | R2 |
| 4 | Backend Endpoint Site-Filtering | Filtering `/trips/`, `/workforce/daily-ledger`, `/workforce/attendance`, `/workforce/leaves`, `/workforce/advances`, `/workforce/emi` by `site_id` | M2 | R2 |
| 5 | Home Screen & Big Navigation Cards | `HomeScreen.js` layout featuring Site Selector header and 4 clean big cards (Daily Ledger, HR Management, Log Book, Site Management) with Stitch design system styling | M3 | R1 |
| 6 | Modular Standalone Feature Screens | `DailyLedgerScreen`, `HRManagementScreen`, `LogBookScreen`, `SiteManagementScreen` with site-filtered data fetching | M3 | R1, R2 |
| 7 | Error Alert Cards & Query Fallbacks | `ErrorCard.js` reusable component, fallback alert cards on fetch failures across screens | M4 | R1 |
| 8 | Mock Data Removal & Dynamic Populating | Zero mock data remaining: replace hardcoded trip IDs, hardcoded placeholders, fallbacks with dynamic API data | M4 | R1, R2 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Site Context & Frontend State | Create `SiteContext.js` & `SiteSelector.js` in frontend | None | COMPLETED |
| 2 | Backend Multi-Site DB & APIs | `Site` model, DB migration (`site_id`), `/sites` router, API query filtering | None | COMPLETED |
| 3 | UI Navigation, Home Screen & Feature Screens | `HomeScreen` with 4 big cards, Stitch styling, `HRManagementScreen`, `LogBookScreen`, `SiteManagementScreen`, `AppNavigator` updates | M1, M2 | COMPLETED |
| 4 | Error Cards & Mock Data Cleanup | `ErrorCard.js`, API error fallbacks across all screens, zero mock data cleanup | M3 | COMPLETED |
| 5 | HR Detail Profile Screen | Redesign User Card and add Human Resource Detail profile screen | M4 | IN_PROGRESS |

## Interface Contracts
### Site Management Contract
- `GET /sites`: returns list of site objects `[{ id, name, location, code, status, created_at }]`
- `POST /sites`: body `{ name, location, code }`, returns created site object `{ id, name, ... }`
- `GET /trips/?site_id={site_id}&start_date={start_date}&end_date={end_date}`: returns array of `TripLog` objects filtered by `site_id`
- `GET /workforce/daily-ledger?site_id={site_id}&date={date}`: returns `DailyLedger` summary & entries filtered by `site_id`
- `GET /workforce/attendance?site_id={site_id}&date={date}`: returns attendance records filtered by `site_id`
- `DELETE /auth/designations/{id}/`: deletes a custom designation
- `GET /auth/designations/`: gets designations

## Code Layout
- `backend/models/site.py`: `Site` SQLAlchemy database model
- `backend/models/`: `user.py`, `trip.py`, `workforce.py` with `site_id` FKs
- `backend/routers/site.py`: FastAPI routes for site registration and listing
- `backend/routers/`: `trip.py`, `workforce.py` with `site_id` filtering
- `backend/migrate_add_site_id.py`: Database migration script
- `backend/migrate_profile_fields.py`: Database migration for user profile fields
- `frontend/src/context/SiteContext.js`: Global site state provider
- `frontend/src/components/SiteSelector.js`: Site selection modal/header dropdown
- `frontend/src/components/ErrorCard.js`: Error alert component
- `frontend/src/screens/HomeScreen.js`: Home screen with site selector and 4 Big Navigation Cards
- `frontend/src/screens/HRManagementScreen.js`: Standalone HR screen
- `frontend/src/screens/LogBookScreen.js`: Standalone Log Book screen
- `frontend/src/screens/SiteManagementScreen.js`: Site list and registration screen
- `frontend/src/navigation/AppNavigator.js`: Stack navigator routing to HomeScreen and feature screens
- `remaining-work.md`: Guidelines for profile and card layout updates.
