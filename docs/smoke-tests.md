# Smoke tests manuels

Petit guide pour valider les flux critiques localement après avoir connecté votre Firebase project.

1) Inscription patient
- Ouvrir `pages/register.html`, choisir "Patient", remplir et soumettre.
- Vérifier dans Firestore : `users/{uid}` existe avec `role: 'patient'`.

2) Inscription médecin
- Choisir "Médecin" à l'inscription.
- Vérifier : `users/{uid]}.role == 'doctor_pending'` et `doctors/{uid}` existe avec `status: 'pending'`.

3) Donner le rôle admin
- Exécuter `node scripts/set-admin-claim.js <UID> true`.
- Forcer le refresh token côté client: `firebase.auth().currentUser.getIdToken(true)` puis reload.

4) Approuver un médecin
- Ouvrir `pages/admin-approve.html` en admin, approuver un médecin.
- Vérifier `doctors/{uid}.status == 'approved'` et `users/{uid}.role == 'doctor'`.

5) Réserver un rendez-vous (patient)
- Ouvrir `pages/booking.html`, choisir un médecin (approuvé), une date/heure, valider.
- Vérifier `appointments/{id}` avec `status: 'pending'` et `scheduledAt` présent.

6) Approver un RDV (médecin)
- Ouvrir `pages/dashboard-doctor.html`, approuver le RDV.
- Vérifier `appointments/{id}.status == 'approved'`.

7) Notifications
- (Si functions déployées) vérifier que les e‑mails sont envoyés lors de l'approbation et que les rappels sont planifiés.
