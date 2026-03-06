import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 4000;

const DATA_FOLDER = "./data";
const DATA_PATH = path.join(DATA_FOLDER, "credentials.json");

if (!fs.existsSync(DATA_FOLDER)) {
  fs.mkdirSync(DATA_FOLDER, { recursive: true });
}

function initializeData() {
  if (!fs.existsSync(DATA_PATH)) {
    const defaultData = {
      users: [],
      drivers: [],
      routes: [],
      vehicles: []
    };

    fs.writeFileSync(DATA_PATH, JSON.stringify(defaultData, null, 2));
  }
}

initializeData();

function readData() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

app.use(cors());
app.use(express.json());

/* ================= HEALTH ================= */

app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "API running"
  });
});

app.get("/ping", (req, res) => {
  res.json({ ok: true, pong: true });
});

/* ================= ROUTES ================= */

app.get("/routes", (req, res) => {
  const data = readData();
  res.json(data.routes || []);
});

app.post("/routes", (req, res) => {
  const data = readData();
  data.routes.push(req.body);
  writeData(data);
  res.json({ ok: true });
});

/* ================= DRIVERS ================= */

app.get("/drivers", (req, res) => {
  const data = readData();
  res.json(data.drivers || []);
});

app.post("/drivers", (req, res) => {
  const data = readData();

  if (!data.drivers) data.drivers = [];

  const exists = data.drivers.find(
    d => d.name === req.body.name
  );

  if (exists) {
    return res.json({
      ok: false,
      error: "Driver already exists"
    });
  }

  data.drivers.push(req.body);
  writeData(data);

  res.json({ ok: true });
});

/* ================= VEHICLES ================= */

app.get("/vehicles", (req, res) => {
  const data = readData();
  res.json(data.vehicles || []);
});

app.post("/vehicles", (req, res) => {
  const data = readData();
  data.vehicles.push(req.body);
  writeData(data);
  res.json({ ok: true });
});

/* ================= SAVE ALL ================= */

app.post("/drivers/saveAll", (req, res) => {
  const data = readData();
  data.drivers = req.body.data;
  writeData(data);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});