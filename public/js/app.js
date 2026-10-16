// NetRemote UI behaviour: theme, device list polling, CRUD actions, import.
(function () {
	'use strict';
	var $ = function (s, r) {
		return (r || document).querySelector(s);
	};
	var $$ = function (s, r) {
		return Array.prototype.slice.call((r || document).querySelectorAll(s));
	};

	// ---- Lucide icons ----
	function renderIcons() {
		if (window.lucide && typeof window.lucide.createIcons === 'function') {
			window.lucide.createIcons();
		}
	}
	renderIcons();

	function csrf() {
		var m = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
		return m ? decodeURIComponent(m[1]) : '';
	}
	function toast(msg, ms) {
		var t = $('#toast');
		if (!t) return;
		t.textContent = msg;
		clearTimeout(toast._t);
		toast._t = setTimeout(function () {
			t.textContent = '';
		}, ms || 3000);
	}
	async function api(method, url, body, isForm) {
		var headers = { 'X-CSRF-Token': csrf(), Accept: 'application/json' };
		if (body && !isForm) headers['Content-Type'] = 'application/json';
		var res = await fetch(url, {
			method: method,
			headers: headers,
			body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
			credentials: 'same-origin',
		});
		if (res.status === 401) {
			var r = await fetch('/auth/refresh', {
				method: 'POST',
				credentials: 'same-origin',
			});
			if (r.ok) {
				headers['X-CSRF-Token'] = csrf();
				res = await fetch(url, {
					method: method,
					headers: headers,
					body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
					credentials: 'same-origin',
				});
			} else {
				location.href =
					'/login?next=' +
					encodeURIComponent(location.pathname + location.search);
				throw new Error('session expired');
			}
		}
		var data = null;
		try {
			data = await res.json();
		} catch (e) {
			/* empty body */
		}
		if (!res.ok) {
			var err = new Error(
				(data && data.error && data.error.message) || 'HTTP ' + res.status,
			);
			err.details = data && data.error && data.error.details;
			throw err;
		}
		return data;
	}
	window.NetRemote = { api: api, toast: toast, csrf: csrf };

	// ---- local time formatting ----
	var fmt = new Intl.DateTimeFormat('id-ID', {
		dateStyle: 'medium',
		timeStyle: 'medium',
	});
	function formatTimes(root) {
		$$('time[data-ts]', root).forEach(function (el) {
			var d = new Date(el.getAttribute('data-ts'));
			if (!isNaN(d)) {
				el.textContent = fmt.format(d);
				el.title = el.getAttribute('data-ts');
			}
		});
	}
	formatTimes();

	// ---- theme ----
	var themeBtn = $('#theme-toggle');
	if (themeBtn)
		themeBtn.addEventListener('click', function () {
			var dark = document.documentElement.classList.toggle('dark');
			document.documentElement.setAttribute(
				'data-theme',
				dark ? 'dark' : 'light',
			);
			try {
				localStorage.setItem('theme', dark ? 'dark' : 'light');
			} catch (e) {
				/* ignore */
			}
			document.dispatchEvent(
				new CustomEvent('themechange', { detail: { dark: dark } }),
			);
			var icon = themeBtn.querySelector('i, svg');
			if (icon) {
				var span = themeBtn.querySelector('span');
				var label = span ? span.textContent : '';
				themeBtn.innerHTML =
					'<i data-lucide="' +
					(dark ? 'sun' : 'moon') +
					'"></i>' +
					(span ? '<span>' + label + '</span>' : '');
				renderIcons();
			}
		});

	// ---- responsive sidebar ----
	// Two independent states:
	//   desktop rail  -> [data-collapsed] on the sidebar (owned by Stisla)
	//   mobile drawer -> <html class="nav-open"> (owned here)
	// Keeping them separate means collapsing the rail on desktop never hides the
	// drawer on mobile, and vice versa.
	var sidebar = $('#app-sidebar');
	var sidebarBackdrop = $('.sidebar-backdrop');
	var navToggle = $('.navbar__toggle');
	var mobileSidebar = window.matchMedia('(max-width: 1024px)');

	function isDrawerOpen() {
		return document.documentElement.classList.contains('nav-open');
	}
	function syncDrawer() {
		var open = isDrawerOpen();
		document.documentElement.classList.toggle('nav-locked', open);
		if (sidebarBackdrop) {
			sidebarBackdrop.hidden = !open;
			sidebarBackdrop.classList.toggle('is-visible', open);
		}
		if (navToggle) navToggle.setAttribute('aria-expanded', String(open));
	}
	function openDrawer() {
		if (!mobileSidebar.matches) return;
		document.documentElement.classList.add('nav-open');
		syncDrawer();
	}
	function closeDrawer() {
		document.documentElement.classList.remove('nav-open');
		syncDrawer();
	}
	function toggleDrawer() {
		if (isDrawerOpen()) closeDrawer();
		else openDrawer();
	}

	if (navToggle) navToggle.addEventListener('click', toggleDrawer);
	if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeDrawer);
	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape' && isDrawerOpen()) {
			closeDrawer();
			if (navToggle) navToggle.focus();
		}
	});
	// Leaving the mobile breakpoint closes the drawer so it can't linger open.
	// Entering mobile drops the desktop rail state so the drawer shows full labels;
	// returning to desktop restores the user's rail preference.
	var desktopCollapsed = sidebar
		? sidebar.hasAttribute('data-collapsed')
		: false;
	function onBreakpointChange() {
		if (!sidebar) return;
		if (mobileSidebar.matches) {
			desktopCollapsed = sidebar.hasAttribute('data-collapsed');
			sidebar.removeAttribute('data-collapsed');
			closeDrawer();
		} else {
			sidebar.toggleAttribute('data-collapsed', desktopCollapsed);
		}
	}
	if (typeof mobileSidebar.addEventListener === 'function') {
		mobileSidebar.addEventListener('change', onBreakpointChange);
	} else if (typeof mobileSidebar.addListener === 'function') {
		mobileSidebar.addListener(onBreakpointChange);
	}
	// Initial load on mobile: never start in rail mode.
	if (sidebar && mobileSidebar.matches)
		sidebar.removeAttribute('data-collapsed');
	syncDrawer();

	// ---- device list: filters + polling (server-rendered fragment) ----
	var tbody = $('#device-rows'),
		form = $('#filters');
	function query() {
		var p = new URLSearchParams();
		if (form)
			new FormData(form).forEach(function (v, k) {
				if (v) p.set(k, v);
			});
		return p;
	}
	var inflight = 0;
	async function refreshRows() {
		if (!tbody) return;
		var id = ++inflight;
		try {
			var res = await fetch('/fragments/device-rows?' + query(), {
				credentials: 'same-origin',
				headers: { Accept: 'text/html' },
			});
			if (res.status === 401) {
				var r = await fetch('/auth/refresh', {
					method: 'POST',
					credentials: 'same-origin',
				});
				if (!r.ok) {
					location.href = '/login';
					return;
				}
				return refreshRows();
			}
			if (!res.ok || id !== inflight) return;
			tbody.innerHTML = await res.text();
			formatTimes(tbody);
			renderIcons();
			var st = await api('GET', '/api/stats');
			$$('[data-stat]').forEach(function (el) {
				el.textContent = st[el.getAttribute('data-stat')];
			});
			var lr = $('#last-refresh');
			if (lr)
				lr.textContent = 'terakhir ' + new Date().toLocaleTimeString('id-ID');
			var emptyState = $('#device-empty-state');
			if (emptyState) {
				var hasRows = tbody.querySelectorAll('tr').length > 0;
				emptyState.hidden = hasRows;
				if (!hasRows) {
					var heading = emptyState.querySelector('h4');
					var copy = emptyState.querySelector('p');
					var filtered = Array.from(query().values()).length > 0;
					if (heading)
						heading.textContent = filtered
							? 'Tidak ada perangkat yang cocok'
							: 'Belum ada perangkat';
					if (copy)
						copy.textContent = filtered
							? 'Coba ubah kata kunci atau atur ulang filter.'
							: 'Tambahkan perangkat pertama Anda untuk mulai memantau.';
				}
			}
		} catch (e) {
			/* transient network error: try again next tick */
		}
	}
	if (tbody) {
		refreshRows();
		setInterval(refreshRows, 30000);
	}
	if (form)
		form.addEventListener('submit', function (e) {
			e.preventDefault();
			refreshRows();
		});

	// ---- delete device ----
	document.addEventListener('click', function (e) {
		var del = e.target.closest('[data-delete]');
		if (!del) return;
		e.preventDefault();
		var uuid = del.getAttribute('data-delete');
		if (!confirm('Hapus perangkat ini?')) return;
		api('DELETE', '/api/devices/' + uuid)
			.then(function () {
				toast('Perangkat dihapus');
				refreshRows();
			})
			.catch(function (err) {
				toast('Gagal: ' + err.message);
			});
	});

	// ---- copy UUID ----
	document.addEventListener('click', function (e) {
		var c = e.target.closest('[data-copy]');
		if (c) {
			navigator.clipboard.writeText(c.getAttribute('data-copy')).then(
				function () {
					toast('UUID disalin');
				},
				function () {
					toast('Gagal menyalin');
				},
			);
		}
	});

	// ---- import spreadsheet ----
	var importBtn = $('#import-btn'),
		importFile = $('#import-file'),
		importFeedback = $('#import-feedback');
	function showImportFeedback(kind, title, summary, errors) {
		if (!importFeedback) return;
		var titleEl = $('#import-feedback-title');
		var summaryEl = $('#import-feedback-summary');
		var errorsEl = $('#import-feedback-errors');
		var iconEl = $('#import-feedback-icon');
		importFeedback.hidden = false;
		importFeedback.className = 'import-feedback import-feedback--' + kind;
		importFeedback.setAttribute('role', kind === 'error' ? 'alert' : 'status');
		if (titleEl) titleEl.textContent = title;
		if (summaryEl) summaryEl.textContent = summary;
		if (errorsEl) {
			errorsEl.replaceChildren();
			(errors || []).slice(0, 8).forEach(function (entry) {
				var li = document.createElement('li');
				li.textContent =
					entry && typeof entry === 'object'
						? 'Baris ' +
							(entry.row || '?') +
							': ' +
							(entry.message || 'Data tidak dapat diproses')
						: String(entry);
				errorsEl.appendChild(li);
			});
			if ((errors || []).length > 8) {
				var more = document.createElement('li');
				more.textContent = 'Dan ' + (errors.length - 8) + ' kesalahan lainnya.';
				errorsEl.appendChild(more);
			}
		}
		if (iconEl) {
			var iconName =
				kind === 'error'
					? 'circle-alert'
					: kind === 'warning'
						? 'triangle-alert'
						: 'circle-check';
			iconEl.innerHTML = '<i data-lucide="' + iconName + '"></i>';
			renderIcons();
		}
		importFeedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}
	if (importBtn && importFile) {
		importBtn.addEventListener('click', function () {
			importFile.click();
		});
		importFile.addEventListener('change', async function () {
			var f = importFile.files[0];
			if (!f) return;
			if (!/\.(xlsx|xls)$/i.test(f.name)) {
				showImportFeedback(
					'error',
					'Format file tidak didukung',
					'Pilih file spreadsheet dengan format .xls atau .xlsx.',
				);
				importFile.value = '';
				return;
			}
			if (f.size > 5 * 1024 * 1024) {
				showImportFeedback(
					'error',
					'File terlalu besar',
					'Ukuran maksimum file impor adalah 5 MB.',
				);
				importFile.value = '';
				return;
			}
			var fd = new FormData();
			fd.append('file', f);
			importBtn.disabled = true;
			importBtn.innerHTML =
				'<i data-lucide="loader-circle" class="spin"></i> Mengimpor…';
			renderIcons();
			try {
				var r = await api('POST', '/api/devices/import', fd, true);
				var errors = Array.isArray(r && r.errors) ? r.errors : [];
				var imported = Number((r && r.imported) || 0);
				var skipped = Number((r && r.skipped) || 0);
				showImportFeedback(
					errors.length
						? imported || skipped
							? 'warning'
							: 'error'
						: 'success',
					errors.length ? 'Impor selesai dengan catatan' : 'Impor berhasil',
					imported +
						' perangkat ditambahkan · ' +
						skipped +
						' dilewati · ' +
						errors.length +
						' kesalahan',
					errors,
				);
				toast(
					'Impor selesai: ' +
						imported +
						' ditambahkan, ' +
						skipped +
						' dilewati',
				);
				refreshRows();
			} catch (err) {
				showImportFeedback(
					'error',
					'Impor gagal',
					err.message ||
						'Terjadi kesalahan saat membaca file. Periksa format dan coba lagi.',
				);
			}
			importBtn.disabled = false;
			importBtn.innerHTML = '<i data-lucide="upload"></i> Impor spreadsheet';
			renderIcons();
			importFile.value = '';
		});
	}
	var importClose = $('#import-feedback-close');
	if (importClose && importFeedback) {
		importClose.addEventListener('click', function () {
			importFeedback.hidden = true;
		});
	}

	// ---- export csv ----
	var exportBtn = $('#export-btn');
	if (exportBtn) {
		exportBtn.addEventListener('click', function () {
			window.open('/api/devices/export?' + query(), '_blank');
		});
	}

	// ---- device form (add/edit) ----
	var deviceForm = $('#device-form');
	if (deviceForm) {
		deviceForm.addEventListener('submit', async function (e) {
			e.preventDefault();
			var btn = deviceForm.querySelector('[type="submit"]');
			var original = btn.innerHTML;
			btn.disabled = true;
			btn.innerHTML =
				'<i data-lucide="loader-circle" class="spin"></i> Menyimpan...';
			renderIcons();

			var data = {
				name: $('#name').value.trim(),
				ip: $('#ip').value.trim(),
				port: parseInt($('#port').value, 10),
				protocol: $('#protocol').value,
				type: $('#type').value,
				vendor: $('#vendor').value.trim(),
				location: $('#location').value.trim(),
				group_tag: $('#group_tag').value,
				notes: $('#notes').value.trim(),
			};

			try {
				var res = await api(
					deviceForm.getAttribute('data-method'),
					deviceForm.getAttribute('data-action'),
					data,
				);
				if (
					deviceForm.getAttribute('data-redirect') === 'detail' &&
					res &&
					res.uuid
				) {
					toast('Perangkat berhasil ditambahkan');
					window.location.href = '/devices/' + res.uuid;
				} else {
					toast('Perangkat berhasil diperbarui');
				}
			} catch (err) {
				toast('Gagal: ' + err.message);
			} finally {
				btn.disabled = false;
				btn.innerHTML = original;
				renderIcons();
			}
		});
	}
})();
