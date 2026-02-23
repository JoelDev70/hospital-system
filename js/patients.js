// patients.js — gestion du profil patient
(function () {
	async function ensureFirebase() {
		if (!window.firebaseReady) throw new Error('firebaseReady non défini');
		return window.firebaseReady;
	}

	async function loadProfile() {
		await ensureFirebase();
		const auth = window.firebaseAuth;
		const db = window.firebaseDb;

		function render(data, user) {
			const container = document.getElementById('profile-details');
			if (!container) return;
			container.innerHTML = '';
			// Si aucun document users/{uid} en base, n'afficher que le message et proposer de créer la fiche
			if (!data) {
				const el = document.createElement('div');
				el.innerHTML = `
					<p class="muted">Aucune fiche utilisateur trouvée en base pour ce compte.</p>
					<p class="small">Souhaitez-vous créer votre fiche utilisateur ? Cela permet d'afficher votre profil et vos rendez‑vous.</p>
					<div style="margin-top:8px"><button id="create-profile" class="btn">Créer ma fiche</button></div>
				`;
				container.appendChild(el);

				// attach handler pour création de la fiche minimale
				setTimeout(() => {
					const btn = document.getElementById('create-profile');
					if (!btn) return;
					btn.addEventListener('click', async function () {
						try {
							await ensureFirebase();
							const db = window.firebaseDb;
							const auth = window.firebaseAuth;
							const u = auth.currentUser;
							if (!u) { if (window.showToast) window.showToast('Veuillez vous connecter'); return; }
							const doc = {
								name: u.displayName || null,
								email: u.email || null,
								role: 'patient',
								createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
							};
							await db.collection('users').doc(u.uid).set(doc);
							if (window.showToast) window.showToast('Fiche créée');
							// recharger le profil
							loadProfile();
						} catch (e) {
							console.error('Erreur création fiche', e);
							if (window.showToast) window.showToast('Impossible de créer la fiche');
						}
					});
				}, 50);
				return;
			}

			const name = data?.name || user?.displayName || '';
			const email = (user && user.email) || data?.email || '';
			const phone = data?.phone || '';

			const el = document.createElement('div');
			el.innerHTML = `<p><strong>Nom :</strong> ${name}</p>
					<p><strong>Email :</strong> ${email}</p>
					<p><strong>Téléphone :</strong> ${phone}</p>`;
			container.appendChild(el);

			// afficher photo si présente
			const photoEl = document.getElementById('profile-photo');
			if (photoEl) {
				const url = data?.photoUrl || user?.photoURL || null;
				if (url) photoEl.src = url;
			}
		}

		const user = auth.currentUser;
		if (!user) {
			// attendre l'état d'auth
			auth.onAuthStateChanged(async function (u) {
				if (!u) return;
				try {
					const doc = await db.collection('users').doc(u.uid).get();
					render(doc.exists ? doc.data() : null, u);
				} catch (e) {
					console.error('Erreur loadProfile after auth', e);
				}
			});
			return;
		}

		try {
			const doc = await db.collection('users').doc(user.uid).get();
			render(doc.exists ? doc.data() : null, user);
		} catch (err) {
			console.error('Erreur loadProfile', err);
			if (window.showToast) window.showToast('Impossible de charger le profil');
		}
	}

	// Attacher l'édition simple du nom (prompt)
	(function attachEdit() {
		document.addEventListener('click', async function (ev) {
			const target = ev.target;
			if (!target) return;
			if (target.id === 'edit-profile') {
				try {
					await ensureFirebase();
				} catch (e) {
					console.error(e);
					return;
				}
				const auth = window.firebaseAuth;
				const db = window.firebaseDb;
				const user = auth.currentUser;
				if (!user) {
					if (window.showToast) window.showToast('Connectez-vous pour modifier votre profil');
					return;
				}
				const newName = prompt('Nouveau nom', user.displayName || '');
				if (newName === null) return; // cancel
				try {
					// mettre à jour displayName
					await user.updateProfile({ displayName: newName });
				} catch (e) {
					// non critique
				}
				try {
					await db.collection('users').doc(user.uid).set({ name: newName }, { merge: true });
					if (window.showToast) window.showToast('Profil mis à jour');
					// recharger affichage
					loadProfile();
				} catch (e) {
					console.error('Erreur updating profile', e);
					if (window.showToast) window.showToast('Erreur lors de la sauvegarde');
				}
			}
		});
	})();

	// Photo upload handling
	(function attachPhotoUpload() {
		document.addEventListener('change', async function (ev) {
			const target = ev.target;
			if (!target || target.id !== 'photo-input') return;
			try {
				await ensureFirebase();
			} catch (e) {
				console.error(e);
				return;
			}
			const file = target.files && target.files[0];
			if (!file) return;
			const auth = window.firebaseAuth;
			const storage = window.firebase.storage();
			const db = window.firebaseDb;
			const user = auth.currentUser;
			if (!user) {
				if (window.showToast) window.showToast('Connectez-vous pour mettre à jour la photo');
				return;
			}
			const statusEl = document.getElementById('photo-status');
			if (statusEl) statusEl.textContent = 'Téléversement...';
			try {
				const ext = file.name.split('.').pop();
				const ref = storage.ref().child(`profiles/${user.uid}.${ext}`);
				const snap = await ref.put(file);
				const url = await snap.ref.getDownloadURL();
				// enregistrer l'URL dans users/{uid}
				await db.collection('users').doc(user.uid).set({ photoUrl: url }, { merge: true });
				try { await user.updateProfile({ photoURL: url }); } catch (e) { /* non critique */ }
				if (statusEl) statusEl.textContent = 'Photo mise à jour';
				loadProfile();
			} catch (e) {
				console.error('Erreur upload photo', e);
				if (statusEl) statusEl.textContent = 'Erreur lors du téléversement';
				if (window.showToast) window.showToast('Impossible d\'uploader la photo');
			}
		});
	})();

	// exposer
	window.loadProfile = loadProfile;

	// auto load
	(function init() {
		if (window.firebaseReady && typeof window.firebaseReady.then === 'function') {
			window.firebaseReady.then(() => loadProfile()).catch(() => {});
		} else {
			// delayed attempt
			try { loadProfile(); } catch (e) { /* no-op */ }
		}
	})();

})();

