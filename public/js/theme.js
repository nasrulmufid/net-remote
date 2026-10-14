// Loaded synchronously in <head> to avoid a flash of the wrong theme.
(function () {
	try {
		var t = localStorage.getItem('theme');
		if (
			t === 'dark' ||
			(!t && window.matchMedia('(prefers-color-scheme: dark)').matches)
		) {
			document.documentElement.classList.add('dark');
			document.documentElement.setAttribute('data-theme', 'dark');
		} else {
			document.documentElement.setAttribute('data-theme', 'light');
		}
	} catch (e) {
		/* storage blocked: fall back to light */
	}
})();
