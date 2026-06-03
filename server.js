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
 */

"use strict";

const express  = require("express");
const http     = require("http");
const { Server } = require("socket.io");
const path     = require("path");

// ─── App & Server ────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

// ── PORT: Hostinger injects this via environment variable ─────────────────────
// NEVER hard-code a port number on Hostinger shared/cloud Node hosting.
// On Hostinger VPS you CAN hard-code (e.g. 3000) but env var is best practice.
const PORT = process.env.PORT || 3000;

// ── CORS origin: replace with your real Hostinger domain ─────────────────────
// e.g. "https://yourdomain.com"  or  "*" for testing only
const ALLOWED_ORIGIN = process.env.ORIGIN || "*";

// ─── Socket.IO ───────────────────────────────────────────────────────────────
// Hostinger's Nginx reverse proxy supports WebSockets BUT requires the
// upgrade headers to pass through. We configure Socket.IO to start with
// "polling" (always works) then upgrade to "websocket" automatically.
// If you are on Hostinger Business/Cloud shared hosting, set
// transports: ["polling"] only — WebSocket server-side is blocked there.
const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGIN,
    methods: ["GET", "POST"]
  },
  // For Hostinger VPS: use both transports (polling upgrades to websocket)
  // For Hostinger shared/cloud: change to ["polling"] only
  transports: ["polling"],

  // Increase ping timeout for Hostinger's "hibernation" feature on lower plans
  pingTimeout: 60000,
  pingInterval: 25000
});

// ─── Static files ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// Health-check endpoint — useful for Hostinger uptime monitoring
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ─── Socket.IO Events ────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[IO] Connected: ${socket.id}`);

  // ── From camera-test.html ──────────────────────────────────────────────────

  // Person detected by browser camera
  socket.on("camera-person-detected", () => {
    console.log(`[IO] camera-person-detected from ${socket.id}`);
    // Relay to all robot face displays → show Happy expression (index 1)
    io.emit("person-detected");
    // NOTE: No servo here — servo runs on the Pi, not on Hostinger
  });

  // Person left camera frame
  socket.on("camera-person-lost", () => {
    console.log(`[IO] camera-person-lost from ${socket.id}`);
    // Relay to all robot face displays → show Neutral expression (index 0)
    io.emit("person-lost");
  });

  socket.on("disconnect", () => {
    console.log(`[IO] Disconnected: ${socket.id}`);
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`[SERVER] Robot Face running on port ${PORT}`);
  console.log(`[SERVER] CORS origin: ${ALLOWED_ORIGIN}`);
});
