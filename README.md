# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Google Maps API keys (dev client)

This app uses a dynamic config (`app.config.ts`) to inject Google Maps keys into native builds.

Set keys via environment variables (don’t hardcode secrets):

- `GOOGLE_MAPS_API_KEY` (Android)
- `GOOGLE_MAPS_API_KEY_IOS` (iOS; optional, falls back to the Android key)

Local (PowerShell on Windows):

```pwsh
$env:GOOGLE_MAPS_API_KEY='YOUR_ANDROID_KEY'; npx expo start --dev-client
```

EAS Build (recommended):

1. Add secrets in Expo Dashboard: `GOOGLE_MAPS_API_KEY`, optional `GOOGLE_MAPS_API_KEY_IOS`.
2. Rebuild the dev client:

```pwsh
npx eas build --platform android --profile development
```

Note: Native changes (like API keys) require reinstalling the dev client.

## Location Search (Google Places)

The note screens will use the Google Places Autocomplete + Details APIs (if a key is provided) for richer location suggestions (names + formatted addresses). If no key is set the app falls back to the built‑in `expo-location` geocoder.

Setup:

1. Create a restricted API key in Google Cloud Console with the following APIs enabled:
   - Places API
   - Maps SDK for Android (if using maps)
   - Maps SDK for iOS (if using maps)
2. Restrict the key by package name + SHA (Android) and bundle ID (iOS) for native builds, and optionally HTTP referrers if you build a web version.
3. Expose the key to the app (public – do NOT reuse a secret server key):

```pwsh
$env:EXPO_PUBLIC_GOOGLE_PLACES_KEY='YOUR_RESTRICTED_KEY'; npx expo start --dev-client
```

4. Rebuild your dev client if you changed native map keys.

Notes:
- Only the first 5 predictions request place details (to limit quota usage).
- Results are cached in-memory per session to reduce network calls while typing.
- Fallback geocoder still runs when Places returns no results (or key absent).


## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
