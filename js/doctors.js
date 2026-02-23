// doctors.js — récupération et affichage des médecins
(function () {
  async function ensureFirebase() {
    if (!window.firebaseReady) throw new Error('firebaseReady non défini');
    return window.firebaseReady;
  }

  async function fetchDoctors() {
    await ensureFirebase();
    try {
      // Ne récupérer que les médecins approuvés afin qu'ils n'apparaissent
      // pas dans les listes tant que l'admin ne les a pas validés.
      const snapshot = await window.firebaseDb.collection('doctors')
        .where('status', '==', 'approved')
        .orderBy('name')
        .get();
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      populateDoctorSelect(docs);
      populateDoctorList(docs);
      return docs;
    } catch (err) {
      console.error('Erreur fetchDoctors', err);
      if (window.showToast) window.showToast('Impossible de charger la liste des médecins');
      return [];
    }
  }

  function populateDoctorSelect(doctors) {
    const sel = document.getElementById('doctor');
    if (!sel) return;
    sel.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Choisir un médecin —';
    sel.appendChild(placeholder);
    doctors.forEach(d => {
      const o = document.createElement('option');
      o.value = d.id;
      o.textContent = d.name || (d.specialty ? `${d.name} — ${d.specialty}` : d.name || d.id);
      sel.appendChild(o);
    });
  }

  function populateDoctorList(doctors, containerId = 'doctor-list') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    doctors.forEach(d => {
      const el = document.createElement('div');
      el.className = 'doctor-item';
      el.innerHTML = `<h3>${d.name || 'Médecin'}</h3><p class="muted small">${d.specialty || ''}</p>`;
      container.appendChild(el);
    });
  }

  // Exposer pour usage manuel
  window.loadDoctors = fetchDoctors;
  window.populateDoctorList = populateDoctorList;

  // tentative de chargement automatique après firebaseReady
  (function init() {
    if (window.firebaseReady && typeof window.firebaseReady.then === 'function') {
      window.firebaseReady.then(() => fetchDoctors()).catch(() => {});
    } else {
      try { fetchDoctors(); } catch (e) { /* noop */ }
    }
  })();

})();

