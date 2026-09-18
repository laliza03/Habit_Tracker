# HabitHub

HabitHub is a mobile-first habit tracker for daily fitness metrics, supplements, personal monthly goals, and shared partner goals. It is a Progressive Web App (PWA) and includes Capacitor configuration for Android and iOS.

## What works today

- Google sign-in with Firebase Authentication
- Device-only guest mode that persists daily logs, targets, supplements, and personal goals in the browser
- Daily logging for steps, water, calories, supplements, and affirmations
- Personal monthly goals with progress controls
- Secure, mutual partner linking and shared goals for signed-in users
- Installable PWA with offline app shell caching

Fitbit is intentionally disabled for now. The original implementation sent OAuth tokens into browser JavaScript; it will return only after token storage and refresh are implemented server-side.

## Prerequisites

- Node.js 20 or later
- A Firebase project with **Google** enabled under Authentication → Sign-in method
- A Firestore database

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. The checked-in `firebase-applet-config.json` supplies the client Firebase configuration. For a different Firebase project, replace it with its public web-app configuration.

3. Start the development server:

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000`.

4. Run release checks:

   ```bash
   npm run lint
   npm run build
   npm audit --omit=dev
   ```

## Firebase setup

Before public use, deploy [firestore.rules](firestore.rules) with the Firebase CLI or Firebase console. These rules require authenticated access and require both users to link one another before partner data is visible.

In Firebase Authentication, add every deployed domain to **Authorized domains**. Google sign-in will otherwise fail after deployment.

## Deploy the web/PWA app

1. Produce the static app:

   ```bash
   npm run build
   ```

2. Deploy the generated `dist/` directory to any HTTPS static host. HTTPS is required for service workers and PWA installation.

3. Configure your host to route unknown paths to `index.html` for the single-page app.

4. Add the final domain to Firebase Authentication’s authorized-domain list, then verify Google sign-in, guest persistence after a reload, and PWA installation on an actual phone.

The included Express server is useful for local development. For a static host, use `dist/`; do not expose the previous Fitbit OAuth routes.

## Android and iOS

After deploying a stable HTTPS web build, synchronize Capacitor:

```bash
npm run build
npm run cap:sync
npm run cap:open:android
# or
npm run cap:open:ios
```

Use Android Studio/Xcode to set signing, app identifiers, icons, privacy disclosures, and store metadata. Test sign-in and PWA fallbacks on physical devices before publishing.

## Security notes

- Never add Firebase admin credentials or API secrets to the browser bundle.
- Client Firebase configuration is public by design; Firestore rules enforce access control.
- Fitbit integration must store and refresh OAuth tokens on a trusted server, associated with the authenticated Firebase user. Do not re-enable token transfer through `postMessage`.
