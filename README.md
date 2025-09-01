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

## Geocoding (no Google)

The app does not use Google services. For place search:

- Preferred: MapTiler Geocoding (set `EXPO_PUBLIC_MAPTILER_KEY` in `.env`).
- Fallback: OpenStreetMap Nominatim (respecting usage policy with a custom User-Agent).

## Map tiles (avoid OSM blocks)

The app renders maps via `react-native-maps` `UrlTile`. By default it points to OpenStreetMap's public tile server for local development. The public OSM tiles are volunteer-run and will block apps that don't meet their usage policy, especially mobile apps.

To avoid "App is not following the tile usage policy" blocks, configure a proper tile provider:

- Option A (recommended): MapTiler
  - Create a free key at https://www.maptiler.com/
  - Add to your `.env`:

    ```env
    EXPO_PUBLIC_MAPTILER_KEY=YOUR_KEY
    ```

  - This auto-switches tiles to `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=...`.

- Option B: Custom tile URL
  - Set any compatible template with `{z}/{x}/{y}` placeholders:

    ```env
    EXPO_PUBLIC_TILE_URL_TEMPLATE=https://your.tiles.provider/path/{z}/{x}/{y}.png?token=KEY
    ```

Notes:
- Environment variables must be prefixed with `EXPO_PUBLIC_` to be available at runtime.
- After changing env, restart the bundler (and rebuild the dev client if native config changed).
- The map shows a small attribution label; keep it visible to comply with provider terms.

## Android native map (MapLibre)

Android uses the MapLibre RN SDK (react-native-maplibre-gl). It pulls its native artifacts from Maven Central — no Mapbox downloads token is required. Tiles/geocoding still come from your configured providers (MapTiler/OSM).


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
