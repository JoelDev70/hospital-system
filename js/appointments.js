// appointments.js — prise de rendez-vous et affichage des RDV
/*
  appointments.js — robustified version
  - attend firebaseReady avant d'utiliser auth/db
  - centralise onAuthStateChanged pour déclencher le chargement des RDV
  - ajoute logs pour faciliter le debug
  - expose bookAppointment et loadAppointments
*/

(function () {
  function debug(...args) {
    if (window && window.console && window.console.debug) window.console.debug('[appointments]', ...args);
  }

  function error(...args) {
    if (window && window.console && window.console.error) window.console.error('[appointments]', ...args);
  }

  async function waitFirebase() {
    if (!window.firebaseReady) throw new Error('firebaseReady non défini');
    return window.firebaseReady;
  }

  async function bookAppointment({ doctorId, date, time }) {
    await waitFirebase();
    const auth = window.firebaseAuth;
    const db = window.firebaseDb;

    const user = auth.currentUser;
    if (!user) {
      if (window.showToast) window.showToast('Veuillez vous connecter pour prendre un rendez-vous');
      return null;
    }

    if (!doctorId || !date || !time) {
      if (window.showToast) window.showToast('Merci de renseigner tous les champs');
      return null;
    }

    let scheduledAt = null;
    try {
      scheduledAt = new Date(date + 'T' + time);
      if (isNaN(scheduledAt.getTime())) scheduledAt = null;
    } catch (e) {
      scheduledAt = null;
    }

    const payload = {
      userId: user.uid,
      doctorId,
      date,
      time,
      scheduledAt: scheduledAt ? window.firebase.firestore.Timestamp.fromDate(scheduledAt) : null,
      status: 'pending',
      createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
      const ref = await db.collection('appointments').add(payload);
      if (window.showToast) window.showToast('Rendez-vous réservé');
      // rafraîchir la liste
      loadAppointments();
      return ref.id;
    } catch (err) {
      error('Erreur bookAppointment', err);
      if (window.showToast) window.showToast('Erreur lors de la réservation');
      return null;
    }
  }

  // Retourne les documents pour un uid
  async function getAppointmentsForUid(uid) {
    await waitFirebase();
    const db = window.firebaseDb;
    try {
      // protège la requête contre l'absence du champ createdAt
      const q = db.collection('appointments').where('userId', '==', uid).orderBy('createdAt', 'desc');
      const snap = await q.get();
      return snap.docs || [];
    } catch (e) {
      // si orderBy provoque une erreur (par ex. index manquant), retenter sans order
      debug('getAppointmentsForUid: erreur initiale, tentative sans orderBy', e);
      try {
        const snap = await db.collection('appointments').where('userId', '==', uid).get();
        return snap.docs || [];
      } catch (e2) {
        error('getAppointmentsForUid erreur finale', e2);
        throw e2;
      }
    }
  }

  async function renderAppointments(docs) {
    const container = document.getElementById('appointments-container');
    if (!container) return;
    container.innerHTML = '';
    if (!docs || docs.length === 0) {
      container.innerHTML = '<p>Aucun rendez-vous.</p>';
      return;
    }

    for (const d of docs) {
      const data = d.data();
      const item = document.createElement('div');
      item.className = 'appointment-item card';
      const doctorName = await fetchDoctorName(data.doctorId);
      const when = data.scheduledAt ? window.formatDate(data.scheduledAt) : `${data.date || ''} ${data.time || ''}`;
      item.innerHTML = `<div class="card-body"><h4>${doctorName || 'Médecin'}</h4>
        <p>${when}</p>
        <p>Statut: ${data.status || '—'}</p></div>`;
      container.appendChild(item);
    }
  }

  // --- Doctor actions: approve/reject ---
  async function doctorFetchPending(doctorUid) {
    await waitFirebase();
    const db = window.firebaseDb;
    try {
      const snap = await db.collection('appointments')
        .where('doctorId', '==', doctorUid)
        .where('status', '==', 'pending')
        .orderBy('scheduledAt')
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.error('doctorFetchPending error', e);
      return [];
    }
  }

  async function doctorApproveAppointment(apptId) {
    await waitFirebase();
    const db = window.firebaseDb;
    const apptRef = db.collection('appointments').doc(apptId);
    try {
      await db.runTransaction(async (tx) => {
        const apptDoc = await tx.get(apptRef);
        if (!apptDoc.exists) throw new Error('Rendez-vous introuvable');
        const appt = apptDoc.data();
        if (!appt.scheduledAt) throw new Error('Horaire invalide');
        // vérifier qu'il n'existe pas déjà un rendez-vous approuvé au même horaire pour ce médecin
        const q = await db.collection('appointments')
          .where('doctorId', '==', appt.doctorId)
          .where('status', '==', 'approved')
          .where('scheduledAt', '==', appt.scheduledAt)
          .get();
        if (!q.empty) throw new Error('Conflit horaire: un rendez-vous est déjà approuvé pour ce créneau');
        tx.update(apptRef, { status: 'approved', updatedAt: window.firebase.firestore.FieldValue.serverTimestamp() });
      });
      if (window.showToast) window.showToast('Rendez-vous approuvé');
      return true;
    } catch (e) {
      console.error('doctorApproveAppointment error', e);
      if (window.showToast) window.showToast(e.message || 'Erreur lors de l\'approbation');
      return false;
    }
  }

  async function doctorRejectAppointment(apptId, reason) {
    await waitFirebase();
    const db = window.firebaseDb;
    try {
      await db.collection('appointments').doc(apptId).update({ status: 'cancelled', updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(), cancelReason: reason || null });
      if (window.showToast) window.showToast('Rendez-vous rejeté');
      return true;
    } catch (e) {
      console.error('doctorRejectAppointment error', e);
      if (window.showToast) window.showToast('Erreur lors du rejet');
      return false;
    }
  }

  // Render a doctor dashboard list into element with id 'doctor-widgets'
  async function loadDoctorDashboard() {
    await waitFirebase();
    const auth = window.firebaseAuth;
    const container = document.getElementById('doctor-widgets');
    if (!container) return;
    container.innerHTML = '<p class="muted small">Chargement...</p>';

    const renderList = async (user) => {
      if (!user) {
        container.innerHTML = '<p>Connectez-vous pour voir vos rendez-vous.</p>';
        return;
      }
      try {
        const pending = await doctorFetchPending(user.uid);
        if (!pending || pending.length === 0) {
          container.innerHTML = '<p class="muted small">Aucun rendez-vous en attente.</p>';
          return;
        }
        container.innerHTML = '';
        pending.forEach(ap => {
          const el = document.createElement('div');
          el.className = 'appointment-item card';
          const when = ap.scheduledAt ? window.formatDate(ap.scheduledAt) : `${ap.date || ''} ${ap.time || ''}`;
          el.innerHTML = `<div class="card-body"><strong>${ap.userId}</strong><div class="small muted">${when}</div>
            <div style="margin-top:8px">
              <button data-id="${ap.id}" data-action="approve" class="btn">Approuver</button>
              <button data-id="${ap.id}" data-action="reject" class="btn secondary" style="margin-left:8px">Rejeter</button>
            </div></div>`;
          container.appendChild(el);
        });

        // attach handler
        container.addEventListener('click', async function (ev) {
          const btn = ev.target.closest('button');
          if (!btn) return;
          const id = btn.getAttribute('data-id');
          const action = btn.getAttribute('data-action');
          if (action === 'approve') {
            await doctorApproveAppointment(id);
            loadDoctorDashboard();
          } else if (action === 'reject') {
            const reason = prompt('Raison du rejet (optionnel)');
            await doctorRejectAppointment(id, reason);
            loadDoctorDashboard();
          }
        });

      } catch (e) {
        console.error('Erreur loadDoctorDashboard', e);
        container.innerHTML = '<p class="muted small">Erreur lors du chargement.</p>';
      }
    };

    if (auth.currentUser) renderList(auth.currentUser);
    else auth.onAuthStateChanged(u => renderList(u));
  }

  window.doctorApproveAppointment = doctorApproveAppointment;
  window.doctorRejectAppointment = doctorRejectAppointment;
  window.loadDoctorDashboard = loadDoctorDashboard;

  async function fetchDoctorName(doctorId) {
    if (!doctorId) return null;
    try {
      await waitFirebase();
      const doc = await window.firebaseDb.collection('doctors').doc(doctorId).get();
      if (doc.exists) return doc.data().name || null;
    } catch (e) {
      debug('fetchDoctorName erreur', e);
    }
    return null;
  }

  // Chargement centralisé des RDV (public)
  async function loadAppointments() {
    await waitFirebase();
    const auth = window.firebaseAuth;
    const container = document.getElementById('appointments-container');
    if (!container) return;
    container.innerHTML = '<p>Chargement...</p>';

    // On attend l'état d'authentification (permet de récupérer user même si le state est restauré)
    auth.onAuthStateChanged(async function (u) {
      if (!u) {
        container.innerHTML = '<p>Connectez-vous pour voir vos rendez-vous.</p>';
        return;
      }

      try {
        const docs = await getAppointmentsForUid(u.uid);
        await renderAppointments(docs);
      } catch (e) {
        error('Erreur loadAppointments after auth', e);
        container.innerHTML = '<p>Impossible de charger vos rendez-vous.</p>';
        if (window.showToast) window.showToast('Erreur lors du chargement des rendez-vous');
      }
    });
  }

  // Attacher le submit du form booking
  (function attachBookingForm() {
    document.addEventListener('submit', function (ev) {
      const form = ev.target;
      if (!form || form.id !== 'booking-form') return;
      ev.preventDefault();
      const doctorId = (document.getElementById('doctor') || {}).value || '';
      const date = (document.getElementById('date') || {}).value || '';
      const time = (document.getElementById('time') || {}).value || '';
      bookAppointment({ doctorId, date, time });
    });
  })();

  // expose
  window.bookAppointment = bookAppointment;
  window.loadAppointments = loadAppointments;

  // Load next N appointments and render into a target element (compact view for dashboard)
  async function loadNextAppointments(limit = 3, targetId = 'dashboard-appointments') {
    await waitFirebase();
    const auth = window.firebaseAuth;
    const container = document.getElementById(targetId);
    if (!container) return;
    container.innerHTML = '<p class="muted small">Chargement...</p>';

    const renderCompact = async (u) => {
      try {
        const docs = await getAppointmentsForUid(u.uid);
        if (!docs || docs.length === 0) {
          container.innerHTML = '<p class="empty-state">Aucun rendez-vous à afficher.</p>';
          return;
        }
        container.innerHTML = '';
        const slice = docs.slice(0, limit);
        for (const d of slice) {
          const data = d.data();
          const el = document.createElement('div');
          el.className = 'appointment-item';
          const doctorName = await fetchDoctorName(data.doctorId);
          const when = data.scheduledAt ? window.formatDate(data.scheduledAt) : `${data.date || ''} ${data.time || ''}`;
          el.innerHTML = `<strong>${doctorName || 'Médecin'}</strong><div class="small muted">${when}</div>`;
          container.appendChild(el);
        }
      } catch (e) {
        error('loadNextAppointments error', e);
        container.innerHTML = '<p class="muted small">Impossible de charger les rendez-vous.</p>';
      }
    };

    if (auth.currentUser) {
      renderCompact(auth.currentUser);
    } else {
      auth.onAuthStateChanged(function (u) {
        if (!u) {
          container.innerHTML = '<p class="muted small">Connectez-vous pour voir vos rendez-vous.</p>';
          return;
        }
        renderCompact(u);
      });
    }
  }

  window.loadNextAppointments = loadNextAppointments;

  // auto init: lancer loadAppointments après firebaseReady
  (function init() {
    if (window.firebaseReady && typeof window.firebaseReady.then === 'function') {
      window.firebaseReady.then(() => {
        try { loadAppointments(); } catch (e) { debug('init loadAppointments error', e); }
      }).catch((e) => { debug('firebaseReady rejected', e); });
    } else {
      try { loadAppointments(); } catch (e) { debug('init loadAppointments sync error', e); }
    }
  })();

})();
