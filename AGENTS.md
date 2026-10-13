# Workspace Guidelines & Rules

## OTA Updates & UI Versioning Protocol
- **OTA-First Rule**: For all day-to-day feature, logic, and UI changes, deliver updates exclusively via OTA (Over-The-Air).
- **Do NOT compile local APKs** (`./gradlew assembleRelease`) for routine updates unless the user explicitly requests an APK for Google Play Store publishing.
- **UI Version Numbers**: To let the client verify they are on the latest update without downloading new APKs, update the version number in:
  1. [`frontend/src/screens/LoginScreen.js`](file:///D:/gopalagrawal/frontend/src/screens/LoginScreen.js) (`<Text style={styles.centerVersionTag}>App Version: vX.X</Text>`)
  2. [`frontend/src/screens/HomeScreen.js`](file:///D:/gopalagrawal/frontend/src/screens/HomeScreen.js) (`<Text ...>• vX.X</Text>`)
- **Runtime Compatibility**: Keep `app.json` compatible with the currently deployed client app runtime so installed APKs immediately receive and apply the OTA update.
