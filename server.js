// server.js — ES module version
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

/* ---------------- health check ---------------- */

app.get("/ping", (req, res) => {
  res.json({ ok: true, pong: true });
});

/* ---------------- in‑memory storage ---------------- */

let drivers = [];
let routes = [];
let vehicles = [];
let breakdowns = [];
let logsheets = [];
let users = [];

/* ---------------- generic CRUD creator ---------------- */

function createCRUD(path, storage) {
  // list all
  app.get(`/api/${path}`, (req, res) => {
    res.json(storage);
  });

  // create new
  app.post(`/api/${path}`, (req, res) => {
    const item = { id: Date.now().toString(), ...req.body };
    storage.push(item);
    res.json({ ok: true, item });
  });

  // update existing
  app.put(`/api/${path}/:id`, (req, res) => {
    const index = storage.findIndex(x => x.id === req.params.id);
    if (index === -1) return res.status(404).json({ ok: false });
    storage[index] = { ...storage[index], ...req.body };
    res.json({ ok: true });
  });

  // delete
  app.delete(`/api/${path}/:id`, (req, res) => {
    const index = storage.findIndex(x => x.id === req.params.id);
    if (index === -1) return res.status(404).json({ ok: false });
    storage.splice(index, 1);
    res.json({ ok: true });
  });
}

/* ---------------- create APIs ---------------- */

createCRUD("drivers", drivers);
createCRUD("routes", routes);
createCRUD("vehicles", vehicles);
createCRUD("breakdowns", breakdowns);
createCRUD("logsheets", logsheets);
createCRUD("users", users);

/* ---------------- login/logout/password ---------------- */

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username && password) {
    res.json({ ok: true, user: { username } });
  } else {
    res.json({ ok: false, error: "Invalid login" });
  }
});

app.post("/logout", (req, res) => {
  res.json({ ok: true });
});

app.post("/updatePassword", (req, res) => {
  res.json({ ok: true });
});

/* ---------------- root route ---------------- */

app.get("/", (req, res) => {
  res.send("API running successfully");
});

/* ---------------- start server ---------------- */

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});