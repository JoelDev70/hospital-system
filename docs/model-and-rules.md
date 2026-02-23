# Modèle de données et règles recommandées

Ce document décrit le modèle de données attendu pour l'application "Hospital System" et propose des règles Firestore recommandées pour protéger les opérations sensibles (approbation des médecins, gestion des rendez‑vous, etc.).

## Collections principales

- `users/{uid}`
  - Fields:
    - `name` (string|null)
    - `email` (string)
    - `role` (string) — valeurs possibles: `patient`, `doctor_pending`, `doctor`, `admin`, `rejected`
    - `photoUrl` (string|null) — URL du profil stockée dans Firebase Storage (optionnelle)
    - `createdAt` (timestamp)

- `doctors/{uid}`
  - Fields:
    - `userId` (string) — id utilisateur (même que le document `users/{uid}`)
    - `name`, `email`, `specialty` (string)
    - `license` (string|null)
    - `status` (string) — `pending`, `approved`, `rejected`
    - `availableSlots` (array|null) — optionnel, tableau de slots ou règle d'horaires
    - `createdAt`, `updatedAt` (timestamp)

- `appointments/{id}`
  - Fields:
    - `userId` (string) — patient
    - `doctorId` (string)
    - `scheduledAt` (timestamp)
    - `status` (string) — `pending`, `approved`, `ongoing`, `completed`, `cancelled`
    - `notes` (string|null)
    - `createdAt`, `updatedAt` (timestamp)

## Principes métier importants

- Un compte qui choisit `doctor` lors de l'inscription crée:
  - `users/{uid}.role = 'doctor_pending'`
  - `doctors/{uid}` avec `status = 'pending'`
- Un docteur n'apparaît dans la liste publique que si `doctors/{uid}.status == 'approved'`.
- L'admin est responsable de valider ou rejeter les dossiers médecins. Cette opération ne peut être faite que par un compte avec le claim `admin`.
- Les rendez‑vous créés par un patient démarrent en `pending`. Le médecin peut `approve` (devient `approved`) ou `reject`.
- Lors de l'approbation, le système envoie des notifications (e‑mail et/ou push) au patient et au médecin.

## Recommandation de règles Firestore (extrait)

Ci‑dessous un extrait de règles à adapter (ne pas copier-coller sans validation) :

```
function isAuth() { return request.auth != null; }
function isAdmin() { return isAuth() && request.auth.token.admin == true; }

match /doctors/{doctorId} {
  allow create: if isAuth() && request.auth.uid == doctorId; // création par l'utilisateur
  allow read: if isAdmin() || (isAuth() && request.auth.uid == doctorId) || (resource.data.status == 'approved');
  // Seuls les admins peuvent changer le champ `status`.
  allow update: if isAdmin() || (isAuth() && request.auth.uid == doctorId && !("status" in request.resource.data && request.resource.data.status != resource.data.status));
}

match /appointments/{id} {
  allow create: if isAuth() && request.resource.data.userId == request.auth.uid;
  allow read: if isAuth() && (resource.data.userId == request.auth.uid || resource.data.doctorId == request.auth.uid || isAdmin());
  allow update: if isAdmin() || (isAuth() && resource.data.userId == request.auth.uid) || (isAuth() && resource.data.doctorId == request.auth.uid && /* limit updates to status changes by doctor */ true);
}
```

Notes:

- Les règles doivent être testées avec l'outil Rules Playground et adaptées au modèle final (indexes Firestore, champs `orderBy`, etc.).
- Evitez `allow read, write: if true;` en production.

## Déploiement et étapes opérationnelles

1. Validez le flux d'inscription docteur → admin confirme → `status: 'approved'`.
2. Déployez des règles strictes avant toute mise en production.
3. Préparez les Cloud Functions d'envoi d'e‑mail et de rappel (Scheduler) en variables d'environnement sécurisées.

---

Fichier de référence — adapté pour la maintenance et les modifications futures.
