/**
 * server.js — Robot Face | Hostinger VPS Edition
 *
 * KEY HOSTINGER DIFFERENCES vs Raspberry Pi version:
 *   1. Port comes from process.env.PORT (hPanel sets this automatically)
 *   2. No servo / GPIO code (no hardware on a cloud server)
 *   3. Socket.IO configured with polling+websocket transports so it works
 *      behind Hostinger's Nginx reverse proxy
 *   4. CORS origin must match your actual domain
 *   5. Entry point file must be named as set in hPanel (we use server.js)
 *
 * ESP32 ADDITION:
 *   - GET  /esp32/command  → ESP32 polls this to get "happy" or "neutral"
 *   - POST /esp32/ack      → ESP32 confirms it executed the command (optional)
 *   - The current command is updated whenever a Socket.IO person event fires
 */

"use strict";

const express  = require("express");
const http     = require("http");
const { Server } = require("socket.io");
const path     = require("path");

// ─── App & Server ────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

app.use(express.json()); // needed for POST /esp32/ack body parsing

const PORT          = process.env.PORT   || 3000;
const ALLOWED_ORIGIN = process.env.ORIGIN || "*";

// ─── ESP32 command state ──────────────────────────────────────────────────────
// Holds the latest servo command so ESP32 can poll it.
// "neutral" = hands down, "happy" = hands raised
let esp32Command = "neutral";
let esp32CommandId = 0;       // increments on every change so ESP32 can detect new commands

function setEsp32Command(cmd) {
  esp32Command = cmd;
  esp32CommandId++;
  console.log(`[ESP32] command → ${cmd}  (id ${esp32CommandId})`);
}

// ─── Socket.IO ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST"]
  },
  transports: ["polling"],
  pingTimeout: 60000,
  pingInterval: 25000
});

// ─── Static files ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ─── ESP32 REST endpoints ─────────────────────────────────────────────────────

/**
 * GET /esp32/command
 * ESP32 polls this endpoint (e.g. every 200ms).
 * Response: { command: "happy"|"neutral", id: <number> }
 *
 * The ESP32 should remember the last `id` it acted on.
 * If the new id > last id, execute the command and save the new id.
 * This avoids re-triggering the same command on every poll.
 */
app.get("/esp32/command", (req, res) => {
  res.json({ command: esp32Command, id: esp32CommandId });
});

/**
 * POST /esp32/ack
 * Optional: ESP32 confirms it executed a command.
 * Body: { id: <number>, status: "ok"|"error" }
 * Useful for debugging — you can check this in server logs.
 */
app.post("/esp32/ack", (req, res) => {
  const { id, status } = req.body || {};
  console.log(`[ESP32] ack id=${id} status=${status}`);
  res.json({ ok: true });
});

// ─── Socket.IO Events ────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[IO] Connected: ${socket.id}`);

  // Person detected by browser camera
  socket.on("camera-person-detected", () => {
    console.log(`[IO] camera-person-detected from ${socket.id}`);
    io.emit("person-detected");
    setEsp32Command("happy");      // ← update ESP32 command state
  });

  // Person left camera frame
  socket.on("camera-person-lost", () => {
    console.log(`[IO] camera-person-lost from ${socket.id}`);
    io.emit("person-lost");
    setEsp32Command("neutral");    // ← update ESP32 command state
  });

  socket.on("disconnect", () => {
    console.log(`[IO] Disconnected: ${socket.id}`);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`[SERVER] Robot Face running on port ${PORT}`);
  console.log(`[SERVER] CORS origin: ${ALLOWED_ORIGIN}`);
  console.log(`[SERVER] ESP32 poll endpoint: GET /esp32/command`);
});
