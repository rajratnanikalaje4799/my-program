import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

/* ---------------- PING ---------------- */

app.get("/ping", (req, res) => {
  res.json({ ok: true, pong: true });
});

/* ---------------- STORAGE ---------------- */

let drivers = [];
let routes = [];
let vehicles = [];
let breakdowns = [];
let logsheets = [];

/* ---------------- DRIVERS ---------------- */

app.get("/api/drivers", (req, res) => {
  res.json(drivers);
});

app.post("/api/drivers", (req, res) => {
  drivers.push(req.body);
  res.json({ ok: true });
});

app.put("/api/drivers/:id", (req, res) => {
  const id = req.params.id;
  drivers = drivers.map((d) => (d.id === id ? req.body : d));
  res.json({ ok: true });
});

app.delete("/api/drivers/:id", (req, res) => {
  const id = req.params.id;
  drivers = drivers.filter((d) => d.id !== id);
  res.json({ ok: true });
});

/* ---------------- ROUTES ---------------- */

app.get("/api/routes", (req, res) => {
  res.json(routes);
});

app.post("/api/routes", (req, res) => {
  routes.push(req.body);
  res.json({ ok: true });
});

app.put("/api/routes/:id", (req, res) => {
  const id = req.params.id;
  routes = routes.map((r) => (r.id === id ? req.body : r));
  res.json({ ok: true });
});

app.delete("/api/routes/:id", (req, res) => {
  const id = req.params.id;
  routes = routes.filter((r) => r.id !== id);
  res.json({ ok: true });
});

/* ---------------- VEHICLES ---------------- */

app.get("/api/vehicles", (req, res) => {
  res.json(vehicles);
});

app.post("/api/vehicles", (req, res) => {
  vehicles.push(req.body);
  res.json({ ok: true });
});

app.put("/api/vehicles/:id", (req, res) => {
  const id = req.params.id;
  vehicles = vehicles.map((v) => (v.id === id ? req.body : v));
  res.json({ ok: true });
});

app.delete("/api/vehicles/:id", (req, res) => {
  const id = req.params.id;
  vehicles = vehicles.filter((v) => v.id !== id);
  res.json({ ok: true });
});

/* ---------------- BREAKDOWNS ---------------- */

app.get("/api/breakdowns", (req, res) => {
  res.json(breakdowns);
});

app.post("/api/breakdowns", (req, res) => {
  breakdowns.push(req.body);
  res.json({ ok: true });
});

app.delete("/api/breakdowns/:id", (req, res) => {
  const id = req.params.id;
  breakdowns = breakdowns.filter((b) => b.id !== id);
  res.json({ ok: true });
});

/* ---------------- LOGSHEETS ---------------- */

app.get("/api/logsheets", (req, res) => {
  res.json(logsheets);
});

app.post("/api/logsheets", (req, res) => {
  logsheets.push(req.body);
  res.json({ ok: true });
});

/* ---------------- START SERVER ---------------- */

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});