(function () {
	// Chargement dynamique des scripts Firebase (compat) et initialisation
	// Remplacez les valeurs de firebaseConfig par celles de votre projet Firebase.
	const firebaseScripts = [
		'https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js',
		'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth-compat.js',
		'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore-compat.js',
		'https://www.gstatic.com/firebasejs/9.22.1/firebase-storage-compat.js'
	];

	function loadScript(src) {
		return new Promise((resolve, reject) => {
			const s = document.createElement('script');
			s.src = src;
			s.async = true;
			s.onload = () => resolve();
			s.onerror = () => reject(new Error('Failed to load ' + src));
			document.head.appendChild(s);
		});
	}

	window.firebaseReady = (async function () {
		try {
			for (const src of firebaseScripts) {
				await loadScript(src);
			}
// import { initializeApp } from "firebase/app";
			// TODO: remplacer ces placeholders par vos vraies valeurs Firebase
			const firebaseConfig = {
                    apiKey: "AIzaSyAvHsTZVDCn9RvK1wXRyHi1ekqIb4b-xpU",
                    authDomain: "hospital-system-75b60.firebaseapp.com",
                    projectId: "hospital-system-75b60",
                    storageBucket: "hospital-system-75b60.firebasestorage.app",
                    messagingSenderId: "45352225447",
                    appId: "1:45352225447:web:e8408adad9cb11c0176982"
				// apiKey: 'REPLACE_WITH_API_KEY',
				// authDomain: 'REPLACE_WITH_AUTH_DOMAIN',
				// projectId: 'REPLACE_WITH_PROJECT_ID',
				// // storageBucket, messagingSenderId, appId... si besoin
			};
            // Initialize Firebase
            // const app = initializeApp(firebaseConfig);

			if (!window.firebase || !window.firebase.initializeApp) {
				throw new Error('Firebase SDK non disponible après le chargement des scripts');
			}

			const app = window.firebase.initializeApp(firebaseConfig);
			const auth = window.firebase.auth();
			const db = window.firebase.firestore();
			const storage = window.firebase.storage();

			// exporter sur window pour simplicité (scripts non-modulaires)
			window.firebaseApp = app;
			window.firebaseAuth = auth;
			window.firebaseDb = db;
			window.firebaseStorage = storage;

			return { app, auth, db };
		} catch (err) {
			console.error('Erreur initialisation Firebase:', err);
			throw err;
		}
	}
)();
})();

