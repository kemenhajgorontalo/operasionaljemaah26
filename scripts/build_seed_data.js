const fs = require("fs");
const path = require("path");

const sourceRoot = process.argv[2] || path.resolve(__dirname, "../../datajemaahgorontalo2026");
const outputDir = path.resolve(__dirname, "../public/data");

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(sourceRoot, file), "utf8"));
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function assetExists(assetPath) {
  return Boolean(assetPath && fs.existsSync(path.join(sourceRoot, "public", assetPath)));
}

function mapPilgrim(person) {
  const accommodation = person.accommodation || {};
  const assets = person.assets || {};

  return {
    id: person.id,
    noPorsi: normalizeText(person.noPorsi),
    name: normalizeText(person.nama),
    searchName: normalizeText(person.nama).toLowerCase(),
    kloter: normalizeText(person.kloterCode),
    kloterLabel: normalizeText(person.kloterLabel),
    rombongan: normalizeText(person.rombongan),
    regu: normalizeText(person.reguKloter),
    role: normalizeText(person.statusJemaah),
    kabKota: normalizeText(person.kabKota),
    gender: normalizeText(person.jenisKelamin),
    age: normalizeText(person.umur),
    passportNo: normalizeText(person.noPaspor),
    visaNo: normalizeText(person.noVisa),
    phone: normalizeText(person.noHp),
    village: normalizeText(person.namaDesa),
    accommodation: {
      source: normalizeText(accommodation.source),
      locationType: normalizeText(accommodation.locationType),
      hotel: normalizeText(accommodation.namaHotel),
      floor: normalizeText(accommodation.lantai),
      room: normalizeText(accommodation.nomorKamar),
      bed: normalizeText(accommodation.posisiBed)
    },
    sourceAssets: {
      photo: assets.foto || "",
      cardPdf: assets.kartu || "",
      visaPdf: assets.visa || ""
    },
    sourceAssetStatus: {
      photo: assetExists(assets.foto),
      cardPdf: assetExists(assets.kartu),
      visaPdf: assetExists(assets.visa)
    }
  };
}

function roomKey(pilgrim) {
  const a = pilgrim.accommodation;
  return [pilgrim.kloter, a.hotel, a.floor, a.room].join("|");
}

const kloter28 = readJson("public/data/kloter-28.json").people.map(mapPilgrim);
const kloter30 = readJson("public/data/kloter-30.json").people.map(mapPilgrim);
const pilgrims = [...kloter28, ...kloter30].sort((a, b) => {
  if (a.kloter !== b.kloter) return a.kloter.localeCompare(b.kloter);
  return a.name.localeCompare(b.name);
});

const roomsByKey = new Map();
for (const pilgrim of pilgrims) {
  const a = pilgrim.accommodation;
  const key = roomKey(pilgrim);
  if (!roomsByKey.has(key)) {
    roomsByKey.set(key, {
      id: key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      kloter: pilgrim.kloter,
      hotel: a.hotel,
      floor: a.floor,
      room: a.room,
      pilgrims: []
    });
  }
  roomsByKey.get(key).pilgrims.push({
    id: pilgrim.id,
    noPorsi: pilgrim.noPorsi,
    name: pilgrim.name,
    bed: a.bed
  });
}

const rooms = [...roomsByKey.values()].sort((a, b) => {
  if (a.kloter !== b.kloter) return a.kloter.localeCompare(b.kloter);
  if (a.hotel !== b.hotel) return a.hotel.localeCompare(b.hotel);
  if (a.floor !== b.floor) return Number(a.floor) - Number(b.floor);
  return Number(a.room) - Number(b.room);
});

const summary = {
  generatedAt: new Date().toISOString(),
  sourceRepository: "kemenhajgorontalo/datajemaahgorontalo2026",
  sourceRoot,
  totalPilgrims: pilgrims.length,
  totalRooms: rooms.length,
  kloters: {
    "28": {
      pilgrims: kloter28.length,
      rooms: rooms.filter((room) => room.kloter === "28").length
    },
    "30": {
      pilgrims: kloter30.length,
      rooms: rooms.filter((room) => room.kloter === "30").length
    }
  },
  assetStatus: pilgrims.reduce((acc, pilgrim) => {
    for (const [key, available] of Object.entries(pilgrim.sourceAssetStatus)) {
      acc[key] ||= { available: 0, missing: 0 };
      acc[key][available ? "available" : "missing"] += 1;
    }
    return acc;
  }, {})
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, "pilgrims.json"), JSON.stringify(pilgrims, null, 2));
fs.writeFileSync(path.join(outputDir, "rooms.json"), JSON.stringify(rooms, null, 2));
fs.writeFileSync(path.join(outputDir, "seed-summary.json"), JSON.stringify(summary, null, 2));

console.log(JSON.stringify(summary, null, 2));
