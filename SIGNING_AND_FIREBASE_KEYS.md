# App Signing & Firebase Configuration Reference

## Android Package & Identity
- **Package Name / Application ID**: `com.aadharshila.fleet`
- **Current App Version**: `5.4`
- **Domain**: `https://aadarshila.dummysite.cloud`

---

## Firebase Configuration
- **Project ID**: `gopal-agrawal-80aea`
- **Project Number**: `632140280981`
- **Storage Bucket**: `gopal-agrawal-80aea.firebasestorage.app`
- **Web API Key**: `AIzaSyBWikwx4W3Lzo9ZBkv6fzroWArNqWWvvi4`
- **Android App ID (`com.aadharshila.fleet`)**: `1:632140280981:android:3b7152b2b0478c58e7179c`

---

## Certificate Fingerprints (Local / Build Keystore)
- **Keystore Location**: `frontend/android/app/debug.keystore`
- **Keystore Pass**: `android`
- **Key Alias**: `androiddebugkey`
- **Key Pass**: `android`

### Fingerprints
- **SHA-1**:
  ```text
  5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
  ```
- **SHA-256**:
  ```text
  FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C
  ```

---

## Google Play Store Publishing Notes
When publishing on the Google Play Store with **Google Play App Signing**:
1. Google Play generates its own **App Signing Key Certificate**.
2. Once the app is in Google Play Console (under *Release > Setup > App Integrity*), copy the **App signing key certificate SHA-1 and SHA-256** and add them to the Firebase Console under `com.aadharshila.fleet`.
3. The Upload Key will match the SHA fingerprints listed above.
