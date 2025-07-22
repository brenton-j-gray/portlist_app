# Copilot Instructions for cruise-journal-pro

## Project Overview
- This is an Expo React Native app using file-based routing (see the `app/` directory).
- Navigation is managed entirely by Expo Router, which automatically wraps the app in a `NavigationContainer` (do not add another one).
- Example and starter code is in `app-example/`; the real app code lives in `app/`.

## Key Patterns & Conventions
- **Screens**: Place new screens in `app/` following file-based routing conventions.
- **Components**: Shared UI components are in `components/` (with a `ui/` subfolder for icons and tab bar backgrounds).
- **Hooks**: Custom hooks are in `hooks/`.
- **Constants**: App-wide constants (e.g., colors) are in `components/constants/`.
- **No nested NavigationContainers**: Only use the one provided by Expo Router.
- **Styling**: Use `StyleSheet.create` for styles in components.
- **Font loading**: See `app-example/app/_layout.tsx` for how to load custom fonts with `expo-font`.

## Developer Workflows
- **Install dependencies**: `npm install`
- **Start the app**: `npx expo start`
- **Reset to a blank project**: `npm run reset-project` (moves starter code to `app-example/` and creates a blank `app/`)
- **File-based routing**: Add new screens as files in `app/` (see Expo Router docs for advanced routing).

## Integration & External Dependencies
- Uses `expo-router` for navigation.
- Uses `expo-font` for custom fonts (see `assets/fonts/`).
- Images and icons are in `assets/images/`.

## Examples
- See `app-example/app/_layout.tsx` for a full-featured layout with theming and font loading.
- See `app/_layout.tsx` for the minimal Expo Router stack setup.

## Special Notes
- Do not wrap the app in another `NavigationContainer`.
- When adding new screens, follow the file-based routing conventions.
- Use the `reset-project` script to start fresh if needed.

---

If you are unsure about a pattern, check the `app-example/` directory for a more complete example, or consult the Expo Router documentation.
