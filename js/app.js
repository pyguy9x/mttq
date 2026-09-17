/* KPI MTTQ — port từ js/legacy.js dòng 7296-7411 + auth MTTQ (legacy 34-46, 371-377, 542-543). */
const SUPABASE_URL = window.SUPABASE_URL, SUPABASE_KEY = window.SUPABASE_KEY;
const MTTQ_ADMIN_TOKEN = "CQ-MAUA-TVH1-MTTQ";
const MTTQ_TOKENS = {
  "CQ-MAUA-TVH1-MTTQ": "Trần Văn Hùng", "CQ-MAUA-NTT1-MTTQ": "Nguyễn Thị Thu",
  "CQ-MAUA-PTKO-MTTQ": "Phương Thị Kiều Oanh", "CQ-MAUA-TVH2-MTTQ": "Trần Văn Hậu",
  "CQ-MAUA-TNC-MTTQ": "Trần Như Cường", "CQ-MAUA-PTT-MTTQ": "Phạm Thị Tâm",
  "CQ-MAUA-BTM-MTTQ": "Bàn Thị Mủi", "CQ-MAUA-LVM-MTTQ": "Lương Văn Minh",
  "CQ-MAUA-NTT2-MTTQ": "Nông Thị Thu", "CQ-MAUA-PTBQ-MTTQ": "Phạm Thị Bích Quyên"
};
let CURRENT_USER = null;
let MTTQ_KPI_PEOPLE = [], MTTQ_KPI_CATALOG = [], MTTQ_KPI_TASKS = [], MTTQ_KPI_EDIT_ID = null, MTTQ_KPI_CHART = null;
const MTTQ_KPI_PEOPLE_API = `${SUPABASE_URL}/rest/v1/mttq_kpi_people`;
const MTTQ_KPI_CATALOG_API = `${SUPABASE_URL}/rest/v1/mttq_kpi_catalog`;
const MTTQ_KPI_TASKS_API = `${SUPABASE_URL}/rest/v1/mttq_kpi_tasks`;

/* --- helpers --- */
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m])); }
function toast(msg, type = "ok") { const el = document.getElementById("toast"); if (!el) return alert(msg); el.textContent = msg; el.className = "toast show " + type; clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 3000); }
function openModal(id) { document.getElementById(id)?.classList.add("open"); }
function closeModal(id) { document.getElementById(id)?.classList.remove("open"); }

/* --- auth: admin full, mttqAdmin full, staff scope mttq --- */
function canAccessMTTQKPI(u = CURRENT_USER) { return !!u && (u.role === "admin" || (u.role === "staff" && u.scope === "mttq")); }
function isMTTQAdmin(u = CURRENT_USER) { return !!u && (u.role === "admin" || (u.scope === "mttq" && u.mttqAdmin === true)); }
async function loginWithToken(token) {
  const t = String(token || "").trim();
  if (!t) return toast("Nhập token đăng nhập", "err");
  try { const r = await fetch("api/admin.js", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: t, action: "login" }) }); if (r.ok) { const u = await r.json(); if (u && !u.error) return setUser(u, t); } } catch {}
  if (t === "ADM-MAUA-adm") return setUser({ id: "demo-admin", name: "Quản trị hệ thống", role: "admin", scope: "all" }, t);
  if (MTTQ_TOKENS[t]) return setUser({ id: "mttq-" + t.slice(-10), name: MTTQ_TOKENS[t], role: "staff", scope: "mttq", title: "Cán bộ MTTQ", unit: "MTTQ", mttqAdmin: t === MTTQ_ADMIN_TOKEN }, t);
  toast("Token không hợp lệ", "err");
}
function setUser(u, token) {
  CURRENT_USER = u; CURRENT_USER._rawToken = token;
  try { localStorage.setItem("mttq_user", JSON.stringify(u)); localStorage.setItem("mttq_token", token); } catch {}
  applyUser();
}
function logoutUser() { CURRENT_USER = null; try { localStorage.removeItem("mttq_user"); localStorage.removeItem("mttq_token"); } catch {} applyUser(); }
function applyUser() {
  const gate = document.getElementById("loginGate"), app = document.getElementById("app");
  if (!canAccessMTTQKPI()) { gate?.classList.add("open"); app?.classList.remove("open"); return; }
  gate?.classList.remove("open"); app?.classList.add("open");
  const info = document.getElementById("userInfo");
  if (info) info.textContent = `${CURRENT_USER.name} · ${isMTTQAdmin() ? "Admin KPI MTTQ" : CURRENT_USER.role === "admin" ? "Admin" : "Cán bộ MTTQ"}`;
  loadMTTQKPIData(false);
}
function restoreSession() {
  try {
    const t = localStorage.getItem("mttq_token"), raw = localStorage.getItem("mttq_user");
    if (t === "ADM-MAUA-adm") { CURRENT_USER = { id: "demo-admin", name: "Quản trị hệ thống", role: "admin", scope: "all", _rawToken: t }; }
    else if (t && MTTQ_TOKENS[t]) { CURRENT_USER = { id: "mttq-" + t.slice(-10), name: MTTQ_TOKENS[t], role: "staff", scope: "mttq", title: "Cán bộ MTTQ", unit: "MTTQ", mttqAdmin: t === MTTQ_ADMIN_TOKEN, _rawToken: t }; }
    else if (raw) { const u = JSON.parse(raw); if (u && u.id) { if (u.scope === "mttq") u.mttqAdmin = (u._rawToken || t) === MTTQ_ADMIN_TOKEN; CURRENT_USER = u; } }
  } catch {}
  applyUser();
}

/* --- core MTTQ (giữ nguyên logic gốc) --- */
function mttqKpiHeaders(json = false) { const h = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }; if (json) { h["Content-Type"] = "application/json"; h.Prefer = "return=representation"; } return h; }
function mttqKpiFold(v) { return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Đ/g, "D").replace(/đ/g, "d").toLowerCase().trim(); }
function mttqKpiParseDate(v) { const s = String(v || "").trim(), iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/), dm = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/); let d = null;
  if (iso) d = new Date(+iso[1], +iso[2] - 1, +iso[3]);
  else if (dm) { const dd = +dm[1], mm = +dm[2], yy = +dm[3]; if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null; d = new Date(yy, mm - 1, dd); if (d.getFullYear() !== yy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null; }
  return d && !isNaN(d) ? d : null; }
function mttqKpiDateDb(v) { const d = mttqKpiParseDate(v); return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null; }
function mttqKpiDateDisplay(v) { const d = mttqKpiParseDate(v); return d ? `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` : ""; }
function mttqKpiToIso(v) { const d = mttqKpiParseDate(v); return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : ""; }
function mttqKpiMaskDate(input) { const d = input.value.replace(/\D/g, "").slice(0, 8); let out = d; if (d.length > 4) out = d.slice(0, 2) + "/" + d.slice(2, 4) + "/" + d.slice(4); else if (d.length > 2) out = d.slice(0, 2) + "/" + d.slice(2); input.value = out; return out; }
function mttqKpiSyncDeadlinePicker() { const t = document.getElementById("mttqKpiDeadline"), p = document.getElementById("mttqKpiDeadlinePicker"); if (p && t) p.value = mttqKpiToIso(t.value); }
function mttqKpiBindDeadline() { const t = document.getElementById("mttqKpiDeadline"), p = document.getElementById("mttqKpiDeadlinePicker"); if (!t || !p || p._bound) return; p._bound = true;
  t.addEventListener("input", () => { mttqKpiMaskDate(t); if (/^\d{2}\/\d{2}\/\d{4}$/.test(t.value)) { if (!mttqKpiParseDate(t.value)) t.setCustomValidity("Ngày không hợp lệ (dd/mm/yyyy)"); else { t.setCustomValidity(""); p.value = mttqKpiToIso(t.value); } } else t.setCustomValidity(""); });
  t.addEventListener("blur", () => { if (t.value && !mttqKpiParseDate(t.value)) toast("Hạn phải đúng dd/mm/yyyy, ví dụ 25/12/2026", "err"); });
  p.addEventListener("change", () => { if (!p.value) return; const y = p.value.slice(0, 4), m = p.value.slice(5, 7), d = p.value.slice(8, 10); t.value = `${d}/${m}/${y}`; t.setCustomValidity(""); }); }
function mttqKpiStatusKey(t) {
  const o = mttqKpiFold(t.outcome);
  if (o === "truoc han") return "early"; if (o === "dung han") return "ontime";
  if (o === "qua han") return "late_done"; if (o === "khong hoan thanh") return "failed";
  const due = mttqKpiParseDate(t.deadline), today = new Date(); today.setHours(0, 0, 0, 0);
  return due && due < today ? "overdue" : "processing";
}
function mttqKpiStatusLabel(k) { return ({ early: "Hoàn thành trước hạn", ontime: "Hoàn thành đúng hạn", late_done: "Hoàn thành quá hạn", failed: "Không hoàn thành", overdue: "Quá hạn", processing: "Đang thực hiện" })[k] || "Đang thực hiện"; }
function mttqKpiIsDone(t) { return ["early", "ontime", "late_done"].includes(mttqKpiStatusKey(t)); }
function mttqKpiScore(t) { const n = Number(t.converted_score); return Number.isFinite(n) ? n : 0; }
function mttqKpiPersonName(t) { return MTTQ_KPI_PEOPLE.find(p => String(p.id) === String(t.person_id))?.name || t.person_name || "Chưa gán cán bộ"; }
function mttqKpiCanEditTask(t) { if (!t || !CURRENT_USER) return false; if (isMTTQAdmin()) return true; return CURRENT_USER.role === "staff" && CURRENT_USER.scope === "mttq" && mttqKpiFold(mttqKpiPersonName(t)) === mttqKpiFold(CURRENT_USER.name); }
function mttqKpiOwnPersonId() { return MTTQ_KPI_PEOPLE.find(p => mttqKpiFold(p.name) === mttqKpiFold(CURRENT_USER?.name))?.id || null; }
function mttqKpiUpcoming(t, days) { if (mttqKpiStatusKey(t) !== "processing") return false; const due = mttqKpiParseDate(t.deadline), today = new Date(); today.setHours(0, 0, 0, 0); if (!due) return false; const end = new Date(today); end.setDate(end.getDate() + days); return due >= today && due <= end; }
function mttqKpiScopedTasks() {
  const person = document.getElementById("mttqKpiPersonFilter")?.value || "all", month = document.getElementById("mttqKpiMonthFilter")?.value || "all", year = document.getElementById("mttqKpiYearFilter")?.value || "all";
  return MTTQ_KPI_TASKS.filter(x => (person === "all" || String(x.person_id) === person) && (month === "all" || String(x.task_month || "") === month) && (year === "all" || String(x.task_year || "") === year));
}
function populateMTTQKPIFilters() {
  const person = document.getElementById("mttqKpiPersonFilter"), month = document.getElementById("mttqKpiMonthFilter"), year = document.getElementById("mttqKpiYearFilter"), editPerson = document.getElementById("mttqKpiPerson");
  if (person) { const old = person.value; person.innerHTML = '<option value="all">Tất cả cán bộ</option>' + MTTQ_KPI_PEOPLE.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join(""); person.value = MTTQ_KPI_PEOPLE.some(p => String(p.id) === old) ? old : "all"; }
  if (editPerson) { const old = editPerson.value; editPerson.innerHTML = MTTQ_KPI_PEOPLE.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join(""); if (old) editPerson.value = old; }
  const fill = (el, label, values) => { if (!el) return; const old = el.value; el.innerHTML = `<option value="all">${label}</option>` + values.map(v => `<option value="${v}">${v}</option>`).join(""); el.value = values.map(String).includes(old) ? old : "all"; };
  fill(month, "Tất cả tháng", [...new Set(MTTQ_KPI_TASKS.map(x => Number(x.task_month)).filter(Boolean))].sort((a, b) => a - b));
  fill(year, "Tất cả năm", [...new Set(MTTQ_KPI_TASKS.map(x => Number(x.task_year)).filter(Boolean))].sort((a, b) => b - a));
  const list = document.getElementById("mttqTaskCatalogList"); if (list) list.innerHTML = MTTQ_KPI_CATALOG.map(x => `<option value="${esc(x.task_name || "")}"></option>`).join("");
}
async function loadMTTQKPIData(force = false) {
  const sync = document.getElementById("mttqKpiSyncText");
  try {
    const [pr, cr, tr] = await Promise.all([
      fetch(`${MTTQ_KPI_PEOPLE_API}?select=*&order=name.asc`, { headers: mttqKpiHeaders() }),
      fetch(`${MTTQ_KPI_CATALOG_API}?select=*&order=task_name.asc`, { headers: mttqKpiHeaders() }),
      fetch(`${MTTQ_KPI_TASKS_API}?select=*&order=deadline.asc,created_at.asc`, { headers: mttqKpiHeaders() })]);
    if (!pr.ok || !cr.ok || !tr.ok) throw new Error("Chưa có đủ 3 bảng KPI MTTQ. Hãy chạy supabase/schema.sql trước.");
    MTTQ_KPI_PEOPLE = await pr.json(); MTTQ_KPI_CATALOG = await cr.json(); MTTQ_KPI_TASKS = await tr.json();
    populateMTTQKPIFilters(); renderMTTQKPITable();
    if (sync) sync.textContent = `Đã cập nhật lúc ${new Date().toLocaleTimeString("vi-VN")} · ${MTTQ_KPI_TASKS.length} nhiệm vụ`;
  } catch (e) {
    if (sync) sync.textContent = "⚠️ Chưa kết nối được dữ liệu KPI MTTQ";
    if (force || !MTTQ_KPI_TASKS.length) toast("Không tải được KPI MTTQ: " + e.message, "err");
  }
}
function badgeCls(k) { return k === "processing" ? "processing" : (k === "overdue" || k === "failed") ? "overdue" : "done"; }
function renderMTTQKPITable() {
  const scoped = mttqKpiScopedTasks(), q = mttqKpiFold(document.getElementById("mttqKpiSearch")?.value), statusFilter = document.getElementById("mttqKpiStatusFilter")?.value || "all";
  const rows = scoped.filter(x => { const s = mttqKpiStatusKey(x); if (statusFilter !== "all" && s !== statusFilter && !(statusFilter === "done" && mttqKpiIsDone(x))) return false; if (!q) return true; return mttqKpiFold(`${mttqKpiPersonName(x)} ${x.task_name} ${x.assigner} ${x.product} ${x.outcome}`).includes(q); });
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("mttqKpiTotal", scoped.length); set("mttqKpiDone", scoped.filter(mttqKpiIsDone).length);
  set("mttqKpiProcessing", scoped.filter(x => mttqKpiStatusKey(x) === "processing").length);
  set("mttqKpiOverdue", scoped.filter(x => mttqKpiStatusKey(x) === "overdue").length);
  set("mttqKpiScore", scoped.reduce((s, x) => s + mttqKpiScore(x), 0).toFixed(2));
  set("mttqKpiSoon3", scoped.filter(x => mttqKpiUpcoming(x, 3)).length);
  set("mttqKpiSoon7", scoped.filter(x => mttqKpiUpcoming(x, 7)).length);
  set("mttqKpiShownCount", rows.length);
  const body = document.getElementById("mttqKpiTableBody"), empty = document.getElementById("mttqKpiEmpty"); if (!body) return;
  body.innerHTML = rows.map((x, i) => { const k = mttqKpiStatusKey(x);
    const act = mttqKpiCanEditTask(x) ? `<button class="btn sm edit" onclick="event.stopPropagation();openMTTQKPIEdit('${x.id}')">Sửa</button><button class="btn sm danger" onclick="event.stopPropagation();deleteMTTQKPITask('${x.id}')">Xóa</button>` : '<span class="readonly">Chỉ xem</span>';
    return `<tr onclick="openMTTQKPIDrillById('${x.id}')"><td>${i + 1}</td><td><b>${esc(mttqKpiPersonName(x))}</b></td><td title="${esc(x.task_name || "")}">${esc(x.task_name || "-")}</td><td>${esc(x.assigner || "-")}</td><td>${esc(mttqKpiDateDisplay(x.deadline) || "-")}</td><td>${esc(x.outcome || "Chưa hoàn thành")}</td><td><b>${mttqKpiScore(x).toFixed(2)}</b></td><td><span class="badge ${badgeCls(k)}">${esc(mttqKpiStatusLabel(k))}</span></td><td class="nowrap">${act}</td></tr>`; }).join("");
  if (empty) empty.style.display = rows.length ? "none" : "block";
  renderMTTQKPIChart();
}
function renderMTTQKPIChart() {
  const canvas = document.getElementById("mttqKpiPerformanceChart");
  if (MTTQ_KPI_CHART) { MTTQ_KPI_CHART.destroy(); MTTQ_KPI_CHART = null; }
  if (!canvas || !window.Chart) return;
  const scoped = mttqKpiScopedTasks();
  const defs = [{ key: "done", label: "Hoàn thành", color: "#22c55e" }, { key: "processing", label: "Đang thực hiện", color: "#06b6d4" }, { key: "overdue", label: "Quá hạn", color: "#ef4444" }, { key: "failed", label: "Không hoàn thành", color: "#f59e0b" }];
  const people = MTTQ_KPI_PEOPLE.filter(p => scoped.some(x => String(x.person_id) === String(p.id)));
  if (!people.length) return;
  const match = (x, pid, key) => String(x.person_id) === String(pid) && (key === "done" ? mttqKpiIsDone(x) : mttqKpiStatusKey(x) === key);
  MTTQ_KPI_CHART = new Chart(canvas.getContext("2d"), { type: "bar",
    data: { labels: people.map(p => p.name), datasets: defs.map(d => ({ label: d.label, data: people.map(p => scoped.filter(x => match(x, p.id, d.key)).length), backgroundColor: d.color, borderRadius: 4, borderSkipped: false })) },
    options: { indexAxis: "y", responsive: true, maintainAspectRatio: false,
      scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }, y: { stacked: true, ticks: { autoSkip: false } } },
      plugins: { legend: { position: "top" } },
      onClick: (ev, els) => { if (!els.length) return; const el = els[0], person = people[el.index], def = defs[el.datasetIndex]; if (!person || !def) return;
        showMTTQKPIDrill(scoped.filter(x => match(x, person.id, def.key)), `${person.name} · ${def.label}`); } } });
}
function showMTTQKPIDrill(rows, title = "Chi tiết KPI MTTQ") {
  const body = document.getElementById("mttqKpiDrillBody"), empty = document.getElementById("mttqKpiDrillEmpty"); if (!body) return;
  document.getElementById("mttqKpiDrillTitle").textContent = title;
  document.getElementById("mttqKpiDrillCount").textContent = rows.length;
  const list = [...rows].sort((a, b) => (mttqKpiParseDate(a.deadline) || new Date(8640000000000000)) - (mttqKpiParseDate(b.deadline) || new Date(8640000000000000)));
  body.innerHTML = list.map((x, i) => { const k = mttqKpiStatusKey(x);
    const act = mttqKpiCanEditTask(x) ? `<button class="btn sm edit" onclick="event.stopPropagation();closeMTTQKPIDrill();openMTTQKPIEdit('${x.id}')">Sửa</button>` : '<span class="readonly">Chỉ xem</span>';
    return `<tr onclick="closeMTTQKPIDrill();openMTTQKPIDetail('${x.id}')"><td>${i + 1}</td><td>${esc(mttqKpiPersonName(x))}</td><td title="${esc(x.task_name || "")}">${esc(x.task_name || "-")}</td><td>${esc(mttqKpiDateDisplay(x.deadline) || "-")}</td><td>${esc(x.outcome || "Chưa hoàn thành")}</td><td><b>${mttqKpiScore(x).toFixed(2)}</b></td><td><span class="badge ${badgeCls(k)}">${esc(mttqKpiStatusLabel(k))}</span></td><td>${act}</td></tr>`; }).join("");
  if (empty) empty.style.display = list.length ? "none" : "block";
  openModal("mttqKpiDrillModal");
}
function openMTTQKPIDrill(mode) { const s = mttqKpiScopedTasks(); let rows, title;
  if (mode === "total") { rows = s; title = "Tất cả nhiệm vụ"; }
  else if (mode === "done") { rows = s.filter(x => mttqKpiIsDone(x)); title = "Nhiệm vụ hoàn thành"; }
  else if (mode === "processing") { rows = s.filter(x => mttqKpiStatusKey(x) === "processing"); title = "Nhiệm vụ đang thực hiện"; }
  else if (mode === "overdue") { rows = s.filter(x => mttqKpiStatusKey(x) === "overdue"); title = "Nhiệm vụ quá hạn"; }
  else if (mode === "soon3") { rows = s.filter(x => mttqKpiUpcoming(x, 3)); title = "Sắp đến hạn trong 3 ngày"; }
  else if (mode === "soon7") { rows = s.filter(x => mttqKpiUpcoming(x, 7)); title = "Sắp đến hạn trong 7 ngày"; }
  else { rows = s; title = "Chi tiết KPI MTTQ"; }
  showMTTQKPIDrill(rows, title); }
function openMTTQKPIDrillById(id) { const t = MTTQ_KPI_TASKS.find(x => String(x.id) === String(id)); if (t) showMTTQKPIDrill([t], `Chi tiết · ${mttqKpiPersonName(t)}`); }
function closeMTTQKPIDrill() { closeModal("mttqKpiDrillModal"); }
function openMTTQKPIDetail(id) {
  const t = MTTQ_KPI_TASKS.find(x => String(x.id) === String(id));
  if (!t) return;
  const k = mttqKpiStatusKey(t), person = mttqKpiPersonName(t);
  const fields = [
    ["Cán bộ", person], ["Nhiệm vụ", t.task_name || "-"], ["Người giao", t.assigner || "-"],
    ["Hạn hoàn thành", mttqKpiDateDisplay(t.deadline) || "-"], ["Kết quả", t.outcome || "Chưa hoàn thành"],
    ["Điểm số", mttqKpiScore(t).toFixed(2)], ["Trạng thái", mttqKpiStatusLabel(k)],
    ["Cấp độ", t.level || "-"], ["Hệ số quy đổi", t.conversion_factor ?? "-"],
    ["Trục KPI", t.kpi_axis || "-"], ["Sản phẩm", t.product || "-"],
    ["Số lần sai sót", t.quality_errors ?? 0], ["Ghi chú", t.note || "-"]
  ];
  document.getElementById("mttqKpiDetailTitle").textContent = `Chi tiết · ${person}`;
  document.getElementById("mttqKpiDetailBody").innerHTML = fields.map(([l, v]) =>
    `<div class="detail-row"><span class="detail-label">${l}</span><span class="detail-val">${esc(v)}</span></div>`
  ).join("") + (mttqKpiCanEditTask(t) ? `<div class="detail-actions"><button class="btn primary" onclick="closeMTTQKPIDetail();openMTTQKPIEdit('${t.id}')">Sửa nhiệm vụ</button></div>` : "");
  openModal("mttqKpiDetailModal");
}
function closeMTTQKPIDetail() { closeModal("mttqKpiDetailModal"); }
function resetMTTQKPIFilters() { const s = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; }; s("mttqKpiSearch", ""); s("mttqKpiPersonFilter", "all"); s("mttqKpiMonthFilter", "all"); s("mttqKpiYearFilter", "all"); s("mttqKpiStatusFilter", "all"); renderMTTQKPITable(); }

/* --- CRUD --- */
function openMTTQKPIEdit(id = "") {
  const x = id ? MTTQ_KPI_TASKS.find(r => String(r.id) === String(id)) : null;
  if (x && !mttqKpiCanEditTask(x)) return toast("Bạn chỉ được sửa nhiệm vụ có tên mình", "err");
  if (!x && !canAccessMTTQKPI()) return toast("Chỉ Admin và cán bộ MTTQ được nhập nhiệm vụ", "err");
  MTTQ_KPI_EDIT_ID = id || null; populateMTTQKPIFilters();
  document.getElementById("mttqKpiEditTitle").textContent = x ? "Cập nhật nhiệm vụ KPI MTTQ" : "Thêm nhiệm vụ KPI MTTQ";
  const set = (i, v) => { const el = document.getElementById(i); if (el) el.value = v ?? ""; };
  set("mttqKpiPerson", x?.person_id || (CURRENT_USER?.scope === "mttq" && !isMTTQAdmin() ? mttqKpiOwnPersonId() : MTTQ_KPI_PEOPLE[0]?.id) || "");
  set("mttqKpiTaskName", x?.task_name); set("mttqKpiAssigner", x?.assigner);
  set("mttqKpiDeadline", mttqKpiDateDisplay(x?.deadline)); mttqKpiBindDeadline(); mttqKpiSyncDeadlinePicker(); set("mttqKpiOutcome", x?.outcome || "");  set("mttqKpiQualityErrors", x?.quality_errors ?? 0); set("mttqKpiProduct", x?.product);
  set("mttqKpiLevel", x?.level || 1); set("mttqKpiFactor", x?.conversion_factor ?? 1);
  set("mttqKpiAxis", x?.kpi_axis); set("mttqKpiNote", x?.note);
  const pf = document.getElementById("mttqKpiPerson"); if (pf) pf.disabled = !isMTTQAdmin();
  openModal("mttqKpiEditModal");
}
function closeMTTQKPIEdit() { closeModal("mttqKpiEditModal"); MTTQ_KPI_EDIT_ID = null; }
function mttqKpiBuildPayload() {
  const raw = document.getElementById("mttqKpiDeadline")?.value.trim() || "", deadline = mttqKpiDateDb(raw);
  const outcome = document.getElementById("mttqKpiOutcome")?.value || "";
  const errors = Math.max(0, Number(document.getElementById("mttqKpiQualityErrors")?.value || 0));
  const level = Number(document.getElementById("mttqKpiLevel")?.value || 1), factor = Number(document.getElementById("mttqKpiFactor")?.value || 1);
  const progress = ["Trước hạn", "Đúng hạn"].includes(outcome) ? 1 : outcome === "Quá hạn" ? 0.75 : 0;
  const quantity = outcome === "Không hoàn thành" ? 0 : 1, quality = Math.max(0, 1 - 0.25 * errors);
  const d = mttqKpiParseDate(raw);
  const personId = isMTTQAdmin() ? (document.getElementById("mttqKpiPerson")?.value || null) : mttqKpiOwnPersonId();
  const g = id => document.getElementById(id)?.value.trim() || "";
  return { person_id: personId, task_name: g("mttqKpiTaskName"), assigner: g("mttqKpiAssigner"), deadline, outcome,
    product: g("mttqKpiProduct"), quality_errors: errors, level, conversion_factor: factor,
    quantity_score: quantity, quality_score: quality, progress_score: progress,
    converted_score: Number((factor * ((quantity + quality + progress) / 3)).toFixed(6)),
    kpi_axis: g("mttqKpiAxis"), note: g("mttqKpiNote"), report_status: outcome ? "✓ Đã tính vào báo cáo" : "",
    task_month: d ? d.getMonth() + 1 : null, task_quarter: d ? Math.ceil((d.getMonth() + 1) / 3) : null, task_year: d ? d.getFullYear() : null,
    updated_at: new Date().toISOString() };
}
async function saveMTTQKPITask() {
  const cur = MTTQ_KPI_EDIT_ID ? MTTQ_KPI_TASKS.find(x => String(x.id) === String(MTTQ_KPI_EDIT_ID)) : null;
  if (cur && !mttqKpiCanEditTask(cur)) return toast("Bạn chỉ được sửa nhiệm vụ có tên mình", "err");
  if (!cur && !canAccessMTTQKPI()) return toast("Không có quyền thêm nhiệm vụ", "err");
  const p = mttqKpiBuildPayload();
  const rawDl = document.getElementById("mttqKpiDeadline")?.value.trim() || "";
  if (rawDl && !/^\d{2}\/\d{2}\/\d{4}$/.test(rawDl)) return toast("Hạn phải đúng dd/mm/yyyy, ví dụ 25/12/2026", "err");
  if (!p.person_id || !p.task_name || !p.deadline) return toast("Cần chọn cán bộ, nhập tên nhiệm vụ và hạn dd/mm/yyyy hợp lệ", "err");
  const url = MTTQ_KPI_EDIT_ID ? `${MTTQ_KPI_TASKS_API}?id=eq.${encodeURIComponent(MTTQ_KPI_EDIT_ID)}` : MTTQ_KPI_TASKS_API;
  try {
    const r = await fetch(url, { method: MTTQ_KPI_EDIT_ID ? "PATCH" : "POST", headers: mttqKpiHeaders(true), body: JSON.stringify(p) });
    if (!r.ok) throw new Error(await r.text());
    closeMTTQKPIEdit(); await loadMTTQKPIData(true); toast(MTTQ_KPI_EDIT_ID ? "Đã cập nhật KPI" : "Đã thêm nhiệm vụ KPI");
  } catch (e) { toast("Không lưu được KPI: " + e.message, "err"); }
}
async function deleteMTTQKPITask(id) {
  const t = MTTQ_KPI_TASKS.find(x => String(x.id) === String(id));
  if (!t || !mttqKpiCanEditTask(t) || !confirm(`Xóa nhiệm vụ "${t.task_name || "KPI"}"?`)) return;
  try {
    const r = await fetch(`${MTTQ_KPI_TASKS_API}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", headers: mttqKpiHeaders() });
    if (!r.ok) throw new Error(await r.text());
    await loadMTTQKPIData(true); toast("Đã xóa nhiệm vụ KPI");
  } catch (e) { toast("Không xóa được KPI: " + e.message, "err"); }
}
document.addEventListener("DOMContentLoaded", restoreSession);
