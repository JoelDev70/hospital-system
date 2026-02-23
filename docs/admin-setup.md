Admin setup and webhook integration

This document explains how to:
 - set a custom `admin` claim for a Firebase user (so they can access `pages/admin-approve.html`)
 - deploy recommended Firestore rules
 - configure an optional webhook/Cloud Function to notify approved/rejected doctors

1) Set admin custom claim (local/example)
-----------------------------------------
Requirements:
 - Service account JSON with permissions (Firebase Admin)
 - Node.js installed

Steps:
 - Copy `scripts/set-admin-claim.js` into a machine with `GOOGLE_APPLICATION_CREDENTIALS` set.
 - Install dependency and run:

   npm install firebase-admin
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
   node scripts/set-admin-claim.js <UID> true

Replace `<UID>` with the Firebase Auth UID of the user you want to make admin.

Note: After setting the claim, the user should sign out / sign in again so their ID token includes the new claim.

2) Deploy Firestore rules (recommended)
---------------------------------------
We added `firestore.rules` to the repo that contains a production template. Adapt as necessary then deploy with:

  firebase deploy --only firestore:rules

3) Configure webhook / Cloud Function
-------------------------------------
You can either use the included example Cloud Function `functions/approveDoctorFunction.js` or any HTTP webhook.

- If using the Cloud Function example:
  - Follow `functions/README.md` to install dependencies, set SMTP config, and deploy.
  - The function triggers automatically on `doctors/{uid}` document updates (status change).

- If you prefer an HTTP webhook, set `window.ADMIN_WEBHOOK_URL` in `pages/admin-approve.html` (or a site-wide config) to the webhook URL. `js/admin.js` will POST `{ userId, status }` after approve/reject.

4) Notes and security
---------------------
 - The admin UI performs a client-side check for the `admin` custom claim and will hide the UI for non-admin users. This is a convenience: enforce access server-side with Firestore rules (see `firestore.rules`).
 - Never grant admin claims to untrusted users. Keep service account keys and SMTP credentials secret.
 - For production email, prefer transactional email providers (SendGrid, Mailgun) and use environment-managed secrets.
