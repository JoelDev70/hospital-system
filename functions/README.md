Approve Doctor Cloud Function - README

This folder contains a sample Cloud Function that sends an email when a doctor's
status changes in Firestore.

Setup (short):
1) Install Firebase CLI and initialize functions:
   - npm i -g firebase-tools
   - firebase login
   - firebase init functions

2) Copy `approveDoctorFunction.js` into the `functions/` folder or adapt the
   exported function into your project's `index.js`.

3) Install dependencies in functions folder:
   - cd functions
   - npm install firebase-admin firebase-functions nodemailer

4) Configure SMTP settings with Firebase functions config:
   - firebase functions:config:set smtp.host="smtp.example.com" smtp.user="USER" smtp.pass="PASS" smtp.port=587

5) Deploy:
   - firebase deploy --only functions

Notes:
- This code is an example. For production, prefer a transactional email service
  (SendGrid, Mailgun) or Cloud Tasks. Keep credentials secure.
- Ensure your Firestore rules allow the function's service account to read the
  updated document (default does).
