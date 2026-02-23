/*
 Example Cloud Function (Node) for Firebase that triggers on doctors/{uid} updates
 and sends an email when a doctor's status changes to 'approved' or 'rejected'.

 This is an example only — to deploy it you need to initialize Firebase Functions,
 install dependencies (nodemailer), configure an SMTP provider/SendGrid, and set
 environment variables (SMTP credentials) in your functions environment.

 steps (short):
 1) cd functions && npm init -y
 2) npm install firebase-admin firebase-functions nodemailer
 3) set environment variables: firebase functions:config:set smtp.user="..." smtp.pass="..." smtp.host="..."
 4) deploy with `firebase deploy --only functions`
*/

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

const smtpConfig = functions.config().smtp || {};
const transporter = nodemailer.createTransport({
  host: smtpConfig.host,
  port: smtpConfig.port || 587,
  secure: false,
  auth: {
    user: smtpConfig.user,
    pass: smtpConfig.pass
  }
});

exports.notifyDoctorStatus = functions.firestore
  .document('doctors/{doctorId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after) return null;

    if (before.status !== after.status) {
      const to = after.email;
      const subject = `Votre inscription médecin: ${after.status}`;
      const text = `Bonjour ${after.name || ''},\n\nVotre inscription a été mise à jour: ${after.status}.\n\nCordialement,\nL'équipe`;

      try {
        await transporter.sendMail({ from: `no-reply@${process.env.GCLOUD_PROJECT || 'hospital'}.example`, to, subject, text });
        console.log('Notification envoyée à', to);
      } catch (e) {
        console.error('Erreur envoi mail', e);
      }
    }

    return null;
  });
