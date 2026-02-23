// utils.js — helpers UI et utilitaires légers
(function () {
	// Simple toast implementation (injecte un conteneur dans le body)
	function ensureToastContainer() {
		let c = document.getElementById('toast-container');
		if (!c) {
			c = document.createElement('div');
			c.id = 'toast-container';
			const style = c.style;
			style.position = 'fixed';
			style.right = '20px';
			style.bottom = '20px';
			style.zIndex = 10000;
			style.display = 'flex';
			style.flexDirection = 'column';
			style.gap = '8px';
			document.body.appendChild(c);
		}
		return c;
	}

	function showToast(message, opts = {}) {
		const container = ensureToastContainer();
		const el = document.createElement('div');
		el.textContent = message;
		el.style.background = opts.background || 'rgba(0,0,0,0.8)';
		el.style.color = opts.color || '#fff';
		el.style.padding = '8px 12px';
		el.style.borderRadius = '6px';
		el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
		el.style.maxWidth = '320px';
		el.style.fontSize = '14px';
		container.appendChild(el);
		const duration = opts.duration || 3000;
		setTimeout(() => {
			el.style.transition = 'opacity 300ms ease';
			el.style.opacity = '0';
			setTimeout(() => el.remove(), 350);
		}, duration);
		return el;
	}

	function formatDate(value) {
		if (!value) return '';
		let d;
		// firebase Timestamp compat
		if (value.toDate && typeof value.toDate === 'function') {
			d = value.toDate();
		} else if (value.seconds) {
			d = new Date(value.seconds * 1000);
		} else {
			d = new Date(value);
		}
		if (isNaN(d.getTime())) return '';
		return d.toLocaleString();
	}

	// Exposer globalement
	window.showToast = showToast;
	window.formatDate = formatDate;

})();

