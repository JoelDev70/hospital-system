/*
 Node script to set a custom claim 'admin' for a user UID using Firebase Admin SDK.
 Usage (local):
 1) npm init -y
 2) npm install firebase-admin
 3) export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
 4) node set-admin-claim.js <UID> true

 This script sets the custom claim 'admin' to true for the specified UID.
*/

const admin = require('firebase-admin');

if (!process.argv[2]) {
  console.error('Usage: node set-admin-claim.js tY8JcnmxmETmIdhgxXRceRMdHfz2 [true|false]');
  process.exit(1);
}

const uid = process.argv[2];
const value = (process.argv[3] || 'true') === 'true';

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}

admin.auth().setCustomUserClaims(uid, { admin: value }).then(() => {
  console.log(`Set admin=${value} for ${uid}`);
  process.exit(0);
}).catch(err => {
  console.error('Error setting claims', err);
  process.exit(1);
});
