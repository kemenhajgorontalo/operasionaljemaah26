import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

const CONFIG = window.APP_CONFIG || {};
const LOCAL_ACTIVITY_KEY = "asramahaji_activity_cache";
const HANDOVER_LABELS = {
  living_cost: "Living Cost",
  accommodation_card: "Kartu Akomodasi",
  bracelet: "Gelang",
  luggage: "Koper"
};

let db = null;
let cloudReady = false;
let pilgrims = [];
let rooms = [];
let selectedPilgrim = null;
let selectedPilgrimId = "";
let recentActivities = [];

const refs = {
  officerName: document.getElementById("officer-name"),
  kloterFilter: document.getElementById("kloter-filter"),
  searchInput: document.getElementById("search-input"),
  summary: document.getElementById("summary"),
  resultCount: document.getElementById("result-count"),
  pilgrimList: document.getElementById("pilgrim-list"),
  emptyState: document.getElementById("empty-state"),
  pilgrimDetail: document.getElementById("pilgrim-detail"),
  detailKloter: document.getElementById("detail-kloter"),
  detailName: document.getElementById("detail-name"),
  detailMeta: document.getElementById("detail-meta"),
  detailAccommodation: document.getElementById("detail-accommodation"),
  handoverForm: document.getElementById("handover-form"),
  handoverType: document.getElementById("handover-type"),
  handoverPhoto: document.getElementById("handover-photo"),
  handoverNote: document.getElementById("handover-note"),
  roomForm: document.getElementById("room-form"),
  roomSelect: document.getElementById("room-select"),
  roomPhoto: document.getElementById("room-photo"),
  roomNote: document.getElementById("room-note"),
  lostForm: document.getElementById("lost-form"),
  lostTitle: document.getElementById("lost-title"),
  lostStatus: document.getElementById("lost-status"),
  lostPhoto: document.getElementById("lost-photo"),
  lostNote: document.getElementById("lost-note"),
  galleryForm: document.getElementById("gallery-form"),
  galleryCategory: document.getElementById("gallery-category"),
  galleryPhoto: document.getElementById("gallery-photo"),
  galleryNote: document.getElementById("gallery-note"),
  activityList: document.getElementById("activity-list"),
  clearLocal: document.getElementById("clear-local"),
  toast: document.getElementById("toast")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  refs.officerName.value = localStorage.getItem("asramahaji_officer_name") || "";
  refs.officerName.addEventListener("input", () => {
    localStorage.setItem("asramahaji_officer_name", refs.officerName.value.trim());
  });

  await loadSeedData();
  initFirebase();
  cloudReady = isCloudinaryConfigured();
  bindEvents();
  renderSummary();
  renderRooms();
  renderPilgrims();
  await loadRecentActivities();
}

async function loadSeedData() {
  const [pilgrimsRes, roomsRes] = await Promise.all([
    fetch("data/pilgrims.json"),
    fetch("data/rooms.json")
  ]);
  pilgrims = await pilgrimsRes.json();
  rooms = await roomsRes.json();
}

function initFirebase() {
  if (!isFirebaseConfigured()) return;
  const app = initializeApp(CONFIG.FIREBASE_CONFIG);
  db = getFirestore(app);
}

function bindEvents() {
  refs.kloterFilter.addEventListener("change", () => {
    renderPilgrims();
    renderRooms();
  });
  refs.searchInput.addEventListener("input", renderPilgrims);
  refs.handoverForm.addEventListener("submit", handleHandoverSubmit);
  refs.roomForm.addEventListener("submit", handleRoomSubmit);
  refs.lostForm.addEventListener("submit", handleLostSubmit);
  refs.galleryForm.addEventListener("submit", handleGallerySubmit);
  refs.clearLocal.addEventListener("click", () => {
    localStorage.removeItem(LOCAL_ACTIVITY_KEY);
    recentActivities = [];
    renderActivities();
    showToast("Cache aktivitas lokal dibersihkan.");
  });
}

function renderSummary() {
  const kloter28 = pilgrims.filter((p) => p.kloter === "28").length;
  const kloter30 = pilgrims.filter((p) => p.kloter === "30").length;
  const roomCount = rooms.length;
  const cloudLabel = db ? "Firebase aktif" : "Mode lokal";

  refs.summary.innerHTML = [
    ["Total Jemaah", pilgrims.length],
    ["Kloter 28", kloter28],
    ["Kloter 30", kloter30],
    ["Kamar", `${roomCount} · ${cloudLabel}`]
  ].map(([label, value]) => `
    <div class="summary-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");
}

function renderPilgrims() {
  const filtered = getFilteredPilgrims().slice(0, 80);
  refs.resultCount.textContent = `${filtered.length} tampil`;

  refs.pilgrimList.innerHTML = filtered.map((p) => `
    <button class="pilgrim-item ${p.id === selectedPilgrimId ? "active" : ""}" type="button" data-id="${escapeAttr(p.id)}">
      <strong>${escapeHtml(p.name)}</strong>
      <span>${escapeHtml(p.kloterLabel)} · Porsi ${escapeHtml(p.noPorsi)} · Kamar ${escapeHtml(formatRoom(p))}</span>
    </button>
  `).join("");

  refs.pilgrimList.querySelectorAll(".pilgrim-item").forEach((button) => {
    button.addEventListener("click", () => selectPilgrim(button.dataset.id));
  });
}

function getFilteredPilgrims() {
  const kloter = refs.kloterFilter.value;
  const term = refs.searchInput.value.trim().toLowerCase();

  return pilgrims.filter((p) => {
    if (kloter && p.kloter !== kloter) return false;
    if (!term) return true;
    const haystack = [
      p.name,
      p.noPorsi,
      p.kloter,
      p.rombongan,
      p.regu,
      p.kabKota,
      p.accommodation?.hotel,
      p.accommodation?.floor,
      p.accommodation?.room
    ].join(" ").toLowerCase();
    return haystack.includes(term);
  });
}

function selectPilgrim(id) {
  selectedPilgrimId = id;
  selectedPilgrim = pilgrims.find((p) => p.id === id) || null;
  renderPilgrims();
  renderDetail();
}

function renderDetail() {
  if (!selectedPilgrim) {
    refs.emptyState.classList.remove("hidden");
    refs.pilgrimDetail.classList.add("hidden");
    return;
  }

  const p = selectedPilgrim;
  refs.emptyState.classList.add("hidden");
  refs.pilgrimDetail.classList.remove("hidden");
  refs.detailKloter.textContent = `${p.kloterLabel} · ${p.role}`;
  refs.detailName.textContent = p.name;
  refs.detailMeta.textContent = `Porsi ${p.noPorsi} · ${p.kabKota} · Rombongan ${p.rombongan} / Regu ${p.regu}`;

  const a = p.accommodation || {};
  refs.detailAccommodation.innerHTML = [
    ["Hotel", a.hotel],
    ["Lantai", a.floor],
    ["Kamar", a.room],
    ["Bed", a.bed]
  ].map(([label, value]) => `
    <div class="info-box">
      <span>${label}</span>
      <strong>${escapeHtml(value || "-")}</strong>
    </div>
  `).join("");
}

function renderRooms() {
  const kloter = refs.kloterFilter.value;
  const filteredRooms = rooms.filter((room) => !kloter || room.kloter === kloter);
  refs.roomSelect.innerHTML = '<option value="">Pilih kamar</option>' + filteredRooms.map((room) => `
    <option value="${escapeAttr(room.id)}">${escapeHtml(`Kloter ${room.kloter} · ${room.hotel} · Lt ${room.floor} · Kamar ${room.room} · ${room.pilgrims.length} jemaah`)}</option>
  `).join("");
}

async function handleHandoverSubmit(event) {
  event.preventDefault();
  if (!selectedPilgrim) return showToast("Pilih jemaah terlebih dahulu.", "error");

  const payload = {
    pilgrimId: selectedPilgrim.id,
    noPorsi: selectedPilgrim.noPorsi,
    pilgrimName: selectedPilgrim.name,
    kloter: selectedPilgrim.kloter,
    type: refs.handoverType.value,
    status: "received",
    note: refs.handoverNote.value.trim(),
    officerName: getOfficerName(),
    accommodation: selectedPilgrim.accommodation,
    source: "web"
  };

  await submitWithPhoto(refs.handoverForm, refs.handoverPhoto.files[0], payload, CONFIG.COLLECTIONS?.HANDOVER || "handover_records", HANDOVER_LABELS[payload.type]);
  refs.handoverForm.reset();
}

async function handleRoomSubmit(event) {
  event.preventDefault();
  const room = rooms.find((item) => item.id === refs.roomSelect.value);
  if (!room) return showToast("Pilih kamar terlebih dahulu.", "error");

  const payload = {
    roomId: room.id,
    kloter: room.kloter,
    hotel: room.hotel,
    floor: room.floor,
    room: room.room,
    pilgrims: room.pilgrims,
    status: "documented",
    note: refs.roomNote.value.trim(),
    officerName: getOfficerName(),
    source: "web"
  };

  await submitWithPhoto(refs.roomForm, refs.roomPhoto.files[0], payload, CONFIG.COLLECTIONS?.ROOM_DELIVERIES || "room_deliveries", "Distribusi Kamar");
  refs.roomForm.reset();
  renderRooms();
}

async function handleLostSubmit(event) {
  event.preventDefault();
  const payload = {
    title: refs.lostTitle.value.trim(),
    status: refs.lostStatus.value,
    note: refs.lostNote.value.trim(),
    officerName: getOfficerName(),
    source: "web"
  };

  await submitWithPhoto(refs.lostForm, refs.lostPhoto.files[0], payload, CONFIG.COLLECTIONS?.LOST_FOUND || "lost_found", "Lost and Found");
  refs.lostForm.reset();
}

async function handleGallerySubmit(event) {
  event.preventDefault();
  const payload = {
    category: refs.galleryCategory.value,
    note: refs.galleryNote.value.trim(),
    officerName: getOfficerName(),
    source: "web"
  };

  await submitWithPhoto(refs.galleryForm, refs.galleryPhoto.files[0], payload, CONFIG.COLLECTIONS?.GALLERY || "gallery_photos", "Galeri");
  refs.galleryForm.reset();
}

async function submitWithPhoto(form, file, payload, collectionName, label) {
  if (!file) return showToast("Foto wajib diisi.", "error");
  const button = form.querySelector("button[type='submit']");
  setBusy(button, true);

  try {
    const photo = await uploadPhoto(file, payload, collectionName);
    const record = {
      ...payload,
      photoUrl: photo?.secure_url || "",
      photoPublicId: photo?.public_id || "",
      photoStatus: photo ? "uploaded" : "local_only",
      createdAt: new Date().toISOString()
    };

    await saveRecord(collectionName, record);
    addLocalActivity({
      label,
      title: payload.pilgrimName || payload.title || payload.roomId || payload.category,
      subtitle: `${payload.officerName} · ${new Date(record.createdAt).toLocaleString("id-ID")}`,
      collectionName
    });
    showToast(`${label} tersimpan.`);
  } catch (err) {
    console.error(err);
    showToast(err.message || "Gagal menyimpan data.", "error");
  } finally {
    setBusy(button, false);
  }
}

async function uploadPhoto(file, payload, collectionName) {
  if (!cloudReady) return null;
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", CONFIG.CLOUDINARY.UPLOAD_PRESET);
  form.append("folder", CONFIG.CLOUDINARY.FOLDER || "asramahaji-gorontalo-2026");
  form.append("tags", ["asramahaji", "gorontalo2026", collectionName, payload.kloter || ""].filter(Boolean).join(","));
  form.append("context", Object.entries({
    collection: collectionName,
    kloter: payload.kloter || "",
    pilgrim_id: payload.pilgrimId || "",
    officer: payload.officerName || ""
  }).map(([key, value]) => `${key}=${String(value).replace(/[|=]/g, " ")}`).join("|"));

  const endpoint = `https://api.cloudinary.com/v1_1/${CONFIG.CLOUDINARY.CLOUD_NAME}/image/upload`;
  const res = await fetch(endpoint, { method: "POST", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error?.message || "Upload Cloudinary gagal.");
  return body;
}

async function saveRecord(collectionName, record) {
  if (!db) {
    cachePendingRecord(collectionName, record);
    return;
  }

  await addDoc(collection(db, collectionName), {
    ...record,
    createdAtServer: serverTimestamp()
  });
}

async function loadRecentActivities() {
  recentActivities = getLocalActivities();
  if (db) {
    try {
      const snap = await getDocs(query(collection(db, CONFIG.COLLECTIONS?.HANDOVER || "handover_records"), orderBy("createdAtServer", "desc"), limit(8)));
      const rows = snap.docs.map((doc) => doc.data()).map((row) => ({
        label: HANDOVER_LABELS[row.type] || row.type || "Serah Terima",
        title: row.pilgrimName || row.noPorsi || "Record",
        subtitle: `${row.officerName || "Petugas"} · ${row.createdAt || ""}`,
        collectionName: CONFIG.COLLECTIONS?.HANDOVER || "handover_records"
      }));
      recentActivities = [...rows, ...recentActivities].slice(0, 12);
    } catch (err) {
      console.warn(err);
    }
  }
  renderActivities();
}

function renderActivities() {
  refs.activityList.innerHTML = recentActivities.length ? recentActivities.map((item) => `
    <div class="activity-item">
      <strong>${escapeHtml(item.label)} · ${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.subtitle || item.collectionName || "")}</span>
    </div>
  `).join("") : '<div class="empty-state">Belum ada aktivitas pada perangkat ini.</div>';
}

function addLocalActivity(item) {
  recentActivities = [item, ...recentActivities].slice(0, 12);
  localStorage.setItem(LOCAL_ACTIVITY_KEY, JSON.stringify(recentActivities));
  renderActivities();
}

function getLocalActivities() {
  return JSON.parse(localStorage.getItem(LOCAL_ACTIVITY_KEY) || "[]");
}

function cachePendingRecord(collectionName, record) {
  const key = `pending_${collectionName}`;
  const rows = JSON.parse(localStorage.getItem(key) || "[]");
  rows.unshift(record);
  localStorage.setItem(key, JSON.stringify(rows.slice(0, 200)));
}

function getOfficerName() {
  return refs.officerName.value.trim() || "Petugas";
}

function setBusy(button, busy) {
  if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? "Menyimpan..." : button.dataset.originalText;
}

function isFirebaseConfigured() {
  const config = CONFIG.FIREBASE_CONFIG || {};
  return Boolean(config.apiKey && config.projectId && config.apiKey !== "YOUR_API_KEY");
}

function isCloudinaryConfigured() {
  const cloud = CONFIG.CLOUDINARY || {};
  return Boolean(cloud.CLOUD_NAME && cloud.UPLOAD_PRESET && cloud.CLOUD_NAME !== "YOUR_CLOUD_NAME");
}

function formatRoom(pilgrim) {
  const a = pilgrim.accommodation || {};
  return `${a.hotel || "-"} Lt ${a.floor || "-"} / ${a.room || "-"}`;
}

function showToast(message, type = "success") {
  refs.toast.textContent = message;
  refs.toast.className = `toast ${type === "error" ? "error" : ""}`;
  refs.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => refs.toast.classList.add("hidden"), 3200);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
