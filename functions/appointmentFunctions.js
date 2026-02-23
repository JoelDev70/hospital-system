/**
 * Example Cloud Functions for appointment notifications
 * - notifyOnApproval: triggers when appointments/{id} is updated and status -> 'approved'
 * - scheduledReminders: runs every 5 minutes and sends reminders for upcoming appointments
 *
 * Requirements:
 * - firebase-admin and firebase-functions
 * - an email transporter (nodemailer) configured via functions config
 * - deploy with `firebase deploy --only functions`
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

admin.initializeApp();

const smtp = functions.config().smtp || {};
const transporter = nodemailer.createTransport({
  host: smtp.host,
  port: smtp.port || 587,
  secure: false,
  auth: {
    user: smtp.user,
    pass: smtp.pass
  }
});

exports.notifyOnApproval = functions.firestore
  .document('appointments/{apptId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    if (!before || !after) return null;
    if (before.status !== after.status && after.status === 'approved') {
      // notify patient and doctor
      try {
        const db = admin.firestore();
        const [patientDoc, doctorDoc] = await Promise.all([
          db.collection('users').doc(after.userId).get(),
          db.collection('doctors').doc(after.doctorId).get()
        ]);

        const patient = patientDoc.exists ? patientDoc.data() : null;
        const doctor = doctorDoc.exists ? doctorDoc.data() : null;

        const subject = 'Confirmation de rendez-vous';
        const text = `Votre rendez-vous du ${after.scheduledAt ? new Date(after.scheduledAt._seconds * 1000).toLocaleString() : '—'} a été confirmé.`;

        if (patient && patient.email) {
          await transporter.sendMail({ from: `no-reply@${process.env.GCLOUD_PROJECT || 'hospital'}.example`, to: patient.email, subject, text });
        }
        if (doctor && doctor.email) {
          await transporter.sendMail({ from: `no-reply@${process.env.GCLOUD_PROJECT || 'hospital'}.example`, to: doctor.email, subject: `Nouveau rendez-vous confirmé — ${subject}`, text: `Un rendez-vous a été confirmé pour ${after.scheduledAt ? new Date(after.scheduledAt._seconds * 1000).toLocaleString() : '—'}` });
        }
      } catch (e) {
        console.error('notifyOnApproval error', e);
      }
    }
    return null;
  });

// Scheduled reminders (run every 5 minutes)
exports.scheduledReminders = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const windowStart = admin.firestore.Timestamp.fromMillis(now.toMillis());
  const windowEnd = admin.firestore.Timestamp.fromMillis(now.toMillis() + 15 * 60 * 1000); // next 15 minutes

  try {
    const q = await db.collection('appointments')
      .where('status', '==', 'approved')
      .where('scheduledAt', '>=', windowStart)
      .where('scheduledAt', '<=', windowEnd)
      .where('reminderSent', '!=', true)
      .get();

    const mails = [];
    for (const doc of q.docs) {
      const ap = doc.data();
      const [patientDoc, doctorDoc] = await Promise.all([
        db.collection('users').doc(ap.userId).get(),
        db.collection('doctors').doc(ap.doctorId).get()
      ]);
      const patient = patientDoc.exists ? patientDoc.data() : null;
      const doctor = doctorDoc.exists ? doctorDoc.data() : null;

      const subject = 'Rappel: rendez-vous imminent';
      const when = ap.scheduledAt ? new Date(ap.scheduledAt._seconds * 1000).toLocaleString() : '—';
      const text = `Rappel: votre rendez-vous prévu le ${when}.
\nCordialement,\nL'équipe`;

      if (patient && patient.email) {
        mails.push(transporter.sendMail({ from: `no-reply@${process.env.GCLOUD_PROJECT || 'hospital'}.example`, to: patient.email, subject, text }));
      }
      if (doctor && doctor.email) {
        mails.push(transporter.sendMail({ from: `no-reply@${process.env.GCLOUD_PROJECT || 'hospital'}.example`, to: doctor.email, subject: `Rappel pour rendez-vous — ${when}`, text }));
      }

      // mark reminderSent to avoid duplicates
      await doc.ref.update({ reminderSent: true });
    }

    if (mails.length) await Promise.all(mails);
  } catch (e) {
    console.error('scheduledReminders error', e);
  }

  return null;
});
