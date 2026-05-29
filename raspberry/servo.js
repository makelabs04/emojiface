/**
 * servo.js — Raspberry Pi Servo Controller
 *
 * Runs ONLY on the Raspberry Pi.
 * Connects to your Hostinger server as a Socket.IO CLIENT (outgoing connection).
 * Listens for person-detected / person-lost events.
 * Moves PCA9685 servo motors accordingly.
 *
 * No web server. No HTTP. Just servo control.
 */

"use strict";

const { io } = require("socket.io-client");

// ── CONFIG — change this to your actual Hostinger domain ─────────────────────
const HOSTINGER_URL = "https://yourdomain.com";   // ← replace with your domain

// ── PCA9685 Servo Setup ───────────────────────────────────────────────────────
// Wiring: SDA → GPIO2 (Pin 3), SCL → GPIO3 (Pin 5), V+ → external 5V supply
// Run:  sudo i2cdetect -y 1   → should show 0x40

const SERVO_CHANNEL_LEFT  = 0;   // Left hand servo  → PCA9685 channel 0
const SERVO_CHANNEL_RIGHT = 1;   // Right hand servo → PCA9685 channel 1

// Pulse lengths (12-bit ticks at 60Hz)
// Standard servo: min=150, center=375, max=600
// Adjust these values to match your physical servo arm positions
const PULSE = {
  LEFT_NEUTRAL:  375,   // Left hand down (neutral)
  LEFT_HAPPY:    500,   // Left hand raised (happy/wave)
  RIGHT_NEUTRAL: 375,   // Right hand down (neutral)
  RIGHT_HAPPY:   500    // Right hand raised (happy/wave)
};

// ── Init PCA9685 ──────────────────────────────────────────────────────────────
let pca9685 = null;

function initServo() {
  try {
    const Pca9685Driver = require("adafruit-pca9685");
    const i2c           = require("i2c-bus").openSync(1);

    pca9685 = new Pca9685Driver(
      { i2c, address: 0x40, frequency: 60, debug: false },
      (err) => {
        if (err) {
          console.error("[SERVO] Init error:", err.message);
          pca9685 = null;
          return;
        }
        console.log("[SERVO] PCA9685 ready");
        moveServoNeutral(); // park at neutral on startup
      }
    );
  } catch (err) {
    console.error("[SERVO] PCA9685 not available:", err.message);
    pca9685 = null;
  }
}

// ── Servo Movements ───────────────────────────────────────────────────────────

function moveServoHappy() {
  if (!pca9685) { console.log("[SERVO] moveServoHappy  (no hardware)"); return; }
  pca9685.setPulseLength(SERVO_CHANNEL_LEFT,  PULSE.LEFT_HAPPY);
  pca9685.setPulseLength(SERVO_CHANNEL_RIGHT, PULSE.RIGHT_HAPPY);
  console.log("[SERVO] → Happy  (hands raised)");
}

function moveServoNeutral() {
  if (!pca9685) { console.log("[SERVO] moveServoNeutral (no hardware)"); return; }
  pca9685.setPulseLength(SERVO_CHANNEL_LEFT,  PULSE.LEFT_NEUTRAL);
  pca9685.setPulseLength(SERVO_CHANNEL_RIGHT, PULSE.RIGHT_NEUTRAL);
  console.log("[SERVO] → Neutral (hands down)");
}

// ── Socket.IO Client — connects OUT to Hostinger ──────────────────────────────
// This is an OUTGOING connection from the Pi → Hostinger.
// No incoming port needed on the Pi. Firewall is not a concern.

function connectToServer() {
  console.log(`[SOCKET] Connecting to ${HOSTINGER_URL} ...`);

  const socket = io(HOSTINGER_URL, {
    transports:         ["polling"],
    reconnection:       true,
    reconnectionDelay:  3000,   // wait 3s before retry
    reconnectionAttempts: Infinity
  });

  socket.on("connect", () => {
    console.log(`[SOCKET] Connected to Hostinger — id: ${socket.id}`);
  });

  // ── Person detected → raise hands ─────────────────────────────────────────
  socket.on("person-detected", () => {
    console.log("[SOCKET] person-detected received");
    moveServoHappy();
  });

  // ── Person lost → lower hands ──────────────────────────────────────────────
  socket.on("person-lost", () => {
    console.log("[SOCKET] person-lost received");
    moveServoNeutral();
  });

  socket.on("disconnect", (reason) => {
    console.log(`[SOCKET] Disconnected: ${reason} — will reconnect...`);
  });

  socket.on("connect_error", (err) => {
    console.error(`[SOCKET] Connection error: ${err.message} — retrying...`);
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────
initServo();
connectToServer();
