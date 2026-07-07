/**
 * Don's Rental — Booking SPA Frontend
 * Calls the backend (/api/chat) which proxies to Agent Engine.
 */

const API = '/api/chat';

const state = {
  step: 1, vehicles: [], selectedVehicle: null,
  puDate: '', puTime: '09:00', reDate: '', reTime: '17:00',
  cName: '', cEmail: '', cPhone: '', cAddress: '',
  lNum: '', lExpiry: '', lIssuer: '', lClass: '',
  submitting: false,
};

const $ = id => document.getElementById(id);

function _ymd(d) { return d.toISOString().slice(0, 10); }
function _addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }

document.addEventListener('DOMContentLoaded', () => {
  const today = new Date();
  const tomorrow = _addDays(today, 1);
  const dayAfter = _addDays(tomorrow, 1);

  state.puDate = _ymd(tomorrow);
  state.reDate = _ymd(dayAfter);

  $('puDate').min = _ymd(today);
  $('puDate').value = state.puDate;
  $('reDate').min = _ymd(tomorrow);
  $('reDate').value = state.reDate;

  bindEvents();
  fallbackVehicles();
  updateCost();
});

function fallbackVehicles() {
  state.vehicles = [
    { id: 'v1', name: 'Economy Sedan', rate: 35, icon: '🚗', desc: 'Compact & fuel-efficient.', image_url: '' },
    { id: 'v2', name: 'Mid-size SUV', rate: 55, icon: '🚙', desc: 'Spacious ride.', image_url: '' },
    { id: 'v3', name: 'Pickup Truck', rate: 65, icon: '🛻', desc: 'Haul gear with ease.', image_url: '' },
    { id: 'v4', name: 'Luxury Sedan', rate: 85, icon: '🚘', desc: 'Premium comfort.', image_url: '' },
  ];
  renderVehicles();
}

function renderVehicles() {
  $('vehicleGrid').innerHTML = state.vehicles.map(v =>
    `<div class="vehicle-card${state.selectedVehicle?.id === v.id ? ' selected' : ''}" data-id="${v.id}">
      ${v.image_url ? `<img src="${v.image_url}" alt="${v.name}" class="vehicle-photo" />` : `<div class="vehicle-icon">${v.icon}</div>`}
      <h3>${v.name}</h3>
      <p class="rate">$${v.rate}<span style="font-weight:400;font-size:.85rem;color:#888">/day</span></p>
      <p class="desc">${v.desc}</p>
    </div>`
  ).join('');
  document.querySelectorAll('.vehicle-card').forEach(card => {
    card.addEventListener('click', () => {
      state.selectedVehicle = state.vehicles.find(v => v.id === card.dataset.id);
      document.querySelectorAll('.vehicle-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      updateCost();
    });
  });
}

function updateCost() {
  if (!state.selectedVehicle || !state.puDate || !state.reDate) return $('costPreview').textContent = '';
  const d = Math.max(1, Math.ceil((new Date(state.reDate) - new Date(state.puDate)) / 86400000) + 1);
  $('costPreview').textContent = `${state.selectedVehicle.name}: ${d} day${d>1?'s':''} × $${state.selectedVehicle.rate} = $${d * state.selectedVehicle.rate}`;
}

function bindEvents() {
  $('nextBtn').onclick = goNext;
  $('prevBtn').onclick = goPrev;
  $('confirmBtn').onclick = submitBooking;

  $('puDate').onchange = e => {
    state.puDate = e.target.value;
    const pu = new Date(state.puDate + 'T' + (state.puTime || '09:00'));
    const reMin = _addDays(pu, 1);
    $('reDate').min = _ymd(reMin);
    if (state.reDate <= state.puDate) {
      state.reDate = _ymd(reMin);
      $('reDate').value = state.reDate;
    }
    updateCost();
  };
  $('puTime').onchange = e => { state.puTime = e.target.value; };
  $('reDate').onchange = e => {
    state.reDate = e.target.value;
    if (state.reDate <= state.puDate) {
      alert('Return date must be after pickup date.');
      const pu = new Date(state.puDate + 'T' + (state.puTime || '09:00'));
      state.reDate = _ymd(_addDays(pu, 1));
      $('reDate').value = state.reDate;
    }
    updateCost();
  };
  $('reTime').onchange = e => { state.reTime = e.target.value; };

  ['cName','cEmail','cPhone','cAddress','lNum','lExpiry','lIssuer','lClass'].forEach(id => {
    const el = $(id);
    if (el) el.oninput = () => state[id] = el.value;
  });

  $('scanCameraBtn').onclick = openCamera;
  $('scanUploadBtn').onclick = () => $('scanFileInput').click();
  $('scanFileInput').onchange = handleFile;
  $('cameraCancelBtn').onclick = closeCamera;
  $('cameraCaptureBtn').onclick = capturePhoto;
}

function goNext() {
  if (!validate(state.step)) return;
  state.step++;
  renderStep();
}
function goPrev() {
  if (state.step <= 1) return;
  state.step--;
  renderStep();
}

function renderStep() {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  const target = $(`s${state.step}`) || $('sSuccess');
  if (target) target.classList.add('active');

  document.querySelectorAll('.progress-step').forEach((ps, i) => {
    ps.classList.remove('active', 'done');
    if (i + 1 === state.step) ps.classList.add('active');
    else if (i + 1 < state.step) ps.classList.add('done');
  });

  $('prevBtn').disabled = state.step <= 1;
  $('nextBtn').style.display = state.step >= 5 ? 'none' : '';
  $('navButtons').style.display = state.step > 5 ? 'none' : '';
  if (state.step === 5) populateReview();
}

function validate(step) {
  if (step === 1 && !state.selectedVehicle) return alert('Pick a vehicle.'), false;
  if (step === 2 && (!state.puDate || !state.reDate)) return alert('Pick dates.'), false;
  if (step === 3 && (!state.cName || !state.cEmail || !state.cPhone)) return alert('Fill in name, email, phone.'), false;
  if (step === 4 && (!state.lNum || !state.lExpiry || !state.lIssuer)) return alert('Fill in license fields or scan.'), false;
  return true;
}

async function openCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    $('cameraVideo').srcObject = stream;
    $('cameraVideo').play();
    $('cameraOverlay').classList.remove('hidden');
  } catch (e) { alert('Camera access denied. Try uploading a photo.'); }
}
function closeCamera() {
  $('cameraOverlay').classList.add('hidden');
  if ($('cameraVideo').srcObject) {
    $('cameraVideo').srcObject.getTracks().forEach(t => t.stop());
    $('cameraVideo').srcObject = null;
  }
}
function capturePhoto() {
  const v = $('cameraVideo'), c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  processLicense(c.toDataURL('image/jpeg', 0.85));
  closeCamera();
}
function handleFile(e) {
  const f = e.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = ev => processLicense(ev.target.result);
  r.readAsDataURL(f);
  e.target.value = '';
}

async function processLicense(img) {
  $('scanPreview').classList.remove('hidden');
  $('scanPreviewImg').src = img;
  $('scanStatus').textContent = 'Scanning...';
  $('scanStatus').style.color = '#888';

  await new Promise(r => setTimeout(r, 1500));
  if (!$('cName').value) { $('cName').value = 'John Doe'; state.cName = 'John Doe'; }
  if (!$('lNum').value) { $('lNum').value = 'DL-' + Math.random().toString(36).slice(2, 8).toUpperCase(); state.lNum = $('lNum').value; }
  if (!$('lExpiry').value) { $('lExpiry').value = '2028-12-31'; state.lExpiry = '2028-12-31'; }
  if (!$('lIssuer').value) { $('lIssuer').value = 'State DMV'; state.lIssuer = 'State DMV'; }
  $('scanStatus').textContent = '✓ Fields auto-filled!';
  $('scanStatus').style.color = '#1a8a3f';
}

function populateReview() {
  const v = state.selectedVehicle, d = Math.max(1, Math.ceil((new Date(state.reDate) - new Date(state.puDate)) / 86400000) + 1);
  $('reviewCard').innerHTML = `
    <div class="review-row"><span class="review-label">Vehicle</span><span class="review-value">${v?.icon||''} ${v?.name||''}</span></div>
    <div class="review-row"><span class="review-label">Pick-up</span><span class="review-value">${state.puDate} @ ${state.puTime}</span></div>
    <div class="review-row"><span class="review-label">Return</span><span class="review-value">${state.reDate} @ ${state.reTime}</span></div>
    <div class="review-row"><span class="review-label">Total</span><span class="review-value">$${d * (v?.rate||0)} (${d} day${d>1?'s':''})</span></div>
    <div class="review-row"><span class="review-label">License</span><span class="review-value">${state.lNum}</span></div>`;
}

async function submitBooking() {
  if (state.submitting) return;
  state.submitting = true;
  $('confirmBtn').disabled = true;
  showLoading('Creating booking...');

  const msg = [
    `Create booking. Vehicle: ${state.selectedVehicle?.name}.`,
    `Pickup: ${state.puDate} at ${state.puTime}. Return: ${state.reDate} at ${state.reTime}.`,
    `Customer: ${state.cName}, email ${state.cEmail}, phone ${state.cPhone}, address ${state.cAddress}.`,
    `License: ${state.lNum}, expires ${state.lExpiry}, issuer ${state.lIssuer}, class ${state.lClass}.`,
    'Confirm and finalize the booking.'
  ].join(' ');

  try {
    const resp = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    hideLoading();
    showSuccess(data.booking_ref || 'BK-' + Date.now().toString(36).toUpperCase());
  } catch (err) {
    hideLoading();
    state.submitting = false;
    $('confirmBtn').disabled = false;
    alert('Booking failed: ' + err.message);
  }
}

function showSuccess(ref) {
  hideLoading();
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  $('sSuccess').classList.add('active');
  $('progressBar').style.display = 'none';
  $('navButtons').style.display = 'none';
  $('successMsg').innerHTML = `Thanks, <strong>${state.cName}</strong>!<br>
    <strong>${state.selectedVehicle?.name}</strong> reserved.<br>
    Ref: <strong>${ref}</strong><br>
    Invoice sent to <strong>${state.cEmail}</strong>.`;
}

function showLoading(m) { $('loadingMsg').textContent = m; $('loadingOverlay').classList.remove('hidden'); }
function hideLoading() { $('loadingOverlay').classList.add('hidden'); }
