/**
 * server.js — Robot Face | Hostinger VPS Edition
 * Updated: Added ESP32 expression relay
 */

"use strict";

const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const path       = require("path");

const app    = express();
const server = http.createServer(app);

const PORT           = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ORIGIN || "*";

const io = new Server(server, {
  cors: { origin: ALLOWED_ORIGIN, methods: ["GET", "POST"] },
  transports: ["polling"],
  pingTimeout:  60000,
  pingInterval: 25000
});

app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

// ─── Track which sockets are ESP32 devices ───────────────────────────────────
const esp32Sockets = new Set();

io.on("connection", (socket) => {
  console.log(`[IO] Connected: ${socket.id}`);

  // ── ESP32 identifies itself on connect ────────────────────────────────────
  socket.on("esp32-register", () => {
    esp32Sockets.add(socket.id);
    console.log(`[IO] ESP32 registered: ${socket.id}`);
    socket.emit("esp32-ack", { status: "registered" });
  });

  // ── Browser camera → person detected ─────────────────────────────────────
  socket.on("camera-person-detected", () => {
    console.log(`[IO] camera-person-detected from ${socket.id}`);
    io.emit("person-detected");
  });

  // ── Browser camera → person lost ─────────────────────────────────────────
  socket.on("camera-person-lost", () => {
    console.log(`[IO] camera-person-lost from ${socket.id}`);
    io.emit("person-lost");
  });

  // ── Expression change → relay to all ESP32 devices ───────────────────────
  // Payload: { index: 0-5, name: "neutral"|"happy"|"wink-left"|"wink-right"|"thinking"|"sleep" }
  socket.on("esp32-expression", (data) => {
    console.log(`[IO] esp32-expression: ${data.name} (${data.index}) from ${socket.id}`);
    // Relay to every connected socket (ESP32 filters by its own check)
    io.emit("esp32-command", data);
  });

  socket.on("disconnect", () => {
    esp32Sockets.delete(socket.id);
    console.log(`[IO] Disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`[SERVER] Robot Face running on port ${PORT}`);
  console.log(`[SERVER] CORS origin: ${ALLOWED_ORIGIN}`);
});
