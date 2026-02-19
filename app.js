/**
 * app.js — LIFF App (Multi-Book: NOVAT/VAT + รายปี)
 */
const LIFF_ID = '2009159364-PTzZ6D0B';
const GAS_URL = 'https://script.google.com/macros/s/AKfycby8qQzYDIcIfq9wWtX6Dgp7lKOc7hSze5AVSJYVABKaXtY8V8mB8J9w0oISjMkqhgSrFQ/exec';

let currentUser = null, allBills = [], currentBillId = null, currentBillData = null;
let isAdmin = false, currentFilter = 'all', currentBook = '', availableBooks = [];

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) { liff.login(); return; }
        const p = await liff.getProfile();
        currentUser = { userId: p.userId, name: p.displayName };
        document.getElementById('user-name').textContent = p.displayName;
        // แสดง User ID แบบ dismissible สำหรับ Admin copy
        showUserIdBanner(p.userId, p.displayName);
    } catch (e) {
        currentUser = { userId: 'SALE_USER_ID_1', name: 'ทดสอบ' };
        document.getElementById('user-name').textContent = 'โหมดทดสอบ';
    }
    await loadBooks();
    hideLoading();
}

function showUserIdBanner(uid, name) {
    const banner = document.createElement('div');
    banner.id = 'uid-banner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#1a1a2e;color:#fff;padding:12px 16px;font-size:12px;z-index:9999;display:flex;align-items:center;justify-content:space-between;gap:8px;border-bottom:2px solid #00B900;';
    banner.innerHTML = `
      <div style="flex:1;overflow:hidden">
        <div style="font-weight:bold;color:#00B900;margin-bottom:2px">👤 ${name}</div>
        <div style="font-family:monospace;font-size:11px;word-break:break-all;opacity:0.8">${uid}</div>
      </div>
      <button onclick="navigator.clipboard.writeText('${uid}').then(()=>showToast('คัดลอก User ID แล้ว!','success')).catch(()=>{prompt('กด Copy แล้ว OK:','${uid}')})"
        style="background:#00B900;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer;white-space:nowrap">
        📋 Copy ID
      </button>
      <button onclick="document.getElementById('uid-banner').remove()"
        style="background:transparent;color:#aaa;border:none;font-size:18px;cursor:pointer;line-height:1">×</button>
    `;
    document.body.appendChild(banner);
}



function hideLoading() {
    const el = document.getElementById('loading-screen');
    el.classList.add('fade-out');
    setTimeout(() => el.style.display = 'none', 300);
}

// ===== API =====
async function apiGet(action, params = {}) {
    const url = new URL(GAS_URL);
    url.searchParams.set('action', action);
    url.searchParams.set('userId', currentUser.userId);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    return (await fetch(url)).json();
}
async function apiPost(data) {
    return (await fetch(GAS_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId: currentUser.userId, book: currentBook })
    })).json();
}

// ===== Books (NOVAT / VAT selector) =====
async function loadBooks() {
    try {
        const r = await apiGet('getBooks');
        if (r.success) {
            availableBooks = r.books;
            renderBookTabs();
            if (availableBooks.length > 0) {
                currentBook = availableBooks[0].name;
                await loadBills();
            }
        }
    } catch (e) { showToast('โหลด Books ไม่ได้', 'error'); }
}

function renderBookTabs() {
    const container = document.getElementById('book-tabs');
    if (!container || availableBooks.length <= 1) return;
    container.innerHTML = '';
    container.style.display = 'flex';
    availableBooks.forEach((b, i) => {
        const btn = document.createElement('button');
        btn.className = 'book-tab' + (i === 0 ? ' active' : '');
        btn.textContent = (b.type === 'VAT' ? '📘' : '📗') + ' ' + b.name;
        btn.onclick = () => {
            document.querySelectorAll('.book-tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            currentBook = b.name;
            loadBills();
        };
        container.appendChild(btn);
    });
}

// ===== Bills =====
async function loadBills() {
    try {
        const r = await apiGet('getBills', { book: currentBook });
        if (r.success) {
            allBills = r.bills; isAdmin = r.isAdmin;
            document.getElementById('user-role').textContent = isAdmin ? 'Admin' : 'Sale';
            renderBills();
        } else showToast(r.error, 'error');
    } catch (e) { showToast('เชื่อมต่อไม่ได้', 'error'); }
}

function renderBills() {
    const c = document.getElementById('bill-list'), empty = document.getElementById('empty-state');
    c.innerHTML = '';
    const filtered = allBills.filter(b => {
        const s = (b.Status || '').toString();
        if (currentFilter === 'all') return true;
        if (currentFilter === 'pending') return s.includes('รอ');
        if (currentFilter === 'paid') return s.includes('ชำระแล้ว');
        if (currentFilter === 'rejected') return s.includes('ไม่ผ่าน') || s.includes('คืน');
        return true;
    });
    if (!filtered.length) { empty.style.display = 'block'; return; }
    empty.style.display = 'none';
    filtered.forEach(bill => {
        const s = (bill.Status || '').toString();
        const sc = s.includes('ชำระแล้ว') ? 'status-paid' : s.includes('ไม่ผ่าน') || s.includes('คืน') ? 'status-rejected' : 'status-pending';
        const cc = s.includes('ชำระแล้ว') ? 'paid' : s.includes('ไม่ผ่าน') ? 'rejected' : 'pending';
        const dt = bill.Created_Date ? new Date(bill.Created_Date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
        const d = document.createElement('div');
        d.className = 'bill-card ' + cc;
        d.onclick = () => showBillDetail(bill.Bill_ID, bill._book || currentBook);
        d.innerHTML = `<div class="bill-card-top"><span class="bill-id">${bill.Bill_ID}</span><span class="status-badge ${sc}">${bill.Status}</span></div>
      <div class="bill-card-body"><div><div class="bill-customer">🏪 ${bill.Customer}</div><div class="bill-date">${dt}</div></div>
      <div class="bill-amount">฿${fmt(bill.Total_Amount)}</div></div>`;
        c.appendChild(d);
    });
}

// ===== Filter =====
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active'); currentFilter = t.dataset.filter; renderBills();
}));

// ===== Detail =====
async function showBillDetail(billId, book) {
    currentBillId = billId; if (book) currentBook = book;
    document.getElementById('bill-list-view').style.display = 'none';
    document.getElementById('bill-detail-view').style.display = 'block';
    document.getElementById('header-title').textContent = '🧾 รายละเอียดบิล';
    try {
        const r = await apiGet('getBillDetail', { billId, book: currentBook });
        if (!r.success) { showToast(r.error, 'error'); return; }
        currentBillData = r.bill;
        document.getElementById('detail-bill-id').textContent = r.bill.Bill_ID;
        document.getElementById('detail-customer').textContent = r.bill.Customer;
        document.getElementById('detail-sale').textContent = r.bill.Sale_Name || '';
        document.getElementById('detail-date').textContent = r.bill.Created_Date ? new Date(r.bill.Created_Date).toLocaleDateString('th-TH') : '';
        const st = (r.bill.Status || '').toString(), se = document.getElementById('detail-status');
        se.textContent = st; se.className = 'status-badge ' + (st.includes('ชำระแล้ว') ? 'status-paid' : st.includes('ไม่ผ่าน') ? 'status-rejected' : 'status-pending');
        const tb = document.getElementById('items-tbody'); tb.innerHTML = '';
        let items = r.bill.Items || []; if (typeof items === 'string') try { items = JSON.parse(items); } catch (e) { items = []; }
        items.forEach(it => {
            const tr = document.createElement('tr'); const sub = (it.qty || 0) * (it.price || 0);
            tr.innerHTML = `<td>${it.name}</td><td>${it.qty}</td><td>฿${fmt(it.price)}</td><td>฿${fmt(sub)}</td>`; tb.appendChild(tr);
        });
        document.getElementById('detail-total').textContent = '฿' + fmt(r.bill.Total_Amount);
        renderPayHist(r.payments);
        document.getElementById('btn-submit-payment').style.display = st.includes('ชำระแล้ว') ? 'none' : 'block';
        renderAdminPanel(r.payments);
        // ปุ่มดูรูปบิล
        renderBillImageBtn(billId);
    } catch (e) { showToast('โหลดไม่ได้', 'error'); }
}

// ===== Bill Image Viewer =====
function renderBillImageBtn(billId) {
    const btn = document.getElementById('btn-view-bill');
    if (btn) btn.onclick = () => loadBillImages(billId);
}

async function loadBillImages(billId) {
    showToast('กำลังโหลดรูปบิล...', 'success');
    try {
        const r = await apiGet('getBillImages', { billId });
        if (!r.success || !r.images || r.images.length === 0) {
            showToast('ไม่พบรูปบิล — ตรวจสอบชื่อไฟล์ใน Google Drive ว่าเริ่มด้วย ' + billId, 'error');
            return;
        }
        showImageViewer(r.images, billId);
    } catch (e) { showToast('โหลดรูปบิลไม่ได้', 'error'); }
}

function showImageViewer(images, billId) {
    let currentIdx = 0;
    const overlay = document.createElement('div');
    overlay.id = 'image-viewer-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.95);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;';

    function render() {
        const img = images[currentIdx];
        overlay.innerHTML = `
            <div style="position:absolute;top:12px;left:16px;right:16px;display:flex;justify-content:space-between;align-items:center;z-index:10001">
                <div style="color:#fff;font-size:14px;font-weight:bold">📄 ${billId} — หน้า ${currentIdx + 1}/${images.length}</div>
                <button onclick="document.getElementById('image-viewer-overlay').remove()" 
                    style="background:rgba(255,255,255,0.2);color:#fff;border:none;border-radius:50%;width:36px;height:36px;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center">×</button>
            </div>
            <div style="flex:1;display:flex;align-items:center;justify-content:center;width:100%;padding:60px 10px 80px;overflow:auto">
                <img src="${img.url}" onerror="this.src='${img.downloadUrl}'" 
                    style="max-width:100%;max-height:100%;object-fit:contain;border-radius:4px;box-shadow:0 0 30px rgba(0,0,0,0.5)" />
            </div>
            <div style="position:absolute;bottom:20px;display:flex;gap:16px;z-index:10001">
                ${images.length > 1 ? `
                    <button id="img-prev-btn" style="background:rgba(255,255,255,0.15);color:#fff;border:none;border-radius:50%;width:48px;height:48px;font-size:22px;cursor:pointer">◀</button>
                    <div style="color:#fff;font-size:16px;display:flex;align-items:center;gap:4px">
                        ${images.map((_, i) => `<span style="width:8px;height:8px;border-radius:50%;background:${i === currentIdx ? '#00B900' : 'rgba(255,255,255,0.3)'}"></span>`).join('')}
                    </div>
                    <button id="img-next-btn" style="background:rgba(255,255,255,0.15);color:#fff;border:none;border-radius:50%;width:48px;height:48px;font-size:22px;cursor:pointer">▶</button>
                ` : ''}
            </div>
        `;
        if (images.length > 1) {
            overlay.querySelector('#img-prev-btn').onclick = () => { currentIdx = (currentIdx - 1 + images.length) % images.length; render(); };
            overlay.querySelector('#img-next-btn').onclick = () => { currentIdx = (currentIdx + 1) % images.length; render(); };
        }
    }

    render();
    // Swipe support สำหรับมือถือ
    let startX = 0;
    overlay.addEventListener('touchstart', e => { startX = e.touches[0].clientX; });
    overlay.addEventListener('touchend', e => {
        const diff = e.changedTouches[0].clientX - startX;
        if (Math.abs(diff) > 50 && images.length > 1) {
            if (diff < 0) currentIdx = (currentIdx + 1) % images.length;
            else currentIdx = (currentIdx - 1 + images.length) % images.length;
            render();
        }
    });
    document.body.appendChild(overlay);
}


function renderPayHist(payments) {
    const c = document.getElementById('payment-history');
    if (!payments?.length) { c.innerHTML = '<p class="no-payments">ยังไม่มีการชำระ</p>'; return; }
    c.innerHTML = ''; payments.forEach(p => {
        const d = document.createElement('div'); d.className = 'payment-item';
        d.innerHTML = `<div class="payment-item-top"><span class="payment-type">${p.Payment_Type} | ฿${fmt(p.Amount)}</span>
      <span class="status-badge ${psc(p.Status)}">${p.Status}</span></div>
      <div style="font-size:12px;color:var(--text-sub)">ผู้โอน: ${p.Sender_Name || '-'} | ${p.Timestamp ? new Date(p.Timestamp).toLocaleString('th-TH') : ''}</div>
      ${p.Note ? '<div style="font-size:12px;margin-top:4px">📝 ' + p.Note + '</div>' : ''}
      ${p.Warning ? '<div class="payment-warning">' + p.Warning + '</div>' : ''}
      ${p.Slip_URL ? '<a href="' + p.Slip_URL + '" target="_blank" style="font-size:12px;color:var(--info)">📎 ดูสลิป</a>' : ''}`;
        c.appendChild(d);
    });
}

function renderAdminPanel(payments) {
    const panel = document.getElementById('admin-panel'), actions = document.getElementById('admin-actions');
    if (!isAdmin) { panel.style.display = 'none'; return; }
    const pending = (payments || []).filter(p => p.Status?.toString().includes('รอตรวจ'));
    if (!pending.length) { panel.style.display = 'none'; return; }
    panel.style.display = 'block'; actions.innerHTML = '';
    pending.forEach(p => {
        const d = document.createElement('div'); d.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;width:100%';
        d.innerHTML = `<span style="flex:1;font-size:13px">${p.Payment_ID} | ฿${fmt(p.Amount)}</span>
      <button class="btn-approve" onclick="doApprove('${p.Payment_ID}')">✅</button>
      <button class="btn-reject" onclick="doReject('${p.Payment_ID}')">❌</button>`;
        actions.appendChild(d);
    });
}

function psc(s) { if (!s) return 'status-pending'; s = s.toString(); return s.includes('ผ่าน') && !s.includes('ไม่') ? 'status-paid' : s.includes('ไม่ผ่าน') ? 'status-rejected' : s.includes('ชื่อไม่ตรง') ? 'status-warning' : 'status-pending'; }
function showBillList() {
    document.getElementById('bill-list-view').style.display = 'block'; document.getElementById('bill-detail-view').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'none'; document.getElementById('header-title').textContent = '🧾 รายการบิล'; loadBills();
}

// ===== Payment Form =====
function showPaymentForm() {
    document.getElementById('payment-modal').style.display = 'flex';
    document.getElementById('pay-amount').value = currentBillData ? currentBillData.Total_Amount : '';
    if (currentBillData?.Customer) loadSenderSugg(currentBillData.Customer);
    document.querySelectorAll('input[name="paymentType"]').forEach(r => r.addEventListener('change', () => {
        document.getElementById('cheque-fields').style.display = r.value === 'เช็ค' ? 'block' : 'none';
    }));
}
function closePaymentForm() {
    document.getElementById('payment-modal').style.display = 'none';
    document.getElementById('payment-form').reset();
    const container = document.getElementById('slip-preview-container');
    if (container) container.innerHTML = '';
    const icon = document.querySelector('.upload-icon');
    if (icon) icon.style.display = '';
    const txt = document.querySelector('.upload-area p');
    if (txt) txt.style.display = '';
    document.getElementById('sender-suggestions').style.display = 'none';
    slipBase64List = [];
}

async function loadSenderSugg(customer) {
    try {
        const r = await apiGet('getShopSenders', { customer });
        if (r.success && r.senders.length) {
            const c = document.getElementById('sender-suggestions');
            c.innerHTML = '<div style="padding:8px 14px;font-size:11px;color:var(--text-sub);font-weight:600">ผู้โอนที่เคยใช้:</div>';
            r.senders.forEach(s => {
                const d = document.createElement('div'); d.className = 'suggestion-item'; d.textContent = s.name;
                d.onclick = () => { document.getElementById('sender-name').value = s.name; c.style.display = 'none'; }; c.appendChild(d);
            });
            c.style.display = 'block';
        }
    } catch (e) { }
}

let slipBase64List = [];

function compressImage(file) {
    return new Promise(resolve => {
        const r = new FileReader();
        r.onload = e => {
            const img = new Image();
            img.onload = () => {
                const MAX = 1200;
                let w = img.width, h = img.height;
                if (w > MAX || h > MAX) {
                    if (w > h) { h = h * MAX / w; w = MAX; }
                    else { w = w * MAX / h; h = MAX; }
                }
                const c = document.createElement('canvas');
                c.width = w; c.height = h;
                c.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve(c.toDataURL('image/jpeg', 0.8).split(',')[1]);
            };
            img.src = e.target.result;
        }; r.readAsDataURL(file);
    });
}

async function previewSlips(input) {
    const files = Array.from(input.files); if (!files.length) return;
    document.querySelector('.upload-icon').style.display = 'none';
    document.querySelector('.upload-area p').style.display = 'none';
    const container = document.getElementById('slip-preview-container');
    container.innerHTML = '<p style="color:#666;font-size:13px">⏳ กำลังประมวลผล ' + files.length + ' รูป...</p>';

    slipBase64List = [];
    for (const f of files) {
        const b64 = await compressImage(f);
        slipBase64List.push(b64);
    }

    container.innerHTML = '';
    container.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:8px';
    slipBase64List.forEach((b64, i) => {
        const img = document.createElement('img');
        img.src = 'data:image/jpeg;base64,' + b64;
        img.style.cssText = 'width:80px;height:80px;object-fit:cover;border-radius:8px;border:2px solid var(--primary)';
        img.title = 'รูปที่ ' + (i + 1);
        container.appendChild(img);
    });
    const label = document.createElement('p');
    label.style.cssText = 'width:100%;text-align:center;font-size:13px;color:var(--primary-dark);font-weight:600;margin-top:4px';
    label.textContent = '📷 ' + slipBase64List.length + ' รูป';
    container.appendChild(label);
}

async function handleSubmitPayment(event) {
    event.preventDefault(); const btn = document.getElementById('btn-do-submit');
    btn.disabled = true; btn.textContent = '⏳ กำลังส่ง...';
    try {
        const pt = document.querySelector('input[name="paymentType"]:checked').value;
        const payload = {
            action: 'submitPayment', billId: currentBillId, paymentType: pt,
            senderName: document.getElementById('sender-name').value,
            amount: parseFloat(document.getElementById('pay-amount').value),
            note: document.getElementById('pay-note').value,
            slipImages: slipBase64List.length > 0 ? slipBase64List : (slipBase64List.length === 0 ? [] : []),
            slipImageBase64: slipBase64List[0] || ''
        };
        if (pt === 'เช็ค') payload.chequeData = {
            bank: document.getElementById('cheque-bank').value,
            chequeNo: document.getElementById('cheque-no').value, chequeDate: document.getElementById('cheque-date').value, amount: payload.amount
        };
        const r = await apiPost(payload);
        if (r.success) {
            closePaymentForm(); showToast(r.message, r.warning ? 'warning' : 'success');
            if (liff.isInClient()) liff.sendMessages([{ type: 'text', text: '✅ ส่งสลิป บิล:' + currentBillId + ' ฿' + fmt(payload.amount) }]).catch(() => { });
            showBillDetail(currentBillId);
        }
        else showToast(r.error, 'error');
    } catch (e) { showToast('เกิดข้อผิดพลาด: ' + (e.message || e), 'error'); console.error('submitPayment error:', e); }
    finally {
        btn.disabled = false; btn.textContent = '✅ ส่งหลักฐาน';
        slipBase64List = [];
        const container = document.getElementById('slip-preview-container');
        if (container) container.innerHTML = '';
        document.querySelector('.upload-icon').style.display = '';
        document.querySelector('.upload-area p').style.display = '';
    }
}

// ===== Admin =====
async function doApprove(pid) {
    if (!confirm('อนุมัติ?')) return; const r = await apiPost({ action: 'approvePayment', paymentId: pid });
    showToast(r.message || r.error, r.success ? 'success' : 'error'); if (r.success) showBillDetail(currentBillId);
}
async function doReject(pid) {
    const reason = prompt('เหตุผล:'); if (reason === null) return;
    const r = await apiPost({ action: 'rejectPayment', paymentId: pid, reason });
    showToast(r.message || r.error, r.success ? 'success' : 'error'); if (r.success) showBillDetail(currentBillId);
}

// ===== Toast & Utils =====
function showToast(msg, type = 'success') {
    const t = document.getElementById('toast'), m = document.getElementById('toast-message');
    t.className = 'toast ' + type; m.textContent = msg; t.style.display = 'block'; setTimeout(() => t.style.display = 'none', 4000);
}
function fmt(n) { return n == null ? '0' : Number(n).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
