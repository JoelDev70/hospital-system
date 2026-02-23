# Déploiement — règles Firestore & Cloud Functions

Ce document explique les étapes minimales pour déployer les règles Firestore et les Cloud Functions d'envoi d'e‑mail et de rappel.

Prérequis

- Avoir `firebase-tools` installé (`npm install -g firebase-tools`)
- Avoir un projet Firebase configuré et vous être connecté (`firebase login`)
- Avoir initialisé `firebase init` si nécessaire

1. Déployer les règles Firestore

```bash
# se placer dans le répertoire du projet
firebase use <your-project-id>
firebase deploy --only firestore:rules
```

2. Déployer les Cloud Functions (exemples)

Les fonctions d'exemple utilisent `nodemailer`. Dans le dossier `functions/` :

```bash
cd functions
npm init -y
npm install firebase-admin firebase-functions nodemailer

# configurer les credentials SMTP (exemple SendGrid/SMTP)
firebase functions:config:set smtp.user="YOUR_SMTP_USER" smtp.pass="YOUR_SMTP_PASS" smtp.host="smtp.example.com" smtp.port=587

firebase deploy --only functions
```

3. Assigner le claim `admin` à un utilisateur (local)

Utilisez le script `scripts/set-admin-claim.js` avec une clé de compte de service :

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
node scripts/set-admin-claim.js <UID> true
```

4. Vérifier

- Connectez-vous en tant qu'utilisateur admin, rechargez le token (`currentUser.getIdToken(true)` dans la console) et ouvrez `pages/admin-approve.html`.

Notes de sécurité

- Ne stockez pas de secrets dans le code. Utilisez `firebase functions:config:set` ou Secret Manager.
- Testez les règles avec l'émulateur ou Rules Playground avant déploiement.
