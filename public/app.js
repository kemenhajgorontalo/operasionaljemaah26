const CONFIG = window.APP_CONFIG || {};
const LOCAL_ACTIVITY_KEY = "asramahaji_activity_cache";
const HANDOVER_LABELS = {
  living_cost: "Living Cost",
  accommodation_card: "Kartu Akomodasi",
  bracelet: "Gelang",
  luggage: "Koper"
};
const GALLERY_CATEGORY_LABELS = {
  general: "Umum",
  living_cost: "Living Cost",
  accommodation: "Kartu Akomodasi",
  accommodation_card: "Kartu Akomodasi",
  bracelet: "Gelang",
  luggage: "Koper",
  room_delivery: "Distribusi Kamar"
};
const PHOTO_PAGE_SIZE = 12;
const REPORT_PAGE_SIZE = 14;

let db = null;
let firebaseApi = null;
let cloudReady = false;
let pilgrims = [];
let rooms = [];
let selectedPilgrim = null;
let selectedPilgrimId = "";
let recentActivities = [];
let cameraStream = null;
let activeCaptureTarget = "";
let availableCameras = [];
let currentCameraDeviceId = "";
let currentView = "operations";
let allRecords = {
  handover: [],
  rooms: [],
  lost: [],
  gallery: []
};
let photoCurrentPage = 1;
let reportCurrentPage = 1;
let filteredPhotoRows = [];
let filteredReportRows = [];
const capturedPhotos = {
  handover: null,
  room: null,
  lost: null,
  gallery: null
};

const refs = {
  operationsPage: document.getElementById("operations-page"),
  galleryPage: document.getElementById("gallery-page"),
  tabOperations: document.getElementById("tab-operations"),
  tabGallery: document.getElementById("tab-gallery"),
  officerName: document.getElementById("officer-name"),
  kloterFilter: document.getElementById("kloter-filter"),
  searchInput: document.getElementById("search-input"),
  loadingState: document.getElementById("loading-state"),
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
  handoverPreview: document.getElementById("handover-preview"),
  handoverNote: document.getElementById("handover-note"),
  roomForm: document.getElementById("room-form"),
  roomSelect: document.getElementById("room-select"),
  roomPreview: document.getElementById("room-preview"),
  roomNote: document.getElementById("room-note"),
  lostForm: document.getElementById("lost-form"),
  lostTitle: document.getElementById("lost-title"),
  lostStatus: document.getElementById("lost-status"),
  lostPreview: document.getElementById("lost-preview"),
  lostNote: document.getElementById("lost-note"),
  galleryForm: document.getElementById("gallery-form"),
  galleryCategory: document.getElementById("gallery-category"),
  galleryPreview: document.getElementById("gallery-preview"),
  galleryNote: document.getElementById("gallery-note"),
  activityList: document.getElementById("activity-list"),
  clearLocal: document.getElementById("clear-local"),
  gallerySyncStatus: document.getElementById("gallery-sync-status"),
  refreshGallery: document.getElementById("refresh-gallery"),
  gallerySearch: document.getElementById("gallery-search"),
  gallerySourceFilter: document.getElementById("gallery-source-filter"),
  galleryServiceFilter: document.getElementById("gallery-service-filter"),
  galleryKloterFilter: document.getElementById("gallery-kloter-filter"),
  reportStatusFilter: document.getElementById("report-status-filter"),
  reportSummary: document.getElementById("report-summary"),
  photoCount: document.getElementById("photo-count"),
  photoGallery: document.getElementById("photo-gallery"),
  photoPrev: document.getElementById("photo-prev"),
  photoNext: document.getElementById("photo-next"),
  photoPageInfo: document.getElementById("photo-page-info"),
  reportCount: document.getElementById("report-count"),
  serviceReport: document.getElementById("service-report"),
  reportPrev: document.getElementById("report-prev"),
  reportNext: document.getElementById("report-next"),
  reportPageInfo: document.getElementById("report-page-info"),
  toast: document.getElementById("toast"),
  cameraModal: document.getElementById("camera-modal"),
  cameraTitle: document.getElementById("camera-title"),
  cameraVideo: document.getElementById("camera-video"),
  cameraWatermarkPreview: document.getElementById("camera-watermark-preview"),
  cameraCanvas: document.getElementById("camera-canvas"),
  cameraClose: document.getElementById("camera-close"),
  cameraCancel: document.getElementById("camera-cancel"),
  cameraSwitch: document.getElementById("camera-switch"),
  cameraShot: document.getElementById("camera-shot")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  setLoading(true, "Memuat data jemaah", "Menyiapkan Kloter 28, Kloter 30, dan data kamar.");
  refs.officerName.value = localStorage.getItem("asramahaji_officer_name") || "";
  refs.officerName.addEventListener("input", () => {
    localStorage.setItem("asramahaji_officer_name", refs.officerName.value.trim());
  });

  try {
    await loadSeedData();
    await initFirebase();
    cloudReady = isCloudinaryConfigured();
    bindEvents();
    renderSummary();
    renderRooms();
    renderPilgrims();
    await loadOperationalRecords();
    renderGalleryPage();
    await loadRecentActivities();
  } catch (err) {
    console.error(err);
    refs.pilgrimList.innerHTML = '<div class="empty-state">Data jemaah gagal dimuat. Periksa koneksi lalu muat ulang halaman.</div>';
    showToast("Data jemaah gagal dimuat.", "error");
  } finally {
    setLoading(false);
  }
}

async function loadSeedData() {
  const [pilgrimsRes, roomsRes] = await Promise.all([
    fetch("data/pilgrims.json"),
    fetch("data/rooms.json")
  ]);
  pilgrims = await pilgrimsRes.json();
  rooms = await roomsRes.json();
}

async function initFirebase() {
  if (!isFirebaseConfigured()) return;

  try {
    const [{ initializeApp }, firestore] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js")
    ]);
    firebaseApi = firestore;
    const app = initializeApp(CONFIG.FIREBASE_CONFIG);
    db = firestore.getFirestore(app);
  } catch (err) {
    console.warn("Firebase tidak dapat dimuat. Aplikasi berjalan dalam mode lokal.", err);
    db = null;
    firebaseApi = null;
  }
}

function bindEvents() {
  refs.tabOperations.addEventListener("click", () => setView("operations"));
  refs.tabGallery.addEventListener("click", () => setView("gallery"));
  refs.kloterFilter.addEventListener("change", () => {
    renderPilgrims();
    renderRooms();
    renderGalleryPage();
  });
  refs.searchInput.addEventListener("input", renderPilgrims);
  refs.handoverType.addEventListener("change", () => clearCapturedPhoto("handover"));
  refs.roomSelect.addEventListener("change", () => clearCapturedPhoto("room"));
  refs.lostStatus.addEventListener("change", () => clearCapturedPhoto("lost"));
  refs.galleryCategory.addEventListener("change", () => clearCapturedPhoto("gallery"));
  refs.handoverForm.addEventListener("submit", handleHandoverSubmit);
  refs.roomForm.addEventListener("submit", handleRoomSubmit);
  refs.lostForm.addEventListener("submit", handleLostSubmit);
  refs.galleryForm.addEventListener("submit", handleGallerySubmit);
  document.querySelectorAll("[data-camera-target]").forEach((button) => {
    button.addEventListener("click", () => openCamera(button.dataset.cameraTarget));
  });
  refs.cameraClose.addEventListener("click", closeCamera);
  refs.cameraCancel.addEventListener("click", closeCamera);
  refs.cameraSwitch.addEventListener("click", switchCamera);
  refs.cameraShot.addEventListener("click", captureActivePhoto);
  refs.cameraModal.addEventListener("click", (event) => {
    if (event.target === refs.cameraModal) closeCamera();
  });
  refs.refreshGallery.addEventListener("click", async () => {
    await loadOperationalRecords(true);
    renderGalleryPage();
  });
  [
    refs.gallerySearch,
    refs.gallerySourceFilter,
    refs.galleryServiceFilter,
    refs.galleryKloterFilter,
    refs.reportStatusFilter
  ].forEach((input) => {
    input.addEventListener("input", () => {
      photoCurrentPage = 1;
      reportCurrentPage = 1;
      renderGalleryPage();
    });
    input.addEventListener("change", () => {
      photoCurrentPage = 1;
      reportCurrentPage = 1;
      renderGalleryPage();
    });
  });
  refs.photoPrev.addEventListener("click", () => {
    photoCurrentPage = Math.max(1, photoCurrentPage - 1);
    renderPhotoGallery();
  });
  refs.photoNext.addEventListener("click", () => {
    photoCurrentPage += 1;
    renderPhotoGallery();
  });
  refs.reportPrev.addEventListener("click", () => {
    reportCurrentPage = Math.max(1, reportCurrentPage - 1);
    renderServiceReport();
  });
  refs.reportNext.addEventListener("click", () => {
    reportCurrentPage += 1;
    renderServiceReport();
  });
  refs.clearLocal.addEventListener("click", () => {
    localStorage.removeItem(LOCAL_ACTIVITY_KEY);
    recentActivities = [];
    renderActivities();
    showToast("Cache aktivitas lokal dibersihkan.");
  });
}

function setView(view) {
  currentView = view;
  refs.operationsPage.classList.toggle("hidden", view !== "operations");
  refs.galleryPage.classList.toggle("hidden", view !== "gallery");
  refs.tabOperations.classList.toggle("active", view === "operations");
  refs.tabGallery.classList.toggle("active", view === "gallery");
  if (view === "gallery") {
    renderGalleryPage();
  }
}

function renderSummary() {
  const kloter28 = pilgrims.filter((p) => p.kloter === "28").length;
  const kloter30 = pilgrims.filter((p) => p.kloter === "30").length;
  const roomCount = rooms.length;

  refs.summary.innerHTML = [
    ["Total Jemaah", pilgrims.length],
    ["Kloter 28", kloter28],
    ["Kloter 30", kloter30],
    ["Kamar", roomCount]
  ].map(([label, value]) => `
    <div class="summary-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");
}

function renderPilgrims() {
  const filtered = getFilteredPilgrims().slice(0, 80);
  refs.resultCount.textContent = `${filtered.length} tampil dari ${getFilteredPilgrims().length}`;

  refs.pilgrimList.innerHTML = filtered.map((p) => `
    <button class="pilgrim-item ${p.id === selectedPilgrimId ? "active" : ""}" type="button" data-id="${escapeAttr(p.id)}">
      <span class="pilgrim-badge">${escapeHtml(p.kloter)}</span>
      <span class="pilgrim-item-text">
        <strong>${escapeHtml(p.name)}</strong>
        <span>Porsi ${escapeHtml(p.noPorsi)} · ${escapeHtml(p.kabKota || "-")}</span>
        <span>${escapeHtml(formatRoom(p))} · Rombongan ${escapeHtml(p.rombongan)} / Regu ${escapeHtml(p.regu)}</span>
      </span>
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
    room: formatRoom(selectedPilgrim),
    note: refs.handoverNote.value.trim(),
    officerName: getOfficerName(),
    source: "web"
  };

  const saved = await submitWithPhoto(refs.handoverForm, capturedPhotos.handover, payload, CONFIG.COLLECTIONS?.HANDOVER || "handover_records", HANDOVER_LABELS[payload.type]);
  if (!saved) return;
  refs.handoverForm.reset();
  clearCapturedPhoto("handover");
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
    pilgrimCount: room.pilgrims.length,
    note: refs.roomNote.value.trim(),
    officerName: getOfficerName(),
    source: "web"
  };

  const saved = await submitWithPhoto(refs.roomForm, capturedPhotos.room, payload, CONFIG.COLLECTIONS?.ROOM_DELIVERIES || "room_deliveries", "Distribusi Kamar");
  if (!saved) return;
  refs.roomForm.reset();
  clearCapturedPhoto("room");
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

  const saved = await submitWithPhoto(refs.lostForm, capturedPhotos.lost, payload, CONFIG.COLLECTIONS?.LOST_FOUND || "lost_found", "Lost and Found");
  if (!saved) return;
  refs.lostForm.reset();
  clearCapturedPhoto("lost");
}

async function handleGallerySubmit(event) {
  event.preventDefault();
  const payload = {
    category: refs.galleryCategory.value,
    note: refs.galleryNote.value.trim(),
    officerName: getOfficerName(),
    source: "web"
  };

  const saved = await submitWithPhoto(refs.galleryForm, capturedPhotos.gallery, payload, CONFIG.COLLECTIONS?.GALLERY || "gallery_photos", "Galeri");
  if (!saved) return;
  refs.galleryForm.reset();
  clearCapturedPhoto("gallery");
}

async function submitWithPhoto(form, photo, payload, collectionName, label) {
  if (!photo?.blob) {
    showToast("Foto wajib diambil dari kamera.", "error");
    return false;
  }
  const button = form.querySelector("button[type='submit']");
  setBusy(button, true);

  try {
    const uploadedPhoto = await uploadPhoto(photo.blob, payload, collectionName);
    const record = {
      ...payload,
      photoUrl: uploadedPhoto?.secure_url || "",
      photoPublicId: uploadedPhoto?.public_id || "",
      photoStatus: uploadedPhoto ? "uploaded" : "local_only",
      watermark: photo.watermark,
      createdAt: new Date().toISOString()
    };
    const localRecord = {
      ...record,
      localPhotoDataUrl: uploadedPhoto ? "" : photo.dataUrl
    };

    await saveRecord(collectionName, record, localRecord);
    addRecordToMemory(collectionName, localRecord);
    addLocalActivity({
      label,
      title: payload.pilgrimName || payload.title || payload.roomId || payload.category,
      subtitle: `${payload.officerName} · ${new Date(record.createdAt).toLocaleString("id-ID")}`,
      collectionName
    });
    showToast(uploadedPhoto ? `${label} tersimpan.` : `${label} tersimpan lokal. Cloudinary belum aktif.`);
    renderGalleryPage();
    return true;
  } catch (err) {
    console.error(err);
    showToast(err.message || "Gagal menyimpan data.", "error");
    return false;
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

async function openCamera(target) {
  activeCaptureTarget = target;
  refs.cameraTitle.textContent = getCaptureTitle(target);
  renderCameraWatermarkPreview(buildWatermarkPayload(target));
  refs.cameraModal.classList.remove("hidden");
  refs.cameraModal.setAttribute("aria-hidden", "false");
  refs.cameraSwitch.classList.add("hidden");

  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Browser belum mendukung kamera langsung.");
    }
    await startPreferredCamera();
  } catch (err) {
    console.error(err);
    closeCamera();
    showToast(err.message || "Kamera tidak dapat dibuka. Pastikan izin kamera aktif.", "error");
  }
}

async function startPreferredCamera() {
  await startCameraWithConstraints({
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1600 },
      height: { ideal: 1200 }
    },
    audio: false
  });
  await refreshCameraDevices();

  const track = cameraStream?.getVideoTracks()[0];
  const rearDevice = findRearCamera();
  if (rearDevice && isFrontCameraTrack(track) && rearDevice.deviceId !== currentCameraDeviceId) {
    await startCameraDevice(rearDevice.deviceId);
  }

  updateCameraSwitchVisibility();
  const activeTrack = cameraStream?.getVideoTracks()[0];
  if (!findRearCamera() && isFrontCameraTrack(activeTrack)) {
    showToast("Kamera belakang tidak terdeteksi. Menggunakan kamera yang tersedia.", "error");
  }
}

async function startCameraWithConstraints(constraints) {
  stopCameraStream();
  cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
  refs.cameraVideo.srcObject = cameraStream;
  await waitForVideoReady();
  currentCameraDeviceId = cameraStream.getVideoTracks()[0]?.getSettings().deviceId || "";
  if (activeCaptureTarget) {
    renderCameraWatermarkPreview(buildWatermarkPayload(activeCaptureTarget));
  }
}

async function startCameraDevice(deviceId) {
  await startCameraWithConstraints({
    video: {
      deviceId: { exact: deviceId },
      width: { ideal: 1600 },
      height: { ideal: 1200 }
    },
    audio: false
  });
}

async function refreshCameraDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const devices = await navigator.mediaDevices.enumerateDevices();
  availableCameras = devices.filter((device) => device.kind === "videoinput");
}

async function switchCamera() {
  if (availableCameras.length < 2) return;
  const currentIndex = availableCameras.findIndex((device) => device.deviceId === currentCameraDeviceId);
  const nextCamera = availableCameras[(currentIndex + 1 + availableCameras.length) % availableCameras.length];
  if (!nextCamera) return;

  try {
    await startCameraDevice(nextCamera.deviceId);
    updateCameraSwitchVisibility();
  } catch (err) {
    console.error(err);
    showToast("Gagal mengganti kamera.", "error");
  }
}

function updateCameraSwitchVisibility() {
  refs.cameraSwitch.classList.toggle("hidden", availableCameras.length < 2);
}

function findRearCamera() {
  return availableCameras.find((device) => {
    const label = device.label.toLowerCase();
    return /back|rear|environment|belakang|wide|ultra/.test(label);
  });
}

function isFrontCameraTrack(track) {
  if (!track) return false;
  const settings = track.getSettings?.() || {};
  const label = track.label.toLowerCase();
  return settings.facingMode === "user" || /front|depan|selfie/.test(label);
}

function closeCamera() {
  stopCameraStream();
  refs.cameraVideo.removeAttribute("srcObject");
  refs.cameraVideo.srcObject = null;
  refs.cameraWatermarkPreview.innerHTML = "";
  refs.cameraSwitch.classList.add("hidden");
  refs.cameraModal.classList.add("hidden");
  refs.cameraModal.setAttribute("aria-hidden", "true");
}

function stopCameraStream() {
  if (!cameraStream) return;
  cameraStream.getTracks().forEach((track) => track.stop());
  cameraStream = null;
}

async function captureActivePhoto() {
  if (!activeCaptureTarget || !refs.cameraVideo.videoWidth) {
    showToast("Kamera belum siap.", "error");
    return;
  }

  const payload = buildWatermarkPayload(activeCaptureTarget);
  const photo = await createWatermarkedPhoto(payload);
  capturedPhotos[activeCaptureTarget] = photo;
  renderCapturePreview(activeCaptureTarget, photo.dataUrl);
  closeCamera();
  showToast("Foto berhasil diambil.");
}

function waitForVideoReady() {
  if (refs.cameraVideo.readyState >= 2 && refs.cameraVideo.videoWidth) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Kamera belum siap."));
    }, 7000);

    function cleanup() {
      clearTimeout(timeout);
      refs.cameraVideo.removeEventListener("loadedmetadata", onReady);
      refs.cameraVideo.removeEventListener("canplay", onReady);
    }

    function onReady() {
      if (refs.cameraVideo.videoWidth) {
        cleanup();
        resolve();
      }
    }

    refs.cameraVideo.addEventListener("loadedmetadata", onReady);
    refs.cameraVideo.addEventListener("canplay", onReady);
  });
}

async function createWatermarkedPhoto(payload) {
  const video = refs.cameraVideo;
  const canvas = refs.cameraCanvas;
  const ctx = canvas.getContext("2d");
  if (document.fonts?.ready) {
    await document.fonts.ready.catch(() => {});
  }
  const maxWidth = 1600;
  const scale = Math.min(1, maxWidth / video.videoWidth);
  canvas.width = Math.round(video.videoWidth * scale);
  canvas.height = Math.round(video.videoHeight * scale);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  drawWatermark(ctx, canvas, payload);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88)) || dataUrlToBlob(dataUrl);
  return {
    blob,
    dataUrl,
    watermark: payload
  };
}

function drawWatermark(ctx, canvas, payload) {
  const w = canvas.width;
  const h = canvas.height;
  const pad = Math.max(18, Math.round(w * 0.024));
  const titleSize = Math.max(22, Math.round(w * 0.03));
  const textSize = Math.max(17, Math.round(w * 0.021));
  const lineGap = Math.round(textSize * 1.35);
  const maxTextWidth = w - pad * 2;
  const title = payload.title || "Operasional Jemaah Gorontalo 2026";
  const detailRows = buildWatermarkLines(payload);
  const lines = detailRows.flatMap((line) => wrapCanvasText(ctx, line, maxTextWidth, `500 ${textSize}px Poppins, Arial, sans-serif`)).slice(0, 6);
  const boxHeight = pad * 2 + titleSize + lineGap * Math.max(1, lines.length);
  const y = h - boxHeight;

  const gradient = ctx.createLinearGradient(0, y, 0, h);
  gradient.addColorStop(0, "rgba(0,0,0,0.18)");
  gradient.addColorStop(0.32, "rgba(0,0,0,0.68)");
  gradient.addColorStop(1, "rgba(0,0,0,0.86)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, y, w, boxHeight);

  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.font = `700 ${titleSize}px Poppins, Arial, sans-serif`;
  ctx.fillText(trimCanvasText(ctx, title, maxTextWidth), pad, y + pad + titleSize);

  ctx.font = `500 ${textSize}px Poppins, Arial, sans-serif`;
  lines.forEach((line, index) => {
    ctx.fillText(line, pad, y + pad + titleSize + lineGap * (index + 1));
  });

  ctx.fillStyle = "#c69837";
  ctx.fillRect(pad, y + pad - 8, Math.min(210, w * 0.18), 5);
}

function buildWatermarkLines(payload) {
  return [
    payload.subject,
    payload.location,
    `Petugas: ${payload.officerName}`,
    `Waktu: ${payload.timestampDisplay}`
  ].filter(Boolean);
}

function renderCameraWatermarkPreview(payload) {
  const title = payload.title || "Operasional Jemaah Gorontalo 2026";
  const lines = buildWatermarkLines(payload).slice(0, 6);
  refs.cameraWatermarkPreview.innerHTML = `
    <div class="watermark-accent"></div>
    <strong>${escapeHtml(title)}</strong>
    ${lines.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
  `;
}

function wrapCanvasText(ctx, text, maxWidth, font) {
  ctx.font = font;
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      line = testLine;
      return;
    }
    if (line) lines.push(line);
    line = trimCanvasText(ctx, word, maxWidth);
  });

  if (line) lines.push(line);
  return lines;
}

function trimCanvasText(ctx, text, maxWidth) {
  const value = String(text);
  if (ctx.measureText(value).width <= maxWidth) return value;
  let trimmed = value;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);/)?.[1] || "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function buildWatermarkPayload(target) {
  const now = new Date();
  const title = getCaptureTitle(target);
  const base = {
    title,
    officerName: getOfficerName(),
    timestamp: now.toISOString(),
    timestampDisplay: now.toLocaleString("id-ID", {
      dateStyle: "medium",
      timeStyle: "medium",
      timeZone: "Asia/Makassar"
    })
  };

  if (target === "handover" && selectedPilgrim) {
    return {
      ...base,
      subject: `${selectedPilgrim.name} · Porsi ${selectedPilgrim.noPorsi}`,
      location: `${selectedPilgrim.kloterLabel} · ${formatRoom(selectedPilgrim)}`
    };
  }

  if (target === "room") {
    const room = rooms.find((item) => item.id === refs.roomSelect.value);
    return {
      ...base,
      subject: room ? `Kloter ${room.kloter} · ${room.pilgrims.length} jemaah` : "Kamar belum dipilih",
      location: room ? `${room.hotel} · Lt ${room.floor} · Kamar ${room.room}` : ""
    };
  }

  if (target === "lost") {
    return {
      ...base,
      subject: refs.lostTitle.value.trim() || "Barang temuan",
      location: `Status: ${refs.lostStatus.options[refs.lostStatus.selectedIndex]?.text || refs.lostStatus.value}`
    };
  }

  return {
    ...base,
    subject: refs.galleryCategory.options[refs.galleryCategory.selectedIndex]?.text || "Galeri",
    location: "Dokumentasi kegiatan"
  };
}

function getCaptureTitle(target) {
  const titles = {
    handover: `Bukti ${HANDOVER_LABELS[refs.handoverType.value] || "Serah Terima"}`,
    room: "Distribusi Koper per Kamar",
    lost: "Lost and Found",
    gallery: "Galeri Foto"
  };
  return titles[target] || "Ambil Foto";
}

function renderCapturePreview(target, dataUrl) {
  const preview = refs[`${target}Preview`];
  if (!preview) return;
  preview.src = dataUrl;
  preview.classList.remove("hidden");
}

function clearCapturedPhoto(target) {
  capturedPhotos[target] = null;
  const preview = refs[`${target}Preview`];
  if (!preview) return;
  preview.removeAttribute("src");
  preview.classList.add("hidden");
}

async function saveRecord(collectionName, record, localRecord = record) {
  if (!db || record.photoStatus !== "uploaded") {
    cachePendingRecord(collectionName, localRecord);
    return;
  }

  await firebaseApi.addDoc(firebaseApi.collection(db, collectionName), {
    ...record,
    createdAtServer: firebaseApi.serverTimestamp()
  });
}

async function loadOperationalRecords(showFeedback = false) {
  if (showFeedback) refs.gallerySyncStatus.textContent = "Memuat data...";

  const collections = {
    handover: CONFIG.COLLECTIONS?.HANDOVER || "handover_records",
    rooms: CONFIG.COLLECTIONS?.ROOM_DELIVERIES || "room_deliveries",
    lost: CONFIG.COLLECTIONS?.LOST_FOUND || "lost_found",
    gallery: CONFIG.COLLECTIONS?.GALLERY || "gallery_photos"
  };

  const nextRecords = {
    handover: getPendingRecords(collections.handover),
    rooms: getPendingRecords(collections.rooms),
    lost: getPendingRecords(collections.lost),
    gallery: getPendingRecords(collections.gallery)
  };

  if (db) {
    await Promise.all(Object.entries(collections).map(async ([key, collectionName]) => {
      try {
        const snap = await firebaseApi.getDocs(firebaseApi.collection(db, collectionName));
        const rows = snap.docs.map((doc) => ({
          id: doc.id,
          collectionName,
          ...doc.data()
        }));
        nextRecords[key] = [...rows, ...nextRecords[key]];
      } catch (err) {
        console.warn(`Gagal memuat ${collectionName}.`, err);
      }
    }));
  }

  allRecords = nextRecords;
  refs.gallerySyncStatus.textContent = db ? "Data Firebase dan cache lokal" : "Mode lokal dari cache perangkat";
}

function addRecordToMemory(collectionName, record) {
  const key = getRecordBucket(collectionName);
  if (!key) return;
  allRecords[key] = [{
    id: `local-${Date.now()}`,
    collectionName,
    ...record
  }, ...allRecords[key]];
}

function getRecordBucket(collectionName) {
  const collections = {
    handover: CONFIG.COLLECTIONS?.HANDOVER || "handover_records",
    rooms: CONFIG.COLLECTIONS?.ROOM_DELIVERIES || "room_deliveries",
    lost: CONFIG.COLLECTIONS?.LOST_FOUND || "lost_found",
    gallery: CONFIG.COLLECTIONS?.GALLERY || "gallery_photos"
  };
  return Object.entries(collections).find(([, value]) => value === collectionName)?.[0] || "";
}

function renderGalleryPage() {
  if (!refs.galleryPage) return;
  filteredPhotoRows = getFilteredPhotoRows();
  filteredReportRows = getFilteredReportRows();
  renderReportSummary();
  renderPhotoGallery();
  renderServiceReport();
}

function getFilteredPhotoRows() {
  const source = refs.gallerySourceFilter.value;
  const service = refs.galleryServiceFilter.value;
  const kloter = refs.galleryKloterFilter.value;
  const term = refs.gallerySearch.value.trim().toLowerCase();

  return buildPhotoRows().filter((row) => {
    if (source && row.collectionName !== source) return false;
    if (service && !matchesService(row.service, service)) return false;
    if (kloter && row.kloter !== kloter) return false;
    if (!term) return true;
    return row.searchText.includes(term);
  }).sort((a, b) => getRecordTime(b) - getRecordTime(a));
}

function buildPhotoRows() {
  const handover = allRecords.handover.map((row) => makePhotoRow(row, {
    collectionName: CONFIG.COLLECTIONS?.HANDOVER || "handover_records",
    sourceLabel: "Serah Terima",
    service: row.type,
    serviceLabel: HANDOVER_LABELS[row.type] || row.type,
    title: row.pilgrimName || row.noPorsi || "Jemaah",
    subtitle: [row.noPorsi, row.room].filter(Boolean).join(" · ")
  }));
  const roomRows = allRecords.rooms.map((row) => makePhotoRow(row, {
    collectionName: CONFIG.COLLECTIONS?.ROOM_DELIVERIES || "room_deliveries",
    sourceLabel: "Distribusi Kamar",
    service: "room_delivery",
    serviceLabel: "Distribusi Kamar",
    title: `Kamar ${row.room || "-"}`,
    subtitle: [`Kloter ${row.kloter || "-"}`, row.hotel, `Lt ${row.floor || "-"}`].filter(Boolean).join(" · ")
  }));
  const lost = allRecords.lost.map((row) => makePhotoRow(row, {
    collectionName: CONFIG.COLLECTIONS?.LOST_FOUND || "lost_found",
    sourceLabel: "Lost and Found",
    service: "lost_found",
    serviceLabel: getLostStatusLabel(row.status),
    title: row.title || "Barang",
    subtitle: row.note || ""
  }));
  const gallery = allRecords.gallery.map((row) => makePhotoRow(row, {
    collectionName: CONFIG.COLLECTIONS?.GALLERY || "gallery_photos",
    sourceLabel: "Galeri",
    service: row.category,
    serviceLabel: GALLERY_CATEGORY_LABELS[row.category] || row.category || "Galeri",
    title: GALLERY_CATEGORY_LABELS[row.category] || row.category || "Galeri",
    subtitle: row.note || ""
  }));

  return [...handover, ...roomRows, ...lost, ...gallery].filter((row) => row.photoUrl);
}

function makePhotoRow(row, meta) {
  const photoUrl = row.photoUrl || row.localPhotoDataUrl || "";
  const searchText = [
    meta.sourceLabel,
    meta.serviceLabel,
    meta.title,
    meta.subtitle,
    row.kloter,
    row.noPorsi,
    row.pilgrimName,
    row.room,
    row.hotel,
    row.officerName,
    row.note,
    row.createdAt
  ].join(" ").toLowerCase();

  return {
    ...row,
    ...meta,
    photoUrl,
    searchText
  };
}

function renderPhotoGallery() {
  const totalPages = Math.max(1, Math.ceil(filteredPhotoRows.length / PHOTO_PAGE_SIZE));
  photoCurrentPage = Math.min(totalPages, Math.max(1, photoCurrentPage));
  const start = (photoCurrentPage - 1) * PHOTO_PAGE_SIZE;
  const pageRows = filteredPhotoRows.slice(start, start + PHOTO_PAGE_SIZE);

  refs.photoCount.textContent = `${filteredPhotoRows.length} foto`;
  refs.photoGallery.innerHTML = pageRows.length ? pageRows.map((row) => `
    <article class="photo-card">
      <a href="${escapeAttr(row.photoUrl)}" target="_blank" rel="noreferrer">
        <img src="${escapeAttr(row.photoUrl)}" alt="${escapeAttr(row.title)}" loading="lazy">
      </a>
      <div>
        <strong>${escapeHtml(row.title)}</strong>
        <span>${escapeHtml(row.sourceLabel)} · ${escapeHtml(row.serviceLabel || "-")}</span>
        <span>${escapeHtml(row.subtitle || row.officerName || "-")}</span>
        <span>${escapeHtml(formatRecordDate(row))}</span>
      </div>
    </article>
  `).join("") : '<div class="empty-state">Belum ada foto sesuai filter.</div>';

  refs.photoPageInfo.textContent = `Halaman ${photoCurrentPage} dari ${totalPages}`;
  refs.photoPrev.disabled = photoCurrentPage <= 1;
  refs.photoNext.disabled = photoCurrentPage >= totalPages;
}

function getFilteredReportRows() {
  const service = refs.galleryServiceFilter.value;
  const kloter = refs.galleryKloterFilter.value;
  const status = refs.reportStatusFilter.value;
  const term = refs.gallerySearch.value.trim().toLowerCase();
  const rows = service === "room_delivery" ? buildRoomReportRows() : buildPilgrimReportRows(service);

  return rows.filter((row) => {
    if (kloter && row.kloter !== kloter) return false;
    if (status && row.status !== status) return false;
    if (!term) return true;
    return row.searchText.includes(term);
  });
}

function buildPilgrimReportRows(service) {
  const handoverByPilgrim = new Map();
  allRecords.handover.forEach((row) => {
    if (!row.pilgrimId || !row.type) return;
    if (!handoverByPilgrim.has(row.pilgrimId)) handoverByPilgrim.set(row.pilgrimId, new Set());
    handoverByPilgrim.get(row.pilgrimId).add(row.type);
  });

  return pilgrims.map((pilgrim) => {
    const services = handoverByPilgrim.get(pilgrim.id) || new Set();
    const served = service ? services.has(service) : services.size > 0;
    const progress = service
      ? (HANDOVER_LABELS[service] || service)
      : `${services.size}/4 layanan`;
    const roomText = formatRoom(pilgrim);
    return {
      id: pilgrim.id,
      type: "pilgrim",
      kloter: pilgrim.kloter,
      title: pilgrim.name,
      subtitle: `Porsi ${pilgrim.noPorsi} · ${roomText}`,
      status: served ? "served" : "unserved",
      statusLabel: served ? "Sudah Dilayani" : "Belum Dilayani",
      progress,
      searchText: [
        pilgrim.name,
        pilgrim.noPorsi,
        pilgrim.kloter,
        pilgrim.kabKota,
        pilgrim.rombongan,
        pilgrim.regu,
        roomText,
        progress
      ].join(" ").toLowerCase()
    };
  });
}

function buildRoomReportRows() {
  const documentedRooms = new Set(allRecords.rooms.map((row) => row.roomId).filter(Boolean));
  return rooms.map((room) => {
    const served = documentedRooms.has(room.id);
    return {
      id: room.id,
      type: "room",
      kloter: room.kloter,
      title: `Kamar ${room.room}`,
      subtitle: `Kloter ${room.kloter} · ${room.hotel} · Lt ${room.floor}`,
      status: served ? "served" : "unserved",
      statusLabel: served ? "Sudah Didokumentasikan" : "Belum Didokumentasikan",
      progress: `${room.pilgrims.length} jemaah`,
      searchText: [
        room.id,
        room.kloter,
        room.hotel,
        room.floor,
        room.room,
        room.pilgrims.map((p) => `${p.name} ${p.noPorsi}`).join(" ")
      ].join(" ").toLowerCase()
    };
  });
}

function renderServiceReport() {
  const totalPages = Math.max(1, Math.ceil(filteredReportRows.length / REPORT_PAGE_SIZE));
  reportCurrentPage = Math.min(totalPages, Math.max(1, reportCurrentPage));
  const start = (reportCurrentPage - 1) * REPORT_PAGE_SIZE;
  const pageRows = filteredReportRows.slice(start, start + REPORT_PAGE_SIZE);

  refs.reportCount.textContent = `${filteredReportRows.length} baris`;
  refs.serviceReport.innerHTML = pageRows.length ? pageRows.map((row) => `
    <article class="report-row ${row.status}">
      <div>
        <strong>${escapeHtml(row.title)}</strong>
        <span>${escapeHtml(row.subtitle)}</span>
      </div>
      <div class="report-row-meta">
        <span>${escapeHtml(row.progress)}</span>
        <b>${escapeHtml(row.statusLabel)}</b>
      </div>
    </article>
  `).join("") : '<div class="empty-state">Tidak ada report sesuai filter.</div>';

  refs.reportPageInfo.textContent = `Halaman ${reportCurrentPage} dari ${totalPages}`;
  refs.reportPrev.disabled = reportCurrentPage <= 1;
  refs.reportNext.disabled = reportCurrentPage >= totalPages;
}

function renderReportSummary() {
  const served = filteredReportRows.filter((row) => row.status === "served").length;
  const unserved = filteredReportRows.filter((row) => row.status === "unserved").length;
  const roomDocumented = new Set(allRecords.rooms.map((row) => row.roomId).filter(Boolean)).size;
  const photoCount = filteredPhotoRows.length;

  refs.reportSummary.innerHTML = [
    ["Foto Sesuai Filter", photoCount],
    ["Sudah Dilayani", served],
    ["Belum Dilayani", unserved],
    ["Kamar Terdokumentasi", roomDocumented]
  ].map(([label, value]) => `
    <div class="summary-card">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");
}

function matchesService(value, service) {
  if (!service) return true;
  if (service === "accommodation_card") return value === "accommodation_card" || value === "accommodation";
  return value === service;
}

function getRecordTime(row) {
  const value = row.createdAtServer?.toDate?.() || row.createdAt || row.timestamp || 0;
  return new Date(value).getTime() || 0;
}

function formatRecordDate(row) {
  const date = new Date(getRecordTime(row));
  if (Number.isNaN(date.getTime())) return row.createdAt || "";
  return date.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Makassar"
  });
}

async function loadRecentActivities() {
  recentActivities = getLocalActivities();
  if (db) {
    try {
      const handoverCollection = CONFIG.COLLECTIONS?.HANDOVER || "handover_records";
      const snap = await firebaseApi.getDocs(firebaseApi.query(
        firebaseApi.collection(db, handoverCollection),
        firebaseApi.orderBy("createdAtServer", "desc"),
        firebaseApi.limit(8)
      ));
      const rows = snap.docs.map((doc) => doc.data()).map((row) => ({
        label: HANDOVER_LABELS[row.type] || row.type || "Serah Terima",
        title: row.pilgrimName || row.noPorsi || "Record",
        subtitle: `${row.officerName || "Petugas"} · ${row.createdAt || ""}`,
        collectionName: handoverCollection
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

function getPendingRecords(collectionName) {
  const key = `pending_${collectionName}`;
  return JSON.parse(localStorage.getItem(key) || "[]").map((row, index) => ({
    id: `pending-${collectionName}-${index}`,
    collectionName,
    ...row
  }));
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

function getLostStatusLabel(status) {
  const labels = {
    found: "Ditemukan",
    claimed: "Sudah Diklaim",
    lost: "Hilang"
  };
  return labels[status] || status || "Lost and Found";
}

function getPilgrimPhotoPath(pilgrim) {
  return pilgrim.sourceAssets?.photo || "assets/logo-kementerian-haji-dan-umrah.png";
}

function setLoading(isLoading, title = "", subtitle = "") {
  if (!refs.loadingState) return;
  if (!isLoading) {
    refs.loadingState.classList.add("hidden");
    return;
  }
  refs.loadingState.classList.remove("hidden");
  const strong = refs.loadingState.querySelector("strong");
  const span = refs.loadingState.querySelector("span");
  if (strong) strong.textContent = title;
  if (span) span.textContent = subtitle;
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
