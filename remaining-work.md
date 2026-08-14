# Remaining Work: Human Resource Detail Profile View & User Card Refactoring

## 1. 📇 User Card Redesign (Staff Management list)
- **Path**: `frontend/src/screens/AdminDashboard.js` inside `renderUsersTab()`.
- **Changes**:
  - Remove the **View Ledger** button completely.
  - Make the entire user card touchable (`TouchableOpacity`) to open the new Profile Detail screen.
  - Display the profile photo at the left of the card.
  - Display Staff ID (`#${u.id}`) next to the photo.
  - Display full name in bold, followed by a small orange/green active status dot.
  - Display small grey text of their role/designation name below the name.
  - Display phone number.
  - Display site name.
  - Display "Add By: [username]" and the date/time of when the user was added.
  - Display the current balance (`Bal: ₹[amount]`):
    - Calculated by summing historical ledger entries from `dailyLedgerEntries` + `opening_balance`.
    - If the balance is negative, style the text in **red**.
    - If positive, style the text in **black**.

---

## 2. 👤 Profile Detail Screen / Modal
- **Trigger**: Tapping a user card in the Users list tab.
- **Header**:
  - Show `< Human Resource Detail` at the top left with a back action.
  - Show a vertical three-dots options menu at the top right.
- **Section 1: Accordion / Collapsible Header (`Basic Details`)**
  - Displays the card layout again with:
    - User Photo
    - Staff ID, Name & Role name
    - Phone number (with small call, WhatsApp, SMS icon actions next to it)
    - Balance field (in red if negative, black if positive)
    - Assigned Site name
    - Add By: [username] and the creation timestamp
    - Edited By: [username]
- **Section 2: Interactive Field Inputs (Read-Only / Edit mode)**
  - **Designation**: Displays the designation name (e.g. `Jcb Operator`).
  - **Name**: Displays full name (e.g. `रूप लाल`).
  - **Relation**: Radio buttons for **Father**, **Mother**, and **Husband** (based on `relative_relation`), and a text field for `Relative Name`.
  - **Employee of**: Radio buttons for **Departmental** and **Contractor** (based on `employee_of`), and a text field for `Department`.
  - **Employee ID**: Custom text field or database ID.
  - **Employment Type**: Radio buttons for **Permanent** and **Trial**.
  - **Reference**: Displays the creator's tag (e.g. `#1001 Gopal Agrawal (Adm)`).
  - **Current Working Site**: Displays the selected working site name.

---

## 3. 💾 Backend Setup (Completed)
- SQLite database tables successfully altered and models updated in `backend/models/user.py` and `backend/schemas/user.py` to support audit/profile fields:
  - `created_at` (DateTime)
  - `created_by` (String)
  - `employee_of` (String)
  - `department` (String)
  - `employee_id_custom` (String)
