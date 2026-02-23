// admin.js — outils d'administration pour approuver/rejeter les médecins
(function () {
  function debug(...args){ if (window.console && window.console.debug) window.console.debug('[admin]', ...args); }
  function error(...args){ if (window.console && window.console.error) window.console.error('[admin]', ...args); }

  async function waitFirebase(){
    if (!window.firebaseReady) throw new Error('firebaseReady non défini');
    return window.firebaseReady;
  }

  async function fetchPending() {
    await waitFirebase();
    const db = window.firebaseDb;
    try {
      const snap = await db.collection('doctors').where('status', '==', 'pending').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      error('fetchPending error', e);
      return [];
    }
  }

  function renderPending(list) {
    const container = document.getElementById('pending-list');
    if (!container) return;
    container.innerHTML = '';
    if (!list || list.length === 0) {
      container.innerHTML = '<p class="muted small">Aucune candidature en attente.</p>';
      return;
    }
    list.forEach(item => {
      const el = document.createElement('div');
      el.className = 'doctor-item card';
      el.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <strong>${item.name || 'Médecin'}</strong>
            <div class="small muted">${item.email || ''}</div>
            <div class="muted small">${item.specialty || ''}</div>
          </div>
          <div>
            <button data-id="${item.userId}" data-action="details" class="btn">Détails</button>
            <button data-id="${item.userId}" data-action="approve" class="btn" style="margin-left:6px">Approuver</button>
            <button data-id="${item.userId}" data-action="reject" class="btn secondary" style="margin-left:6px">Rejeter</button>
          </div>
        </div>
      `;
      container.appendChild(el);
    });
  }

  async function updateStatus(userId, status) {
    await waitFirebase();
    const db = window.firebaseDb;
    try {
      // update doctors/{userId}
      const doctorRef = db.collection('doctors').doc(userId);
      await doctorRef.update({ status: status, updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() });
      // update users/{userId} role when approved/rejected
      if (status === 'approved') {
        await db.collection('users').doc(userId).update({ role: 'doctor' });
      } else if (status === 'rejected') {
        await db.collection('users').doc(userId).update({ role: 'rejected' });
      }

      // write an approval log in subcollection doctors/{userId}/approvals
      try {
        const adminUser = window.firebaseAuth.currentUser;
        const log = {
          adminId: adminUser ? adminUser.uid : null,
          adminName: adminUser ? (adminUser.displayName || null) : null,
          status: status,
          note: (window._adminPendingNote && window._adminPendingNote[userId]) || null,
          createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        };
        await doctorRef.collection('approvals').add(log);
        // clear temporary note
        if (window._adminPendingNote) delete window._adminPendingNote[userId];
      } catch (e) {
        debug('Impossible d\'écrire le log d\'approbation', e);
      }

      if (window.showToast) window.showToast(`Mise à jour: ${status}`);
      // Optionnel: appeler un webhook ou Cloud Function pour envoyer un e-mail
      try {
        const hook = window.ADMIN_WEBHOOK_URL || null;
        if (hook) {
          await fetch(hook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, status })
          });
        }
      } catch (e) {
        // non critique
        debug('webhook notify failed', e);
      }
    } catch (e) {
      error('updateStatus error', e);
      if (window.showToast) window.showToast('Erreur lors de la mise à jour');
    }
  }

  async function init() {
    try { await waitFirebase(); } catch (e) { debug('firebase not ready', e); return; }

    // Protect admin UI: only allow users with custom claim `admin == true`
    const auth = window.firebaseAuth;
    function denyAccess(msg) {
      const container = document.getElementById('pending-list');
      if (container) container.innerHTML = `<p class="muted small">Accès refusé: ${msg}</p>`;
    }

    const handleUser = async (user) => {
      if (!user) {
        denyAccess('Connectez-vous en tant qu\'administrateur.');
        return;
      }
      try {
        const token = await user.getIdTokenResult(true);
        if (!token.claims || !token.claims.admin) {
          denyAccess('Vous n\'êtes pas administrateur.');
          return;
        }

        // user is admin, show pending list
        const list = await fetchPending();
        renderPending(list);

        // attach click handler for details / approve / reject
        const pendingEl = document.getElementById('pending-list');
        if (!pendingEl) return;
        pendingEl.addEventListener('click', async function (ev) {
          const btn = ev.target.closest('button');
          if (!btn) return;
          const userId = btn.getAttribute('data-id');
          const action = btn.getAttribute('data-action');
          if (!userId || !action) return;
          if (action === 'details') {
            await showDetails(userId);
            return;
          }
          if (action === 'approve') {
            const note = prompt('Remarque (optionnel) pour l\'approbation');
            // store temporary note to include in log
            window._adminPendingNote = window._adminPendingNote || {};
            if (note) window._adminPendingNote[userId] = note;
            await updateStatus(userId, 'approved');
            handleUser(user);
          } else if (action === 'reject') {
            const reason = prompt('Raison du rejet (optionnel)');
            window._adminPendingNote = window._adminPendingNote || {};
            if (reason) window._adminPendingNote[userId] = reason;
            await updateStatus(userId, 'rejected');
            handleUser(user);
          }
        });

      } catch (e) {
        error('token check failed', e);
        denyAccess('Erreur d\'authentification.');
      }
    };

    if (auth.currentUser) {
      handleUser(auth.currentUser);
    } else {
      auth.onAuthStateChanged(function (u) { handleUser(u); });
    }
  }

  // Afficher les détails d'un candidat (profile, licence, historique)
  async function showDetails(userId) {
    await waitFirebase();
    const db = window.firebaseDb;
    const modal = document.getElementById('admin-modal');
    const body = document.getElementById('modal-body');
    if (!modal || !body) return;
    body.innerHTML = '<p class="muted small">Chargement...</p>';
    modal.style.display = 'block';

    try {
      const [docSnap, userSnap, approvalsSnap] = await Promise.all([
        db.collection('doctors').doc(userId).get(),
        db.collection('users').doc(userId).get(),
        db.collection('doctors').doc(userId).collection('approvals').orderBy('createdAt','desc').limit(10).get().catch(() => ({ docs: [] }))
      ]);
      const doc = docSnap.exists ? docSnap.data() : null;
      const user = userSnap.exists ? userSnap.data() : null;
      const approvals = (approvalsSnap && approvalsSnap.docs) ? approvalsSnap.docs.map(d => ({ id: d.id, ...d.data() })) : [];

      body.innerHTML = `
        <h3>${doc?.name || user?.name || 'Médecin'}</h3>
        <div class="small muted">${doc?.email || user?.email || ''}</div>
        <p><strong>Spécialité :</strong> ${doc?.specialty || ''}</p>
        <p><strong>Licence :</strong> ${doc?.license || ''}</p>
        <div id="modal-photo" style="margin:8px 0">
          ${user && user.photoUrl ? `<img src="${user.photoUrl}" style="max-width:160px;border-radius:8px" />` : ''}
        </div>
        <div style="margin-top:12px">
          <button id="modal-approve" class="btn">Approuver</button>
          <button id="modal-reject" class="btn secondary" style="margin-left:8px">Rejeter</button>
        </div>
        <h4 style="margin-top:12px">Historique des décisions</h4>
        <div id="modal-history">
          ${approvals.length === 0 ? '<p class="small muted">Aucune décision enregistrée.</p>' : approvals.map(a => `<div class="card small"><div>${a.adminName||a.adminId} — ${a.status}</div><div class="muted small">${a.note || ''}</div></div>`).join('')}
        </div>
      `;

      // attach modal buttons
      document.getElementById('modal-close').onclick = () => { modal.style.display = 'none'; };
      document.getElementById('modal-approve').onclick = async () => {
        const note = prompt('Remarque (optionnel) pour l\'approbation');
        window._adminPendingNote = window._adminPendingNote || {};
        if (note) window._adminPendingNote[userId] = note;
        await updateStatus(userId, 'approved');
        modal.style.display = 'none';
        // refresh pending list
        const list = await fetchPending(); renderPending(list);
      };
      document.getElementById('modal-reject').onclick = async () => {
        const reason = prompt('Raison du rejet (optionnel)');
        window._adminPendingNote = window._adminPendingNote || {};
        if (reason) window._adminPendingNote[userId] = reason;
        await updateStatus(userId, 'rejected');
        modal.style.display = 'none';
        const list = await fetchPending(); renderPending(list);
      };

    } catch (e) {
      error('showDetails error', e);
      body.innerHTML = '<p class="muted small">Impossible de charger les détails.</p>';
    }
  }

  if (window.firebaseReady && typeof window.firebaseReady.then === 'function') {
    window.firebaseReady.then(() => init()).catch(e => debug('firebaseReady rejected', e));
  } else {
    init();
  }

  // expose for debugging
  window.adminFetchPending = fetchPending;
  window.adminUpdateStatus = updateStatus;

})();
