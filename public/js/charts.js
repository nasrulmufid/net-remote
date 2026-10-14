// Latency / uptime chart for the device detail page (ApexCharts, served from /vendor/apexcharts/).
(function () {
  'use strict';
  var el = document.getElementById('uptime-chart');
  if (!el || !window.ApexCharts) return;
  var sel = document.getElementById('chart-days');
  var pct = document.getElementById('uptime-pct');
  var chart;

  function theme() {
    var dark = document.documentElement.classList.contains('dark');
    return { mode: dark ? 'dark' : 'light', fg: dark ? '#9ca3af' : '#6b7280' };
  }

  async function load() {
    var res = await fetch('/api/stats/devices/' + el.getAttribute('data-uuid') + '?days=' + sel.value, { credentials: 'same-origin' });
    if (!res.ok) { el.textContent = 'Gagal memuat data grafik.'; return; }
    var d = await res.json();
    pct.textContent = d.uptime_pct == null ? '' : '· uptime ' + d.uptime_pct + '%';
    var latency = d.points.map(function (p) { return [p.t, p.latency]; });
    var down = d.points.map(function (p) { return [p.t, Math.round((1 - p.up_ratio) * 100)]; });
    var t = theme();
    var opts = {
      chart: { height: 300, type: 'line', background: 'transparent', toolbar: { show: false }, animations: { enabled: false }, foreColor: t.fg },
      theme: { mode: t.mode },
      series: [{ name: 'Latency (ms)', type: 'line', data: latency }, { name: 'Down (%)', type: 'column', data: down }],
      colors: ['#6366f1', '#ef4444'],
      stroke: { width: [2.5, 0], curve: 'smooth' },
      plotOptions: { bar: { columnWidth: '90%' } },
      xaxis: { type: 'datetime', labels: { datetimeUTC: false } },
      yaxis: [
        { title: { text: 'ms' }, min: 0, max: function (m) { return Math.max(10, Math.ceil(m * 1.2)); }, tickAmount: 5, labels: { formatter: function (v) { return Math.round(v); } } },
        { opposite: true, min: 0, max: 100, title: { text: 'Down %' }, labels: { formatter: function (v) { return Math.round(v); } } },
      ],
      dataLabels: { enabled: false },
      grid: { borderColor: t.mode === 'dark' ? '#374151' : '#e5e7eb' },
      legend: { position: 'top' },
      noData: { text: 'Belum ada data' },
      tooltip: { x: { format: 'dd MMM HH:mm' } },
    };
    if (chart) chart.destroy();
    chart = new ApexCharts(el, opts); chart.render();
  }
  sel.addEventListener('change', load);
  document.addEventListener('themechange', load);
  load();
})();
