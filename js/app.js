import { initEditor, renderAll, getRoot, setRoot } from "./editor.js";
import { loadJsonFile, saveJsonFile } from "./json.js";
import { packEhmi } from "./ehmi.js";
import { uploadToDisplay, openMonitor, sendToDisplay, closeMonitor } from "./serial.js";

const status = (msg) => {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
};

const root = {
  version: 2,
  name: "project",
  device: {
    id: "elecrow-basic-70",
    name: "CrowPanel Basic 7.0",
    mcu: "ESP32-S3",
    width: 800,
    height: 480,
    display: { bus: "rgb", driver: "RGB565" },
    touch: { driver: "GT911" },
    hostUart: { tx: 17, rx: 18, baud: 115200 }
  },
  fonts: [],
  pages: [{
    uid: "p_demo", id: 0, objname: "page0", bco: 0, sta: 1, pic: 0,
    events: { preinit: "", timer: "" },
    components: [{
      uid: "w_demo", type: "button", objname: "b0", id: 1,
      events: { press: "printh 31 32 33 FF FF FF", release: "", preinit: "", timer: "" },
      x: 40, y: 40, vis: 1, sta: 1, w: 200, h: 60,
      txt: "Send 123", font: 1, pco: 65535, bco: 1476,
      pco2: 65535, bco2: 2390, style: 0, xcen: 1, ycen: 1, pic: 0, pic2: 0
    }],
    locked: false
  }],
  bindings: [],
  arduino: { includes: "", globals: "", setup: "", loop: "" }
};

initEditor(root, status);
renderAll();
status("Demo project loaded. Use Load JSON to open your file.");

// ---------- Режимы ----------
let appMode = "normal";
const modeBtn = document.getElementById("modeBtn");
const debugPanel = document.getElementById("debugPanel");
const debugLog = document.getElementById("debugLog");
const debugCmd = document.getElementById("debugCmd");
const debugSend = document.getElementById("debugSend");
const debugClear = document.getElementById("debugClear");
const monitorOpen = document.getElementById("monitorOpen");
const monitorClose = document.getElementById("monitorClose");

function logDebug(text, dir) {
  const p = document.createElement("div");
  p.textContent = (dir === "in" ? "← " : "→ ") + text;
  p.style.color = dir === "in" ? "#8cf" : "#cf8";
  debugLog.appendChild(p);
  debugLog.scrollTop = debugLog.scrollHeight;
}

function setMode(m) {
  appMode = m;
  modeBtn.textContent = appMode === "normal" ? "Debug mode" : "Normal mode";
  debugPanel.style.display = appMode === "debug" ? "block" : "none";
  document.getElementById("loadBtn").style.display = appMode === "debug" ? "none" : "";
  document.getElementById("saveBtn").style.display = appMode === "debug" ? "none" : "";
  document.getElementById("uploadBtn").style.display = appMode === "debug" ? "none" : "";
  status(appMode === "normal" ? "Normal mode" : "Debug mode");
}

modeBtn.onclick = () => setMode(appMode === "normal" ? "debug" : "normal");

monitorOpen.onclick = async () => {
  try {
    await openMonitor((data) => logDebug(data, "in"));
    status("Monitor open");
  } catch (err) {
    status("Error: " + err.message);
  }
};

monitorClose.onclick = async () => {
  await closeMonitor();
  status("Monitor closed");
};

debugClear.onclick = () => { debugLog.innerHTML = ""; };

debugSend.onclick = async () => {
  const cmd = debugCmd.value.trim();
  if (!cmd) return;
  try {
    await sendToDisplay(cmd);
    logDebug(cmd, "out");
    debugCmd.value = "";
  } catch (err) {
    logDebug("Error: " + err.message, "in");
  }
};

// ---------- Load / Save / Upload ----------
document.getElementById("loadBtn").onclick = () => {
  document.getElementById("fileInput").click();
};

document.getElementById("fileInput").onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const j = await loadJsonFile(f);
    if (!j.pages || !Array.isArray(j.pages)) throw new Error("No pages[]");
    if (!j.device) j.device = { width: 800, height: 480 };
    if (!j.bindings) j.bindings = [];
    if (!j.arduino) j.arduino = { includes: "", globals: "", setup: "", loop: "" };
    setRoot(j);
    renderAll();
    status("Loaded: " + f.name + " (v" + (j.version || 1) + ")");
  } catch (err) {
    alert("JSON error: " + err.message);
  }
};

document.getElementById("saveBtn").onclick = () => {
  saveJsonFile(getRoot());
  status("Saved to file");
};

document.getElementById("uploadBtn").onclick = async () => {
  try {
    const bytes = packEhmi(getRoot());
    status("Sending " + bytes.length + " bytes...");
    await uploadToDisplay(bytes, (p) => status("Upload: " + p + "%"));
    status("UI uploaded to display");
  } catch (err) {
    status("Error: " + err.message);
    alert(err.message);
  }
};
