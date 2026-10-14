// Demo data: `npm run seed` (needs a valid .env). Inserts sample devices (idempotent on ip:port).
import { migrate, seedAdmin } from '../src/db/index.js';
import * as devices from '../src/services/device.service.js';

migrate();
seedAdmin(console);

const demo = [
  { name: 'OLT Pusat', ip: '192.168.88.10', port: 80, type: 'OLT', vendor: 'ZTE', location: 'POP Pusat', group_tag: 'Core' },
  { name: 'Switch Distribusi 1', ip: '192.168.88.20', port: 80, type: 'Switch', vendor: 'TP-Link', location: 'POP Pusat', group_tag: 'Core' },
  { name: 'Router Utama', ip: '192.168.88.1', port: 8880, type: 'Router', vendor: 'MikroTik', location: 'POP Pusat', group_tag: 'Core' },
  { name: 'ONU Pelanggan 001', ip: '10.10.1.101', port: 80, type: 'ONU', vendor: 'Huawei', location: 'Desa A', group_tag: 'Desa A' },
  { name: 'AP Balai Desa', ip: '10.10.2.5', port: 80, type: 'AP', vendor: 'Ubiquiti', location: 'Desa B', group_tag: 'Desa B' },
];
let n = 0;
for (const d of demo) {
  try { devices.create(devices.deviceInput.parse({ protocol: 'http', notes: 'demo', ...d })); n += 1; } catch { /* duplicate */ }
}
console.log(`seeded ${n} demo device(s)`);
