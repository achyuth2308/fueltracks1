const axios = require('axios');
const jwt = require('jsonwebtoken');

async function test() {
  const secret = '5d6a3875c362deb8461a0b01ddb9b1cd1000bb95bb533407ea08671717fb3120a144142c7d1fdf7c22c4fcaf8bdcceef867267ef1da2d772b00e1a96ff3f937e';
  const token = jwt.sign({ userId: '00000000-0000-0000-0000-000000000000', role: 'customer' }, secret, { expiresIn: '1h' });
  const id = '877928bc-62e2-456c-9489-dfda0e696f80';
  const api = axios.create({ baseURL: 'http://127.0.0.1:3001', headers: { Authorization: `Bearer ${token}` } });

  console.log('Testing getVehicleById...');
  await api.get(`/api/vehicles/${id}`).then(() => console.log('OK')).catch(e => console.log('Err', e.message));

  console.log('Testing getVehicleAlerts...');
  await api.get(`/api/vehicles/${id}/alerts?limit=8`).then(() => console.log('OK')).catch(e => console.log('Err', e.message));

  console.log('Testing getVehicleReport...');
  await api.get(`/api/vehicles/${id}/report?startDate=2026-10-01T18:30:00.000Z&endDate=2026-10-02T18:29:59.999Z`).then(() => console.log('OK')).catch(e => console.log('Err', e.message));
}
test();
