// (// auth.js — gestion basique de l'authentification via Firebase
	function showMessage(msg) {
		// si utils fournit une fonction showToast, l'utiliser ; sinon fallback alert
		if (window.showToast && typeof window.showToast === 'function') {
			window.showToast(msg);
		} else {
			alert(msg);
		}
	}
	async function ensureFirebase() {
		if (!window.firebaseReady) {
			throw new Error('firebaseReady non défini. Assurez-vous que config.js est chargé.');
		}
		return window.firebaseReady;
	}

	// Handler pour le formulaire de connexion
	(async function attachLogin() {
		try {
			await ensureFirebase();
		} catch (e) {
			console.error(e);
			return;
		}

		const loginForm = document.getElementById('login-form');
		if (!loginForm) return;
		loginForm.addEventListener('submit', async function (ev) {
    ev.preventDefault();
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value.trim();
    try {
        const userCredential = await firebase.auth()
            .signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        // 🔥 récupérer le rôle depuis Firestore
        const doc = await firebase.firestore()
            .collection('users')
            .doc(user.uid)
            .get();
        const role = doc.data().role;
        console.log("ROLE:", role);
        if (role === 'admin') {
            window.location.href = 'admin-approve.html';
        } 
        else if (role === 'doctor') {
            window.location.href = 'dashboard-doctor.html';
        } 
        else {
            window.location.href = 'dashboard-patient.html';
        }
    } catch (err) {
        console.error(err);
    }
});
	})();

	// Handler pour le formulaire d'inscription
	(async function attachRegister() {
		try {
			await ensureFirebase();
		} catch (e) {
			console.error(e);
			return;
		}

		const registerForm = document.getElementById('register-form');
		if (!registerForm) return;

		registerForm.addEventListener('submit', async function (ev) {
			ev.preventDefault();
			const name = (document.getElementById('name') || {}).value || '';
			const email = (document.getElementById('email') || {}).value || '';
			const password = (document.getElementById('password') || {}).value || '';
			const role = (document.getElementById('role') || {}).value || 'patient';
			const specialty = (document.getElementById('specialty') || {}).value || null;
			const license = (document.getElementById('license') || {}).value || null;
			try {
				const userCred = await window.firebaseAuth.createUserWithEmailAndPassword(email, password);
				const user = userCred.user;
				// optionnel : mettre à jour le displayName
				if (user && name) {
					try { await user.updateProfile({ displayName: name }); } catch (e) { /* non critique */ }
				}
				// créer un document utilisateur basique dans Firestore
				try {
					const userDoc = {
						name: name || null,
						email: email,
						role: role === 'doctor' ? 'doctor_pending' : 'patient',
						createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
					};
					await window.firebaseDb.collection('users').doc(user.uid).set(userDoc);
					// Si l'utilisateur s'est inscrit comme médecin, créer un enregistrement dans 'doctors' pour validation
					if (role === 'doctor') {
						try {
							await window.firebaseDb.collection('doctors').doc(user.uid).set({
								userId: user.uid,
								name: name || null,
								email: email,
								specialty: specialty || null,
								license: license || null,
								status: 'pending',
								createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
							});
							if (window.showToast) window.showToast('Inscription reçue — votre compte médecin est en attente de validation');
						} catch (e) {
							console.warn('Impossible de créer le doc doctor en base:', e);
						}
					} else {
						if (window.showToast) window.showToast('Compte patient créé avec succès');
					}
					registerForm.reset();
					// rediriger vers la page de connexion
					window.location.href = 'login.html';
				} catch (e) {
					console.warn('Impossible de créer le doc user en base:', e);
				}
			} catch (err) {
				console.error('Register error', err);
				showToast(err.message || 'Échec de l\'inscription');
			}
		});
	})();

	// Fonction de déconnexion accessible globalement
	window.authSignOut = async function () {
		try {
			await ensureFirebase();
			await window.firebaseAuth.signOut();
			window.location.href = 'login.html';
		} catch (e) {
			console.error('Sign out error', e);
			showToast('Erreur lors de la déconnexion');
		}
	};
// )
// ();

