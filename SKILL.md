---
name: ota-update-versioning
description: >-
  Standard operating procedure for performing OTA (Over-The-Air) updates.
  Enforces lightweight OTA-first workflow: update UI version strings (Login & Home screen)
  so clients can verify updates without downloading new APKs. Do NOT build local APKs
  for routine updates.
---

# OTA Update & UI Versioning Protocol

## Core Philosophy: OTA-First (No APK Downloads for Clients)
- **Goal**: Clients must receive all UI and logic changes automatically over the air without downloading or installing new APKs.
- **UI Version Verification**: Update the displayed version text in the Login screen and Home screen so the client can visually confirm they are running the latest update (e.g. `v3.6`, `v3.7`, `v3.8`, etc.).
- **Do NOT Build APKs for Routine Updates**: Avoid running heavy `./gradlew assembleRelease` builds for routine feature/UI updates unless explicitly requested for Google Play Store publishing.

---

## 📋 Standard OTA Workflow

### 1. Update UI Version Strings
Update the displayed version string in:
1. **Login Screen**: [`frontend/src/screens/LoginScreen.js`](file:///D:/gopalagrawal/frontend/src/screens/LoginScreen.js)
   ```jsx
   <Text style={styles.centerVersionTag}>App Version: vX.X</Text>
   ```
2. **Home Screen**: [`frontend/src/screens/HomeScreen.js`](file:///D:/gopalagrawal/frontend/src/screens/HomeScreen.js)
   ```jsx
   <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '800' }}>• vX.X</Text>
   ```

### 2. Runtime Version Compatibility
- Keep `frontend/app.json` compatible with the installed client runtime (or match the installed app's `runtimeVersion` / `version`) so existing installed APKs seamlessly download and apply the update.

### 3. Publish OTA Update
Publish the update via EAS:
```bash
cd frontend
npx eas-cli update --branch production --message "vX.X: <Summary of changes>"
```

### 4. Play Store Builds (Only When Publishing)
- Full APK / AAB compilation and `versionCode` increments in `app.json` are performed only when preparing a formal release for Google Play Store publishing.
