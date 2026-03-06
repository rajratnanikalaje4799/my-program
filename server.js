const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// File where drivers will be stored
const DATA_FILE = path.join(__dirname, "drivers.json");

// Ensure file exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// Read drivers
function readDrivers() {
  const data = fs.readFileSync(DATA_FILE);
  return JSON.parse(data);
}

// Write drivers
function writeDrivers(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Test route
app.get("/ping", (req, res) => {
  res.json({ ok: true, pong: true });
});

// Get all drivers
app.get("/drivers", (req, res) => {
  const drivers = readDrivers();
  res.json(drivers);
});

// Save drivers
app.post("/drivers", (req, res) => {
  const drivers = req.body;

  if (!Array.isArray(drivers)) {
    return res.status(400).json({ error: "Drivers must be an array" });
  }

  writeDrivers(drivers);
  res.json({ success: true });
});

// Add single driver
app.post("/driver", (req, res) => {
  const newDriver = req.body;

  const drivers = readDrivers();

  drivers.push(newDriver);

  writeDrivers(drivers);

  res.json({ success: true });
});

// Start server (IMPORTANT FOR RENDER)
const PORT = process.env.PORT || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});