/** 
 * SANNUR OMS - Asosiy mantiqiy kod (app.js)
 * Firebase Realtime Database orqali ishlaydi.
 */

// ================= FIREBASE KONFIGURATSIYA =================
// DIQQAT: O'zingizning Firebase Config ma'lumotlaringizni shu yerga joylashtiring:
const firebaseConfig = {
  apiKey: "AIzaSyD88rr7BgxZM3E9cIz4CpRRUQ0m2hyOTuI",
  authDomain: "sannur-ca2cf.firebaseapp.com",
  databaseURL: "https://sannur-ca2cf-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "sannur-ca2cf",
  storageBucket: "sannur-ca2cf.firebasestorage.app",
  messagingSenderId: "1055242269807",
  appId: "1:1055242269807:web:d3dc9a61c08404f1ee499a",
  measurementId: "G-CDLB2R6PPX"
};

// Firebase-ni ishga tushirish
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ================= STEYT (MA'LUMOTLAR) =================
let data = {
  mahsulotlar: [], 
  yozuvlar: [],    
  ustalar: []      
};

let pendingKirim = [];
let pendingChiqim = [];
let currentUserRole = null; 
let html5QrcodeScanner = null;
let currentScannerTarget = ''; 
let itemEditIndex = null;
let dataLoaded = false; 
let currentHistoryTab = 'all'; 

// ================= INITALIZATSIYA =================
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  checkAuth();
  
  const today = new Date().toISOString().split('T')[0];
  if(document.getElementById('k-sana')) document.getElementById('k-sana').value = today;
  if(document.getElementById('c-sana')) document.getElementById('c-sana').value = today;

  document.getElementById('qoldiq-search')?.addEventListener('input', renderQoldiq);
});

function loadData() {
  // 1. Dastlab LocalStorage-dan yuklash (tezkor ko'rinishi uchun)
  const local = localStorage.getItem('sannurLocalData');
  if (local) {
    try {
      data = JSON.parse(local);
      refreshAllDataViews();
    } catch (e) { console.error("Local data error", e); }
  }

  // 2. Firebase-dan real-vaqtda ma'lumotlarni olish
  db.ref('sannurData').on('value', (snapshot) => {
    const cloudData = snapshot.val();
    if (cloudData) {
      data = cloudData;
      if (!data.mahsulotlar) data.mahsulotlar = [];
      if (!data.yozuvlar) data.yozuvlar = [];
      if (!data.ustalar) data.ustalar = [];
      
      // LocalStorage-ni ham yangilab qo'yamiz
      localStorage.setItem('sannurLocalData', JSON.stringify(data));
      
      updateStats();
      refreshAllDataViews(); 
      dataLoaded = true;
    } else {
      dataLoaded = true;
    }
  });
}

function saveData() {
  if (!dataLoaded) {
    console.warn("Ma'lumot hali yuklanmagan, saqlash bekor qilindi.");
    return;
  }
  
  // 1. LocalStorage-ga saqlash (zaxira uchun)
  localStorage.setItem('sannurLocalData', JSON.stringify(data));

  // 2. Firebase-ga saqlash
  db.ref('sannurData').set(data).then(() => {
    updateStats();
    refreshAllDataViews();
  }).catch(err => {
    console.error("Firebase-ga saqlashda xatolik:", err);
    // Xatolik bo'lsa ham local saqlangan bo'ladi
    toast("Internetda xatolik! Ma'lumot vaqtincha qurilmada saqlandi.", "warn");
  });
}

// ================= AVTORIZATSIYA (LOGIN) =================
function checkAuth() {
  const auth = localStorage.getItem('sannurAuth'); // 'admin' / 'viewer'
  if (auth) {
    currentUserRole = auth;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('user-badge-text').innerText = auth === 'admin' ? 'Admin' : 'Kuzatuvchi';
    
    if (auth === 'viewer') {
      document.querySelector('.readonly-notice').style.display = 'block';
      // Tugmalarni o'chirish (readonly rejimi)
      document.querySelectorAll('button:not(.nav, .theme-toggle, .logout-btn, .download-btn, #nav-dashboard, #nav-kirim, #nav-chiqim, #nav-mahsulot, #nav-tarix, #nav-qoldiq, #nav-usta)').forEach(b => {
        if(b.onclick && b.innerText.includes('Saqlash') || b.innerText.includes('Qoshish') || b.innerText.includes('O\'chirish')) {
            b.style.display = 'none';
        }
      });
    }
    
    // Ilovani birinchi ekrani bilan yuklash
    refreshAllDataViews();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }
}

function doLogin() {
  const u = document.getElementById('login-user').value.trim();
  const p = document.getElementById('login-pass').value.trim();
  const err = document.getElementById('login-error');
  
  if (u === 'admin' && p === '8580') {
    localStorage.setItem('sannurAuth', 'admin');
    checkAuth();
  } else if ((u === 'admin' && p === 'admin') || (u === 'viewer' && p === 'viewer')) {
    localStorage.setItem('sannurAuth', 'viewer');
    checkAuth();
  } else {
    err.innerText = "Login yoki parol noto'g'ri!";
    err.style.display = 'block';
  }
}

function doLogout() {
  if (confirm("Tizimdan chiqishni xohlaysizmi?")) {
    localStorage.removeItem('sannurAuth');
    currentUserRole = null;
    location.reload();
  }
}

// ================= NAVIGATSIYA =================
function showTab(tabId) {
  // Barcha tablarni yopish
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  
  // Tanlanganni ochish
  document.getElementById(`panel-${tabId}`).classList.add('active');
  const navBtn = document.getElementById(`nav-${tabId}`);
  if(navBtn) navBtn.classList.add('active');

  if(tabId === 'qoldiq') renderQoldiq();
  if(tabId === 'tarix') renderTarix();
  if(tabId === 'usta') renderUstalar();
  if(tabId === 'obyekt') renderObyektlar();
  if(tabId === 'hisobot') renderHisobot();
  
  // Dashboardga o'tilganda activity ro'yxatini yangilash
  if(tabId === 'dashboard') updateDashboardRecent();
}

// ================= ASOSIY FUNKSIYALAR: ZAXIRA HISOBLASH =================
function getJoriyZaxira(mahsulotNomi) {
  let m = data.mahsulotlar.find(x => x.nom === mahsulotNomi);
  if (!m) return 0;
  
  // Boshlang'ich qoldiq
  let qoldiq = parseFloat(m.boshlangich || 0);
  
  // Operatsiyalar orqali yig'ish
  data.yozuvlar.filter(y => y.mahsulot === mahsulotNomi).forEach(y => {
    let mt = parseFloat(y.miqdor) || 0;
    if (y.tur === 'kirim') {
        // Tahrirlash (korreksiya) bo'lsa
        if(y.izoh && y.izoh.includes('[KORREKSIYA]')) {
             qoldiq = mt; // Yangi o'rnatilgan qoldiq
        } else {
             qoldiq += mt;
        }
    } else if (y.tur === 'chiqim') {
        qoldiq -= mt;
    }
  });
  
  return parseFloat(qoldiq.toFixed(2));
}

// ================= STATISTIKA VA DASHBOARD =================
function updateStats() {
  const mSoni = data.mahsulotlar.length;
  const oSoni = data.yozuvlar.length;
  // Klientlar sonini hisoblash (chiqimdagi jozibador klient ismlari)
  const kl = new Set();
  data.yozuvlar.forEach(y => { if (y.tur === 'chiqim' && y.tel) kl.add(y.tel.trim().toLowerCase()); });
  const kSoni = kl.size;
  
  // Kam qolganlar
  let kamSoni = 0;
  data.mahsulotlar.forEach(m => {
    const q = getJoriyZaxira(m.nom);
    const min = parseFloat(m.min || 0);
    if (q <= min) kamSoni++;
  });

  // Yuqori bar
  setElVal('st-mahsulot', mSoni);
  setElVal('st-klient', kSoni);
  setElVal('st-operatsiya', oSoni);
  setElVal('st-kam', kamSoni);

  // Dashboard
  setElVal('dash-mahsulot', mSoni);
  setElVal('dash-klient', kSoni);
  setElVal('dash-operatsiya', oSoni);
  setElVal('dash-kam', kamSoni);
}

function updateDashboardRecent() {
  const list = document.getElementById('dash-recent');
  if(!list) return;
  list.innerHTML = '';
  const last5 = [...data.yozuvlar].reverse().slice(0, 5);
  
  if (last5.length === 0) { list.innerHTML = '<div class="empty">Harakatlar yo\'q</div>'; return; }
  
  last5.forEach(y => {
    const div = document.createElement('div');
    div.className = `act-item ${y.tur}`;
    const znak = y.tur === 'kirim' ? '+' : '-';
    div.innerHTML = `
      <div class="ai-info">
        <div class="ai-title">${y.mahsulot}</div>
        <div class="ai-sub">${y.sana} • ${y.ism || 'Noma\'lum'} • ${y.izoh || ''}</div>
      </div>
      <div class="ai-val">${znak}${y.miqdor} ${y.birlik}</div>
    `;
    list.appendChild(div);
  });
}

// ================= DATALIST VA SELECTLARNI YANGILASH =================
function updateDatalists() {
  const mList1 = document.getElementById('mahsulot-list');
  const mList2 = document.getElementById('mahsulot-list2');
  const uList = document.getElementById('c-usta');
  const oList = document.getElementById('obyekt-list');
  const fList1 = document.getElementById('filter-mahsulot');
  const fList2 = document.getElementById('filter-usta');
  
  if(mList1) mList1.innerHTML = '';
  if(mList2) mList2.innerHTML = '';
  if(fList1) fList1.innerHTML = '<option value="">Barcha mahsulotlar</option>';
  
  data.mahsulotlar.forEach(m => {
    const opt = `<option value="${m.nom}">Barkod: ${m.barcode||'-'}</option>`;
    if(mList1) mList1.innerHTML += opt;
    if(mList2) mList2.innerHTML += opt;
    if(fList1) fList1.innerHTML += `<option value="${m.nom}">${m.nom}</option>`;
  });
  
  if(uList) {
    uList.innerHTML = '<option value="">-- Usta tanlang --</option>';
    data.ustalar.forEach(u => uList.innerHTML += `<option value="${u}">${u}</option>`);
  }
  if(oList) {
    oList.innerHTML = '';
    const obs = new Set();
    data.yozuvlar.forEach(y => { if(y.obyekt) obs.add(y.obyekt); });
    obs.forEach(o => oList.innerHTML += `<option value="${o}">`);
  }
  if(fList2) {
    fList2.innerHTML = '<option value="">Barcha ustalar</option>';
    data.ustalar.forEach(u => fList2.innerHTML += `<option value="${u}">${u}</option>`);
  }
}

function refreshAllDataViews() {
  updateDatalists();
  updateStats();
  renderQoldiq();
  updateDashboardRecent();
  renderUstalar();
  renderObyektlar();
  renderTarix();
  renderHisobot();
}

// ================= KIRIM / CHIQIM FUNKSIYALARI =================
function mahsulotTanlandi(type) {
  const qPref = type === 'kirim' ? 'k' : 'c';
  const nom = document.getElementById(`${qPref}-mahsulot`).value;
  const infoWrap = document.getElementById(`${qPref}-zaxira-info`);
  const infoNum = document.getElementById(`${qPref}-zi-num`);
  const infoDot = document.getElementById(`${qPref}-zi-dot`);
  
  const m = data.mahsulotlar.find(x => x.nom === nom);
  if (m) {
    document.getElementById(`${qPref}-birlik`).value = m.birlik;
    const qol = getJoriyZaxira(nom);
    infoWrap.classList.add('visible');
    infoNum.innerText = `${qol} ${m.birlik}`;
    
    infoDot.className = 'zi-dot';
    if(qol <= (parseFloat(m.min)||0)) infoDot.classList.add('warn');
    else if(qol <= 0) infoDot.classList.add('danger');
    else infoDot.classList.add('success');
  } else {
    infoWrap.classList.remove('visible');
  }
}

function chiqimSummaHisob() {
  const miq = parseFloat(document.getElementById('c-miqdor').value) || 0;
  const narx = parseFloat(document.getElementById('c-narx').value) || 0;
  document.getElementById('c-jami-summa').innerText = (miq * narx).toLocaleString() + " so'm";
}

function barkodQidir(type) {
  const qPref = type === 'kirim' ? 'k' : 'c';
  const bc = document.getElementById(`${qPref}-barkod-search`).value.trim();
  if(!bc) return;
  const m = data.mahsulotlar.find(x => x.barcode === bc);
  if(m) {
    document.getElementById(`${qPref}-mahsulot`).value = m.nom;
    mahsulotTanlandi(type);
    toast("Topildi!", "success");
    document.getElementById(`${qPref}-barkod-search`).value = '';
  } else {
    toast("Bunday barkodli mahsulot yo'q!", "error");
  }
}

function kirimSummaHisob() {
  const miq = parseFloat(document.getElementById('k-miqdor').value) || 0;
  const narx = parseFloat(document.getElementById('k-narx').value) || 0;
  document.getElementById('k-jami-summa').innerText = (miq * narx).toLocaleString() + " so'm";
}

function kirimJadvalgaQosh() {
  const nom = document.getElementById('k-mahsulot').value;
  const miq = parseFloat(document.getElementById('k-miqdor').value);
  const narx = parseFloat(document.getElementById('k-narx').value) || 0;
  const bir = document.getElementById('k-birlik').value;
  const izh = document.getElementById('k-izoh').value;
  
  if(!nom || !miq || miq <= 0) { toast("Ma'lumotlarni to'g'ri kiriting!", "error"); return; }
  
  // Mahsulot bazada yo'q bo'lsa
  if(!data.mahsulotlar.find(m => m.nom === nom)) {
    toast("Mahsulot ro'yxatda yo'q. Oldin 'Yangi mahsulot' qo'shing!", "warn"); return;
  }
  
  pendingKirim.push({ nom, miqdor: miq, narx, jami: miq * narx, birlik: bir, izoh: izh });
  renderPending('kirim');
  kirimFormTozala();
}

function kirimFormTozala() {
  ['k-mahsulot','k-miqdor','k-narx','k-izoh'].forEach(id => setVal(id, ''));
  document.getElementById('k-jami-summa').innerText = "0 so'm";
  document.getElementById('k-zaxira-info').classList.remove('visible');
}

function chiqimJadvalgaQosh() {
  const nom = document.getElementById('c-mahsulot').value;
  const miq = parseFloat(document.getElementById('c-miqdor').value);
  const narx = parseFloat(document.getElementById('c-narx').value) || 0;
  const bir = document.getElementById('c-birlik').value;
  const izh = document.getElementById('c-izoh').value;
  
  if(!nom || !miq || miq <= 0) { toast("Ma'lumotni to'g'ri kiriting", "error"); return; }
  const qol = getJoriyZaxira(nom);
  if(miq > qol) { toast(`Zaxirada yetarli emas! Faqat ${qol} bor.`, "error"); return; }
  
  pendingChiqim.push({ nom, miqdor: miq, narx, jami: miq * narx, birlik: bir, izoh: izh });
  renderPending('chiqim');
  ['c-mahsulot','c-miqdor','c-narx','c-izoh'].forEach(id => setVal(id, ''));
  document.getElementById('c-jami-summa').innerText = "0 so'm";
  document.getElementById('c-zaxira-info').classList.remove('visible');
}

function renderPending(type) {
  const arr = type === 'kirim' ? pendingKirim : pendingChiqim;
  const tbody = document.getElementById(`pending-${type}-tbody`);
  if(!tbody) return;
  tbody.innerHTML = '';
  let total = 0;
  if(arr.length === 0) {
    const colCount = type === 'kirim' ? 6 : 6;
    tbody.innerHTML = `<tr><td colspan="${colCount}" class="empty">Jadval bo'sh</td></tr>`;
  } else {
    arr.forEach((item, idx) => {
      const tr = document.createElement('tr');
      if(type === 'kirim') {
        total += item.jami;
        tr.innerHTML = `
          <td>${idx+1}</td>
          <td><strong>${item.nom}</strong></td>
          <td>${item.narx.toLocaleString()}</td>
          <td style="font-family:var(--mono)">${item.miqdor} ${item.birlik}</td>
          <td style="font-family:var(--mono); font-weight:700">${item.jami.toLocaleString()}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="removePending('${type}', ${idx})">🗑️</button></td>
        `;
      } else {
        tr.innerHTML = `
          <td>${idx+1}</td>
          <td><strong>${item.nom}</strong></td>
          <td style="font-family:var(--mono)">${item.miqdor} ${item.birlik}</td>
          <td>${item.narx.toLocaleString()}</td>
          <td style="font-family:var(--mono); font-weight:700">${item.jami.toLocaleString()}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="removePending('${type}', ${idx})">🗑️</button></td>
        `;
      }
      tbody.appendChild(tr);
    });
  }

  if(type === 'kirim') {
    const totalBox = document.getElementById('kirim-total-box');
    const overallSpan = document.getElementById('k-overall-total');
    if(totalBox && overallSpan) {
      totalBox.style.display = arr.length > 0 ? 'block' : 'none';
      overallSpan.innerText = total.toLocaleString();
    }
  }
}

function removePending(type, idx) {
  if(type === 'kirim') pendingKirim.splice(idx, 1);
  else pendingChiqim.splice(idx, 1);
  renderPending(type);
}

function clearPendingKirim() { pendingKirim = []; renderPending('kirim'); }
function clearPendingChiqim() { pendingChiqim = []; renderPending('chiqim'); }

function commitKirimItems() {
  if(pendingKirim.length === 0) { toast("Jadval bo'sh", "warn"); return; }
  if(currentUserRole !== 'admin') { toast("Huquq yo'q", "error"); return; }
  
  const sana = document.getElementById('k-sana').value;
  const ism = document.getElementById('k-ism').value || 'Noma\'lum yetkazuvchi';
  const tel = document.getElementById('k-tel').value;
  const tulov = document.querySelector('input[name="k-tulov"]:checked').value;
  
  pendingKirim.forEach(item => {
    const prevQ = getJoriyZaxira(item.nom);
    const m = data.mahsulotlar.find(x => x.nom === item.nom);
    const newYozuv = {
      id: Date.now() + Math.random(), sana, vaqt: new Date().toISOString(), tur: 'kirim',
      ism, tel, mahsulot: item.nom, miqdor: item.miqdor, narx: item.narx, jami: item.jami,
      tulov, birlik: item.birlik, zaxira: prevQ, zaxira_unit: m?m.birlik:'', qoldiq: prevQ + item.miqdor, izoh: item.izoh
    };
    data.yozuvlar.push(newYozuv);
  });
  
  saveData(); clearPendingKirim(); setVal('k-ism', ''); setVal('k-tel', '');
  toast("✅ Kirim qabul qilindi!");
}

function commitChiqimItems() {
  if(pendingChiqim.length === 0) { toast("Jadval bo'sh", "warn"); return; }
  if(currentUserRole !== 'admin') { toast("Huquq yo'q", "error"); return; }
  
  const sana = document.getElementById('c-sana').value;
  const usta = document.getElementById('c-usta').value;
  const obyekt = document.getElementById('c-obyekt').value.trim();
  const klient = document.getElementById('c-klient').value;
  
  if(!usta) { toast("Ustani tanlang!", "error"); document.getElementById('c-usta').focus(); return; }
  if(!obyekt) { toast("Obyekt nomini kiriting!", "error"); document.getElementById('c-obyekt').focus(); return; }
  
  pendingChiqim.forEach(item => {
    const prevQ = getJoriyZaxira(item.nom);
    const m = data.mahsulotlar.find(x => x.nom === item.nom);
    const newYozuv = {
      id: Date.now() + Math.random(), sana, vaqt: new Date().toISOString(), tur: 'chiqim',
      ism: usta, obyekt, tel: klient, mahsulot: item.nom, miqdor: item.miqdor, narx: item.narx, jami: item.jami,
      birlik: item.birlik, zaxira: prevQ, zaxira_unit: m?m.birlik:'', qoldiq: prevQ - item.miqdor, izoh: item.izoh
    };
    data.yozuvlar.push(newYozuv);
  });
  
  saveData(); clearPendingChiqim(); setVal('c-klient', ''); setVal('c-obyekt', '');
  toast("✅ Chiqim saqlandi (Chek chop etildi)", "success");
}

// ================= QOLDIQ VA TARIX (VIEW) =================
function renderQoldiq() {
  const grid = document.getElementById('qoldiq-grid');
  if(!grid) return;
  const s = (document.getElementById('qoldiq-search')?.value || '').toLowerCase();
  
  grid.innerHTML = '';
  const filtered = data.mahsulotlar.filter(m => m.nom.toLowerCase().includes(s) || (m.barcode && m.barcode.includes(s)));
  
  if(filtered.length === 0) { grid.innerHTML = '<div class="empty">Mahsulot topilmadi</div>'; return; }
  
  filtered.forEach((m, i) => {
    const qol = getJoriyZaxira(m.nom);
    const min = parseFloat(m.min || 0);
    let stCls = 'success', stTxt = '✅ YETARLI';
    if (qol <= 0) { stCls = 'danger'; stTxt = '⛔ TUGAGAN'; }
    else if (qol <= min) { stCls = 'warn'; stTxt = '⚠️ KAM'; }
    
    // Qoldiqni to'g'rilash tugmasi faqat admin uchun
    const btnHtml = currentUserRole === 'admin' ? 
      `<button class="qc-edit-btn" onclick="openQoldiqEdit('${m.nom}')">✏️ To'g'rilash</button>` : '';

    grid.innerHTML += `
      <div class="qoldiq-card">
        <div class="qc-head">
          <div class="qc-name">${m.nom}</div>
          <div class="qc-badge ${stCls}">${stTxt}</div>
        </div>
        <div style="display:flex; align-items:baseline; gap:4px;">
          <div class="qc-amount">${qol}</div>
          <div class="qc-unit">${m.birlik}</div>
        </div>
        <div class="qc-bot">
          <div class="qc-code">🔣 ${m.barcode || '—'}</div>
          ${btnHtml}
        </div>
      </div>
    `;
  });
}

function renderTarix() {
  const tb = document.getElementById('tarix-tbody');
  if(!tb) return;
  tb.innerHTML = '';
  
  const mF = document.getElementById('filter-mahsulot').value;
  const tF = document.getElementById('filter-tur').value;
  const uF = document.getElementById('filter-usta').value;
  const qF = document.getElementById('search-input').value.toLowerCase();
  
  let list = [...data.yozuvlar].reverse().filter(y => {
    let match = true;
    if(mF && y.mahsulot !== mF) match = false;
    if(tF && y.tur !== tF) match = false;
    if(uF && y.ism !== uF) match = false;
    if(qF && !(y.ism?.toLowerCase().includes(qF) || y.mahsulot?.toLowerCase().includes(qF) || y.tel?.toLowerCase().includes(qF))) match = false;
    if(currentHistoryTab !== 'all' && y.tulov !== currentHistoryTab) match = false;
    return match;
  });
  
  if(list.length === 0) { tb.innerHTML = '<tr><td colspan="10" class="empty">Ma\'lumot topilmadi</td></tr>'; return; }
  
  list.forEach((y, i) => {
    const znak = y.tur === 'kirim' ? '+' : '-';
    const cls  = y.tur === 'kirim' ? 'color:var(--success)' : 'color:var(--danger)';
    
    // To'lov turi belgisi
    let payBadge = '';
    if (y.tur === 'kirim') {
      if (y.tulov === 'naqd') payBadge = ' <small style="color:var(--success)">[Naqd]</small>';
      else if (y.tulov === 'qarz') {
        const payBtn = currentUserRole === 'admin' ? `<button class="pay-btn" onclick="payDebt('${y.id}')">To'lash</button>` : '';
        payBadge = ` <small style="color:var(--danger)">[Qarz]</small> ${payBtn}`;
      }
    }

    // O'chirish va Tahrirlash tugmalari admin orqali
    let actionBtns = '';
    if (currentUserRole === 'admin') {
      actionBtns = `
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" onclick="openHistoryEdit('${y.id}')" title="Tahrirlash">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="ochirishYozuv('${y.id}')" title="O'chirish">🗑️</button>
        </div>
      `;
    }
    
    tb.innerHTML += `
      <tr>
        <td>${i+1}</td>
        <td>${y.sana}</td>
        <td><span style="border-radius:4px;padding:2px 6px;background:var(--bg);${cls}">${y.tur.toUpperCase()}</span></td>
        <td>${y.ism || '-'} ${y.tel ? `(<small>${y.tel}</small>)` : ''}${payBadge}</td>
        <td><strong>${y.mahsulot}</strong></td>
        <td>${y.zaxira||0}</td>
        <td style="font-family:var(--mono); font-weight:bold; ${cls}">${znak}${y.miqdor} ${y.birlik}</td>
        <td>${y.qoldiq||0}</td>
        <td><small>${y.izoh || ''}</small></td>
        <td>${actionBtns}</td>
      </tr>
    `;
  });
}

function setHistoryTab(tab) {
  currentHistoryTab = tab;
  document.querySelectorAll('.history-tabs .tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.innerText.toLowerCase().includes(tab === 'all' ? 'barcha' : tab)) btn.classList.add('active');
  });
  renderTarix();
}

function payDebt(id) {
  if (currentUserRole !== 'admin') { toast("Sizda huquq yo'q", "error"); return; }
  if (!confirm("Ushbu qarz to'langanini tasdiqlaysizmi?")) return;

  const idx = data.yozuvlar.findIndex(y => y.id.toString() === id.toString());
  if (idx !== -1) {
    const today = new Date().toISOString().split('T')[0];
    data.yozuvlar[idx].tulov = 'naqd';
    data.yozuvlar[idx].sana = today;
    data.yozuvlar[idx].izoh = (data.yozuvlar[idx].izoh || '') + " [TO'LANDI]";
    saveData();
    toast("✅ Qarz to'landi va Naqd bo'limiga o'tkazildi!");
  }
}

function ochirishYozuv(id) {
  if (currentUserRole !== 'admin') { toast("Sizda huquq yo'q", "error"); return; }
  if (!confirm("Ushbu yozuvni o'chirishni xohlaysizmi?")) return;
  
  data.yozuvlar = data.yozuvlar.filter(y => y.id.toString() !== id.toString());
  saveData();
  toast("🗑️ Yozuv o'chirildi");
}

// ================= TARIXNI TAHRIRLASH =================
function openHistoryEdit(id) {
  const y = data.yozuvlar.find(x => x.id.toString() === id.toString());
  if (!y) return;

  setVal('he-id', y.id);
  setVal('he-sana', y.sana);
  setVal('he-mahsulot', y.mahsulot);
  setVal('he-ism', y.ism || '');
  setVal('he-miqdor', y.miqdor);
  setVal('he-izoh', y.izoh || '');
  
  document.getElementById('he-old-miqdor').innerText = `${y.miqdor} ${y.birlik || ''}`;
  document.getElementById('he-miqdor').dataset.unitPrice = y.narx || 0;
  heSummaHisob();

  const obyektGroup = document.getElementById('he-obyekt-group');
  if (y.tur === 'chiqim') {
    obyektGroup.style.display = 'block';
    setVal('he-obyekt', y.obyekt || '');
  } else {
    obyektGroup.style.display = 'none';
  }

  document.getElementById('history-edit-modal').classList.add('active');
}

function heSummaHisob() {
  const miq = parseFloat(document.getElementById('he-miqdor').value) || 0;
  const narx = parseFloat(document.getElementById('he-miqdor').dataset.unitPrice) || 0;
  document.getElementById('he-jami').innerText = (miq * narx).toLocaleString() + " so'm";
}

function closeHistoryEdit() {
  document.getElementById('history-edit-modal').classList.remove('active');
}

function saveHistoryEdit() {
  const id = document.getElementById('he-id').value;
  const idx = data.yozuvlar.findIndex(x => x.id.toString() === id.toString());
  if (idx === -1) return;

  const y = data.yozuvlar[idx];
  const newMiqdor = parseFloat(document.getElementById('he-miqdor').value) || 0;
  const newIzoh = document.getElementById('he-izoh').value.trim();

  if (!newIzoh) { toast("Izoh kiritish majburiy!", "error"); return; }

  y.sana = document.getElementById('he-sana').value;
  y.ism = document.getElementById('he-ism').value.trim();
  y.miqdor = newMiqdor;
  y.jami = newMiqdor * (y.narx || 0);
  y.izoh = newIzoh;
  
  if (y.tur === 'chiqim') {
    y.obyekt = document.getElementById('he-obyekt').value.trim();
  }

  // Qoldiqni qayta hisoblash kerak bo'lishi mumkin, lekin getJoriyZaxira har doim yozuvlardan hisoblaydi.
  // Faqatgina har bir yozuvdagi 'qoldiq' (snapshot) maydoni noto'g'ri bo'lib qoladi.
  // Uni to'g'irlash uchun barcha yozuvlarni qayta hisoblash kerak.
  recalculateSnapshots(y.mahsulot);

  saveData();
  
  // Detail panellar ochiq bo'lsa, ularni ham yangilash
  if (document.getElementById('panel-usta-detail').style.display === 'block') {
    const ustaName = document.getElementById('usta-detail-title').innerText.replace('👷 ', '').split(' (')[0];
    showUstaDetail(ustaName);
  }
  if (document.getElementById('panel-obyekt-detail').style.display === 'block') {
    const obyektName = document.getElementById('obyekt-detail-title').innerText.replace('🏗️ ', '').split(' (')[0];
    showObyektDetail(obyektName);
  }

  closeHistoryEdit();
  toast("✅ Operatsiya tahrirlandi!");
}

function recalculateSnapshots(mahsulotNomi) {
  const m = data.mahsulotlar.find(x => x.nom === mahsulotNomi);
  if (!m) return;
  
  let q = parseFloat(m.boshlangich || 0);
  // Yozuvlarni vaqt bo'yicha tartiblash (agar tartibi buzilgan bo'lsa)
  // Ammo hozircha qo'shilgan tartibda hisoblaymiz
  data.yozuvlar.filter(y => y.mahsulot === mahsulotNomi).forEach(y => {
    y.zaxira = q;
    const miq = parseFloat(y.miqdor) || 0;
    if (y.tur === 'kirim') {
      if(y.izoh && y.izoh.includes('[KORREKSIYA]')) {
        q = miq;
      } else {
        q += miq;
      }
    } else {
      q -= miq;
    }
    y.qoldiq = q;
  });
}
window.qidirish = renderTarix; // HTMLdagi onChange eventi uchun

// ================= QOLDIQNI TAHRIRLASH (KORREKSIYA) =================
function openQoldiqEdit(nomi) {
  const m = data.mahsulotlar.find(x => x.nom === nomi);
  if(!m) return;
  const q = getJoriyZaxira(nomi);
  
  document.getElementById('edit-modal-title').innerHTML = `✏️ ${nomi} - Qoldiqni to'g'rilash`;
  setVal('edit-nom', m.nom);
  setVal('edit-birlik', m.birlik);
  setVal('edit-min', m.min || 0);
  setVal('edit-barcode', m.barcode || '');
  setVal('edit-yangi-qoldiq', q);
  setVal('edit-joriy-qoldiq', q);
  setVal('edit-izoh', '');
  
  document.getElementById('edit-nom').dataset.oldName = m.nom;
  document.getElementById('edit-joriy-display').innerText = `${q} ${m.birlik}`;
  document.getElementById('edit-farq-row').style.display = 'none';
  
  document.getElementById('qoldiq-edit-modal').classList.add('active');
}

function editQoldiqFarqHisob() {
  const ev = parseFloat(document.getElementById('edit-yangi-qoldiq').value);
  const jv = parseFloat(document.getElementById('edit-joriy-qoldiq').value);
  const fr = document.getElementById('edit-farq-row');
  const ft = document.getElementById('edit-farq-text');
  
  if(!isNaN(ev)) {
    const diff = ev - jv;
    fr.style.display = 'block';
    if(diff > 0) {
      fr.style.background = 'rgba(16,185,129,0.1)'; fr.style.color = 'var(--success)';
      ft.innerText = `+${diff.toFixed(2)} ta qo'shilmoqda (Kirim)`;
    } else if (diff < 0) {
      fr.style.background = 'rgba(239,68,68,0.1)'; fr.style.color = 'var(--danger)';
      ft.innerText = `${diff.toFixed(2)} ta olinmoqda (Chiqim)`;
    } else {
       fr.style.display = 'none';
    }
  }
}

function saveQoldiqEdit() {
  const oldName = document.getElementById('edit-nom').dataset.oldName;
  const newName = document.getElementById('edit-nom').value.trim();
  const yangiBirlik = document.getElementById('edit-birlik').value;
  const yangiMin = parseFloat(document.getElementById('edit-min').value) || 0;
  const yangiBarcode = document.getElementById('edit-barcode').value.trim();
  const yangiQoldiq = parseFloat(document.getElementById('edit-yangi-qoldiq').value);
  const izoh = document.getElementById('edit-izoh').value.trim() || '[KORREKSIYA]';
  const joriy = parseFloat(document.getElementById('edit-joriy-qoldiq').value);
  
  if(newName === '') { toast("Nomini kiriting", "error"); return; }

  // Barkod tekshiruvi (agar o'zgargan bo'lsa)
  if (yangiBarcode && data.mahsulotlar.find(x => x.barcode === yangiBarcode && x.nom !== oldName)) {
    toast("Bu barkod allaqachon boshqa mahsulotda ishlatilgan!", "error"); return;
  }
  
  // Mahsulot ma'lumotlarini yangilash
  let m = data.mahsulotlar.find(x => x.nom === oldName);
  if(m) {
    m.nom = newName;
    m.birlik = yangiBirlik;
    m.min = yangiMin;
    m.barcode = yangiBarcode;
  }
  
  // Yozuvlardagi ismlarni ham o'zgartirish kerak, agar nom o'zgarsa
  if(oldName !== newName) {
    data.yozuvlar.forEach(y => { if(y.mahsulot === oldName) y.mahsulot = newName; });
  }

  // Agar qoldiq o'zgargan bo'lsa, avtomatik kirim yoki chiqim yozuvi qo'shish
  if(!isNaN(yangiQoldiq) && yangiQoldiq !== joriy) {
     const diff = yangiQoldiq - joriy;
     data.yozuvlar.push({
       id: Date.now() + '', sana: new Date().toISOString().split('T')[0], vaqt: new Date().toISOString(),
       tur: diff > 0 ? 'kirim' : 'chiqim', ism: 'ADMIN (Korreksiya)', tel: '',
       mahsulot: newName, miqdor: Math.abs(diff), birlik: yangiBirlik,
       zaxira: joriy, zaxira_unit: yangiBirlik, qoldiq: yangiQoldiq, izoh: izoh + ' [KORREKSIYA]'
     });
  }
  
  saveData();
  closeQoldiqEdit();
  toast("O'zgarishlar saqlandi");
  renderQoldiq();
  updateDatalists();
}

function closeQoldiqEdit() { document.getElementById('qoldiq-edit-modal').classList.remove('active'); }

function deleteMahsulotButunlay() {
  if (currentUserRole !== 'admin') { toast("Sizda huquq yo'q", "error"); return; }
  
  const oldName = document.getElementById('edit-nom').dataset.oldName;
  if(!confirm(`"${oldName}" mahsulotini BUTUNLAY o'chirmoqchimisiz?\nBu mahsulot barcha ro'yxatlardan o'chib ketadi!`)) return;
  
  data.mahsulotlar = data.mahsulotlar.filter(m => m.nom !== oldName);
  
  saveData();
  closeQoldiqEdit();
  toast("🗑️ Mahsulot butunlay o'chirildi");
  renderQoldiq();
  updateDatalists();
}

// ================= USTALAR =================
function renderUstalar() {
  const container = document.getElementById('ustalar-list');
  if(!container) return;
  container.innerHTML = '';
  
  if(data.ustalar.length === 0) { container.innerHTML = '<div class="empty">Ustalar ro\'yxati bo\'sh</div>'; return; }
  
  data.ustalar.forEach(u => {
     let cout = data.yozuvlar.filter(y => y.tur === 'chiqim' && y.ism === u).length;
     container.innerHTML += `
       <div class="usta-card" onclick="showUstaDetail('${u}')">
         <div class="usta-name">👷 ${u}</div>
         <div style="display:flex; gap:12px; align-items:center;">
           <div class="usta-stats">${cout} operatsiya</div>
           ${currentUserRole==='admin' ? `<button class="usta-del-btn" onclick="event.stopPropagation(); deleteUsta('${u}')">✕</button>` : ''}
         </div>
       </div>
     `;
  });
}

function addUsta() {
  const nElement = document.getElementById('new-usta-name');
  if(!nElement) return;
  const n = nElement.value.trim();
  if(!n) return toast("Usta ismini kiriting!", "warn");
  if(data.ustalar.includes(n)) return toast("Bunday usta allaqachon mavjud!", "error");
  
  data.ustalar.push(n);
  saveData();
  toast("Usta qo'shildi!");
  nElement.value = '';
}

function deleteUsta(nomi) {
  if(!confirm(`"${nomi}"ni o'chirasizmi? Uning tarixdagi ishlari o'chmaydi.`)) return;
  data.ustalar = data.ustalar.filter(u => u !== nomi);
  saveData();
}

function showUstaDetail(nomi) {
  document.getElementById('panel-usta').classList.remove('active');
  document.getElementById('panel-usta-detail').style.display = 'block';
  document.getElementById('usta-detail-title').innerHTML = `👷 ${nomi} (Tarix)`;
  
  const div = document.getElementById('usta-detail-groups');
  div.innerHTML = '';
  const hs = [...data.yozuvlar].reverse().filter(y => y.ism === nomi);
  
  if(hs.length === 0) { div.innerHTML = '<div class="empty" style="border:1px solid var(--border)">Yozuvlar yo\'q</div>'; return; }
  
  const ul = '<div class="activity-list">' + hs.map(y => {
     let cls = y.tur==='kirim' ? 'kirim' : 'chiqim';
     let zn  = y.tur==='kirim' ? '+' : '-';
     let editBtn = currentUserRole === 'admin' ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openHistoryEdit('${y.id}')" title="Tahrirlash">✏️</button>` : '';
     return `
      <div class="act-item ${cls}">
        <div class="ai-info">
          <div class="ai-title">${y.mahsulot}</div>
          <div class="ai-sub">${y.sana} • Klient: ${y.tel||'-'}</div>
        </div>
        <div style="display:flex; align-items:center; gap:10px;">
          <div class="ai-val">${zn}${y.miqdor} ${y.birlik}</div>
          ${editBtn}
        </div>
      </div>
     `;
  }).join('') + '</div>';
  div.innerHTML = ul;
}

function backToUstalar() {
  document.getElementById('panel-usta-detail').style.display = 'none';
  document.getElementById('panel-usta').classList.add('active');
  renderUstalar();
}

// ================= OBYEKTLAR =================
function renderObyektlar() {
  const container = document.getElementById('obyekt-grid');
  if(!container) return;
  container.innerHTML = '';
  
  const obs = {};
  data.yozuvlar.forEach(y => {
    if(y.tur === 'chiqim' && y.obyekt) {
      if(!obs[y.obyekt]) obs[y.obyekt] = { nomi: y.obyekt, lastSana: y.sana, count: 0, items: [] };
      obs[y.obyekt].count++;
      obs[y.obyekt].items.push(y);
    }
  });
  
  const obyektNames = Object.keys(obs);
  if(obyektNames.length === 0) { container.innerHTML = '<div class="empty">Obyektlar ro\'yxati bo\'sh</div>'; return; }
  
  obyektNames.forEach(name => {
    const o = obs[name];
    const totalSum = o.items.reduce((sum, item) => sum + (item.jami || 0), 0);
    container.innerHTML += `
      <div class="obyekt-card" onclick="showUstaDetail('${name}')" style="display:none"></div>
      <div class="obyekt-card" onclick="showObyektDetail('${name}')">
        <div class="obyekt-title">🏗️ ${name}</div>
        <div class="obyekt-info">
          <span>Oxirgi harakat: ${o.lastSana}</span>
          <span>Operatsiyalar soni: ${o.count}</span>
        </div>
        <div class="obyekt-total">${totalSum.toLocaleString()} so'm</div>
      </div>
    `;
  });
}

function showObyektDetail(nomi) {
  document.getElementById('panel-obyekt').classList.remove('active');
  document.getElementById('panel-obyekt-detail').style.display = 'block';
  document.getElementById('obyekt-detail-title').innerHTML = `🏗️ ${nomi} (Chiqimlar)`;
  
  const div = document.getElementById('obyekt-detail-content');
  div.innerHTML = '';
  const hs = [...data.yozuvlar].reverse().filter(y => y.tur === 'chiqim' && y.obyekt === nomi);
  
  if(hs.length === 0) { div.innerHTML = '<div class="empty" style="border:1px solid var(--border)">Yozuvlar yo\'q</div>'; return; }
  
  div.innerHTML = '<div class="activity-list">' + hs.map(y => {
    let editBtn = currentUserRole === 'admin' ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openHistoryEdit('${y.id}')" title="Tahrirlash">✏️</button>` : '';
    return `
    <div class="act-item chiqim">
      <div class="ai-info">
        <div class="ai-title">${y.mahsulot}</div>
        <div class="ai-sub">${y.sana} • Usta: ${y.ism} • Klient: ${y.tel||'-'}</div>
      </div>
      <div style="display:flex; align-items:center; gap:12px">
        <div style="text-align:right">
          <div class="ai-val">-${y.miqdor} ${y.birlik}</div>
          <div style="font-size:0.75rem; color:var(--text-muted)">${(y.jami||0).toLocaleString()} so'm</div>
        </div>
        ${editBtn}
      </div>
    </div>
  `; }).join('') + '</div>';
  
  const total = hs.reduce((s, y) => s + (y.jami || 0), 0);
  div.innerHTML += `
    <div style="margin-top:20px; padding:15px; background:var(--bg); border-radius:12px; border:1px solid var(--border); text-align:right;">
      <div style="font-size:0.9rem; color:var(--text-muted)">Jami summa:</div>
      <div style="font-size:1.5rem; font-weight:700; color:var(--success); font-family:var(--mono)">${total.toLocaleString()} so'm</div>
    </div>
  `;
}

function backToObyektlar() {
  document.getElementById('panel-obyekt-detail').style.display = 'none';
  document.getElementById('panel-obyekt').classList.add('active');
  renderObyektlar();
}

// ================= SKANER / YORDAMCHI =================
function openScanner(tgt) {
  currentScannerTarget = tgt;
  document.getElementById('scanner-modal').classList.add('active');
  document.getElementById('scanner-status').innerText = "Kamerani shtrix kodga qarating...";
  
  if(!html5QrcodeScanner) {
    // html5-qrcode library assumes #qr-reader div exists. Wait, if it fails gracefully:
    try {
      html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: {width: 250, height: 150} }, /* verbose= */ false);
      html5QrcodeScanner.render((decodedText) => {
        // success
        closeScanner();
        const qp = currentScannerTarget === 'kirim' ? 'k' : 'c';
        document.getElementById(`${qp}-barkod-search`).value = decodedText;
        barkodQidir(currentScannerTarget);
      }, (err) => { /* ign */ });
    } catch(e){
      document.getElementById('scanner-status').innerText = "Kamerada xatolik yuz berdi.";
    }
  }
}

function closeScanner() {
  document.getElementById('scanner-modal').classList.remove('active');
  if(html5QrcodeScanner) {
    html5QrcodeScanner.clear().catch(e => console.error("Scanner clear fail", e));
    html5QrcodeScanner = null;
  }
}

function generateBarcode() {
  return Math.floor(100000000000 + Math.random() * 900000000000).toString();
}

function openNewMahsulotModal() {
  document.getElementById('new-mahsulot-modal').classList.add('active');
  document.getElementById('nm-nom').focus();
}

function closeNewMahsulotModal() {
  document.getElementById('new-mahsulot-modal').classList.remove('active');
  ['nm-nom','nm-barcode','nm-boshlangich','nm-min'].forEach(id => setVal(id, ''));
}

function saveMahsulotPanel() {
  if (currentUserRole !== 'admin') { toast("Sizda huquq yo'q", "error"); return; }
  const nom = document.getElementById('m-nom').value.trim();
  const bc = document.getElementById('m-barcode').value.trim() || generateBarcode();
  const bir = document.getElementById('m-birlik').value;
  const bosh = parseFloat(document.getElementById('m-boshlangich').value) || 0;
  const min = parseFloat(document.getElementById('m-min').value) || 0;

  if(!nom) { toast("Nomi kiritilmadi!", "error"); return; }
  if(data.mahsulotlar.find(m => m.nom.toLowerCase() === nom.toLowerCase())) {
    toast("Mahsulot allaqachon mavjud!", "error"); return;
  }
  
  if (bc && data.mahsulotlar.find(m => m.barcode === bc)) {
    toast("Bu barkod allaqachon ishlatilgan!", "error"); return;
  }
  
  data.mahsulotlar.push({ id: Date.now()+'', nom, barcode: bc, birlik: bir, boshlangich: bosh, min, sana: new Date().toISOString() });
  saveData(); 
  toast("✅ Mahsulot saqlandi!");
  ['m-nom','m-barcode','m-boshlangich','m-min'].forEach(id => setVal(id, '')); setVal('m-boshlangich', '0');
  updateDatalists();
}

function saveNewMahsulot() {
  const nom = document.getElementById('nm-nom').value.trim();
  const bc = document.getElementById('nm-barcode').value.trim() || generateBarcode();
  const bir = document.getElementById('nm-birlik').value;
  const bosh = parseFloat(document.getElementById('nm-boshlangich').value) || 0;
  const min = parseFloat(document.getElementById('nm-min').value) || 0;

  if(!nom) { toast("Nomi kiritilmadi!", "error"); return; }
  if(data.mahsulotlar.find(m => m.nom.toLowerCase() === nom.toLowerCase())) {
    toast("Mahsulot allaqachon mavjud!", "error"); return;
  }

  if (bc && data.mahsulotlar.find(m => m.barcode === bc)) {
    toast("Bu barkod allaqachon ishlatilgan!", "error"); return;
  }
  
  data.mahsulotlar.push({ id: Date.now()+'', nom, barcode: bc, birlik: bir, boshlangich: bosh, min, sana: new Date().toISOString() });
  saveData(); 
  toast("✅ Yangi mahsulot saqlandi!");
  closeNewMahsulotModal();
  updateDatalists();
}

// Yangi mahsulot Popover (inline kirim uchun)
function toggleNewMahsulotPopover() {
  const el = document.getElementById('new-mahsulot-popover');
  el.classList.toggle('active');
  if(el.classList.contains('active')) document.getElementById('pnm-nomi').focus();
}

function saveNewMahsulotInline() {
  const nom = document.getElementById('pnm-nomi').value.trim();
  const bc = document.getElementById('pnm-barkod').value.trim() || generateBarcode();
  const bir = document.getElementById('pnm-birlik').value;
  const bosh = parseFloat(document.getElementById('pnm-boshlangich').value) || 0;
  const min = parseFloat(document.getElementById('pnm-minimal').value) || 0;
  
  if(!nom) { toast("Nomi kiritilmadi!", "error"); return; }
  if(data.mahsulotlar.find(m => m.nom.toLowerCase() === nom.toLowerCase())) {
    toast("Mahsulot allaqachon mavjud!", "error"); return;
  }

  if (bc && data.mahsulotlar.find(m => m.barcode === bc)) {
    toast("Bu barkod allaqachon ishlatilgan!", "error"); return;
  }
  
  data.mahsulotlar.push({ id: Date.now()+'', nom, barcode: bc, birlik: bir, boshlangich: bosh, min, sana: new Date().toISOString() });
  saveData(); toast("Mahsulot ro'yxatga qo'shildi!");
  
  document.getElementById('k-mahsulot').value = nom;
  toggleNewMahsulotPopover();
  mahsulotTanlandi('kirim');
  
  // clear popover
  document.getElementById('pnm-nomi').value = '';
  document.getElementById('pnm-barkod').value = '';
  document.getElementById('pnm-boshlangich').value = '0';
  document.getElementById('pnm-minimal').value = '0';
}

function toggleTheme() {
  const bd = document.body;
  if(bd.getAttribute('data-theme') === 'dark') {
    bd.removeAttribute('data-theme');
    localStorage.setItem('sannurTheme', 'light');
    document.getElementById('theme-btn').innerText = "🌙 Qora";
  } else {
    bd.setAttribute('data-theme', 'dark');
    localStorage.setItem('sannurTheme', 'dark');
    document.getElementById('theme-btn').innerText = "☀️ Oq";
  }
}

if(localStorage.getItem('sannurTheme') === 'dark') {
  document.body.setAttribute('data-theme', 'dark');
  const tb = document.getElementById('theme-btn');
  if(tb) tb.innerText = "☀️ Oq";
}

// Boshqa yordamchi modallar (o'chirish)
let targetDeleteId = null;
function ochirishYozuv(id) {
  targetDeleteId = id;
  document.getElementById('delete-modal').classList.add('active');
}
function confirmDelete() {
  data.yozuvlar = data.yozuvlar.filter(y => y.id !== targetDeleteId);
  saveData();
  document.getElementById('delete-modal').classList.remove('active');
  renderTarix();
  toast("Yozuv o'chirildi");
}
function closeDeleteModal() {
  targetDeleteId = null;
  document.getElementById('delete-modal').classList.remove('active');
}

function closeQoldiqEdit() {
  document.getElementById('qoldiq-edit-modal').classList.remove('active');
}

function excelExport() {
  if (typeof XLSX === 'undefined') { toast("Kutubxona yuklanmagan!", "error"); return; }
  const rows = [['#', 'Sana', 'Tur', 'Kim', 'Mahsulot', 'Oldingi', 'Miqdor', 'Yangi qoldiq', 'Izoh']];
  const tbody = document.getElementById('tarix-tbody');
  if(!tbody) return;
  const trs = tbody.querySelectorAll('tr');
  trs.forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if(tds.length > 1) {
      rows.push(Array.from(tds).slice(0, 9).map(td => td.innerText));
    }
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tarix");
  XLSX.writeFile(wb, `sannur_tarix_${today()}.xlsx`);
}

function setVal(id, v) { const el = document.getElementById(id); if(el) el.value = v; }
function setElVal(id, v) { const el = document.getElementById(id); if(el) el.innerText = v; }

function toast(msg, type='success') {
  const el = document.getElementById('toast');
  if(!el) return;
  el.innerText = msg;
  if(type==='error') el.style.background = 'var(--danger)';
  else if(type==='warn') el.style.background = 'var(--warn)';
  else el.style.background = 'var(--success)';
  el.style.color = '#fff';
  el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); }, 3000);
}

// Excel export xavfsiz nomi
function today() {
  return new Date().toISOString().split('T')[0];
}

// ================= JSON EXPORT / IMPORT =================
function exportJSON() {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sannur_backup_${today()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast("✅ JSON zaxira fayli yuklab olindi");
}

function importJSON(event) {
  if (currentUserRole !== 'admin') { toast("Sizda huquq yo'q", "error"); return; }
  
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      if (confirm("DIQQAT! Barcha joriy ma'lumotlar ushbu fayldagi ma'lumotlar bilan almashtiriladi. Davom etasizmi?")) {
        data = importedData;
        if (!data.mahsulotlar) data.mahsulotlar = [];
        if (!data.yozuvlar) data.yozuvlar = [];
        if (!data.ustalar) data.ustalar = [];
        
        saveData(); // Firebase'ga yozish
        toast("✅ Ma'lumotlar muvaffaqiyatli tiklandi!", "success");
      }
    } catch (err) {
      console.error(err);
      toast("❌ Faylni o'qishda xatolik! JSON formatini tekshiring.", "error");
    }
  };
  reader.readAsText(file);
  event.target.value = ''; // Reset input
}

// ================= HISOBOT (KIM OLIB KELGAN) =================
function renderHisobot() {
  const container = document.getElementById('hisobot-cards-list');
  if (!container) return;

  const searchVal = (document.getElementById('hisobot-search')?.value || '').toLowerCase();
  const monthVal = document.getElementById('hisobot-month')?.value || '';

  // Barcha kirim yozuvlarini guruhlaymiz:
  // Har bir guruh = bir xil sana + yetkazib beruvchi (ism) + vakil (tel) kombinatsiyasi
  const groups = {};
  data.yozuvlar
    .filter(y => y.tur === 'kirim')
    .forEach(y => {
      const key = `${y.sana}__${y.ism || ''}__${y.tel || ''}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          sana: y.sana,
          ism: y.ism || "Noma'lum",
          tel: y.tel || '',
          items: []
        };
      }
      groups[key].items.push(y);
    });

  // Guruhlarni sanaga ko'ra teskari tartibda
  let groupList = Object.values(groups).sort((a, b) => {
    if (b.sana > a.sana) return 1;
    if (b.sana < a.sana) return -1;
    return 0;
  });

  // Filtr: qidiruv
  if (searchVal) {
    groupList = groupList.filter(g =>
      g.ism.toLowerCase().includes(searchVal) ||
      g.tel.toLowerCase().includes(searchVal)
    );
  }

  // Filtr: oy
  if (monthVal) {
    groupList = groupList.filter(g => g.sana && g.sana.startsWith(monthVal));
  }

  container.innerHTML = '';

  if (groupList.length === 0) {
    container.innerHTML = '<div class="empty">Kirim yozuvlari topilmadi</div>';
    return;
  }

  groupList.forEach(g => {
    const totalSum = g.items.reduce((s, y) => s + (y.jami || 0), 0);
    const totalMahsulot = g.items.length;
    const groupKey = encodeURIComponent(g.key);

    const card = document.createElement('div');
    card.className = 'hisobot-card';
    card.innerHTML = `
      <div class="hc-head" onclick="showHisobotDetail('${groupKey}')" style="cursor:pointer">
        <div class="hc-info">
          <div class="hc-name">&#128230; ${g.ism}</div>
          ${g.tel ? `<div class="hc-sub">&#128100; Vakil (Kim olib kelgan): <strong>${g.tel}</strong></div>` : ''}
          <div class="hc-sub">&#128197; Sana: <strong>${g.sana}</strong></div>
        </div>
        <div class="hc-right">
          <div class="hc-count">${totalMahsulot} ta mahsulot</div>
          <div class="hc-sum">${totalSum.toLocaleString()} so'm</div>
          <div class="hc-arrow">&#8250;</div>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

// Guruh tafsilotini modal oynada ko'rsatish
function showHisobotDetail(encodedKey) {
  const key = decodeURIComponent(encodedKey);
  const parts = key.split('__');
  const sana = parts[0] || '';
  const ism = parts[1] || "Noma'lum";
  const tel = parts[2] || '';

  const items = data.yozuvlar.filter(
    y => y.tur === 'kirim' &&
         y.sana === sana &&
         (y.ism || '') === ism &&
         (y.tel || '') === tel
  );

  document.getElementById('hisobot-detail-title').innerHTML =
    `&#128230; ${ism} &mdash; Kirim tafsiloti`;

  document.getElementById('hisobot-detail-meta').innerHTML = `
    <div style="display:flex; flex-wrap:wrap; gap:16px; font-size:0.9rem;">
      <span>&#128197; <strong>Sana:</strong> ${sana}</span>
      ${tel ? `<span>&#128100; <strong>Vakil (Kim olib kelgan):</strong> ${tel}</span>` : ''}
      <span>&#128203; <strong>Mahsulotlar soni:</strong> ${items.length} ta</span>
    </div>
  `;

  const tbody = document.getElementById('hisobot-detail-tbody');
  tbody.innerHTML = '';
  let total = 0;

  items.forEach((y, i) => {
    total += y.jami || 0;
    const tulovBadge = y.tulov === 'qarz'
      ? '<span style="color:var(--danger)">&#128179; Qarz</span>'
      : '<span style="color:var(--success)">&#128181; Naqd</span>';
    tbody.innerHTML += `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${y.mahsulot}</strong></td>
        <td style="font-family:var(--mono)">${y.miqdor} ${y.birlik}</td>
        <td>${(y.narx || 0).toLocaleString()}</td>
        <td style="font-family:var(--mono); font-weight:700">${(y.jami || 0).toLocaleString()} so'm</td>
        <td>${tulovBadge}</td>
      </tr>
    `;
  });

  document.getElementById('hisobot-detail-total').innerHTML =
    `Jami: <span style="color:var(--success)">${total.toLocaleString()} so'm</span>`;

  document.getElementById('hisobot-detail-modal').classList.add('active');
}

function closeHisobotDetail() {
  document.getElementById('hisobot-detail-modal').classList.remove('active');
}

// ================= HISOBOT EXCEL EKSPORT =================
function exportHisobotExcel() {
  if (typeof XLSX === 'undefined') {
    toast('Excel kutubxonasi yuklanmadi!', 'error');
    return;
  }

  const monthVal = document.getElementById('hisobot-month')?.value || '';
  const searchVal = (document.getElementById('hisobot-search')?.value || '').toLowerCase();

  // Guruhlarni hosil qilish (renderHisobot() bilan bir xil mantiq)
  const groups = {};
  data.yozuvlar
    .filter(y => y.tur === 'kirim')
    .forEach(y => {
      const key = `${y.sana}__${y.ism || ''}__${y.tel || ''}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          sana: y.sana,
          ism: y.ism || "Noma'lum",
          tel: y.tel || '',
          items: []
        };
      }
      groups[key].items.push(y);
    });

  let groupList = Object.values(groups).sort((a, b) => {
    if (b.sana > a.sana) return 1;
    if (b.sana < a.sana) return -1;
    return 0;
  });

  // Filtrlar
  if (monthVal) {
    groupList = groupList.filter(g => g.sana && g.sana.startsWith(monthVal));
  }
  if (searchVal) {
    groupList = groupList.filter(g =>
      g.ism.toLowerCase().includes(searchVal) ||
      g.tel.toLowerCase().includes(searchVal)
    );
  }

  if (groupList.length === 0) {
    toast('Eksport qilish uchun ma\'lumot topilmadi!', 'warn');
    return;
  }

  // Excel varaq mazmuni — har bir karta blok sifatida
  const rows = [];

  // Sarlavha
  const oyNomi = monthVal
    ? (() => {
        const d = new Date(monthVal + '-01');
        return d.toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long' });
      })()
    : 'Barcha vaqt';

  rows.push([`SANNUR OMS — Kirim Hisoboti: ${oyNomi}`]);
  rows.push([`Eksport sanasi: ${new Date().toLocaleDateString('uz-UZ')}`]);
  rows.push([]); // Bo'sh qator

  let grandTotal = 0;
  let groupNum = 0;

  groupList.forEach(g => {
    groupNum++;
    const groupTotal = g.items.reduce((s, y) => s + (y.jami || 0), 0);
    grandTotal += groupTotal;

    // Karta sarlavhasi
    rows.push([
      `${groupNum}. Yetkazib beruvchi: ${g.ism}`,
      '',
      g.tel ? `Vakil (Kim olib kelgan): ${g.tel}` : '',
      '',
      `Sana: ${g.sana}`
    ]);

    // Jadval ustun nomlari
    rows.push([
      '№',
      'Mahsulot nomi',
      'Miqdori',
      'Birlik',
      'Tannarxi (so\'m)',
      'Jami (so\'m)',
      'To\'lov turi'
    ]);

    // Mahsulotlar
    g.items.forEach((y, i) => {
      rows.push([
        i + 1,
        y.mahsulot || '',
        y.miqdor || 0,
        y.birlik || '',
        y.narx || 0,
        y.jami || 0,
        y.tulov === 'qarz' ? 'Qarz' : 'Naqd'
      ]);
    });

    // Karta jami
    rows.push(['', '', '', '', '', groupTotal, '← Jami']);
    rows.push([]); // Bo'sh ajratuvchi qator
  });

  // Umumiy jami
  rows.push(['', '', '', '', 'UMUMIY JAMI:', grandTotal, `so'm`]);

  // XLSX varaq yaratish
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Ustun kengliklarini sozlash
  ws['!cols'] = [
    { wch: 6 },   // №
    { wch: 28 },  // Mahsulot
    { wch: 10 },  // Miqdor
    { wch: 8 },   // Birlik
    { wch: 16 },  // Tannarxi
    { wch: 16 },  // Jami
    { wch: 12 }   // To'lov
  ];

  const wb = XLSX.utils.book_new();
  const sheetName = monthVal ? monthVal.replace('-', '_') : 'hisobot';
  XLSX.utils.book_append_sheet(wb, ws, `Kirim_${sheetName}`);

  const fileName = monthVal
    ? `SANNUR_kirim_hisobot_${monthVal}.xlsx`
    : `SANNUR_kirim_hisobot_${today()}.xlsx`;

  XLSX.writeFile(wb, fileName);
  toast(`✅ ${groupList.length} ta karta Excel'ga saqlandi!`);
}
