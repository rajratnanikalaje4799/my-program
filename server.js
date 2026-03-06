import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 4000;

// ===== Middleware =====
app.use(cors());
app.use(express.json());

// ===== Health Routes =====
app.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Depot API Running",
    time: new Date().toISOString()
  });
});

app.get("/ping", (req, res) => {
  res.json({ ok: true, pong: true });
});

// ===== Sample API Routes =====
let routes = [];
let drivers = [];

app.get("/api/routes", (req, res) => {
  res.json(routes);
});

app.post("/api/routes", (req, res) => {
  routes.push(req.body);
  res.json({ ok: true });
});

app.get("/api/drivers", (req, res) => {
  res.json(drivers);
});

app.post("/api/drivers", (req, res) => {
  drivers.push(req.body);
  res.json({ ok: true });
});

// ===== Start Server =====
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});