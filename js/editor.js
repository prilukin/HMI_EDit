// editor.js — canvas, drag, properties, pages, device, bindings, arduino

let root = null;
let currentPage = 0;
let selectedUid = null;
let snap = false;
let statusFn = (msg) => {};

const $ = id => document.getElementById(id);
const canvas = () => $("canvas");
const pagesEl = () => $("pages");
const propsEl = () => $("props");

function status(msg) { statusFn(msg); }

function colorTo565(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  return ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3);
}
function color565ToHex(v) {
  const r = ((v >> 11) & 31) * 8, g = ((v >> 5) & 63) * 4, b = (v & 31) * 8;
  return "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
}
function fontPxFor(fontId) {
  if (root.fonts) {
    const f = root.fonts.find(x => x.id === fontId);
    if (f && f.size) return f.size;
  }
  if (fontId >= 3) return 32;
  if (fontId >= 2) return 24;
  if (fontId >= 1) return 16;
  return 12;
}
function compColor(c, key, def) {
  if (c[key] === undefined) return def;
  return color565ToHex(c[key]);
}
function setCompColor(c, key, hex) {
  c[key] = colorTo565(hex);
}
function uid(prefix) {
  return (prefix || "w") + "_" + Math.random().toString(36).slice(2, 8);
}
function getPage() { return root.pages[currentPage] || null; }
function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ---------- pages ----------
function renderPages() {
  const el = pagesEl();
  el.innerHTML = "";
  root.pages.forEach((p, i) => {
    const d = document.createElement("div");
    d.className = "page-item" + (i === currentPage ? " active" : "");
    d.textContent = (p.objname || ("page" + i)) + "  (" + p.id + ")";
    d.onclick = () => { currentPage = i; selectedUid = null; renderAll(); };
    el.appendChild(d);
  });
}

function addPage() {
  const id = root.pages.length;
  root.pages.push({
    uid: uid("p"), id, objname: "page" + id,
    bco: 0, sta: 1, pic: 0,
    events: { preinit: "", timer: "" },
    components: [],
    locked: false
  });
  currentPage = root.pages.length - 1;
  selectedUid = null;
  renderAll();
  status("Page " + id + " added");
}

// ---------- canvas ----------
function renderCanvas() {
  const cvs = canvas();
  const pg = getPage();
  const W = root.device.width || 800;
  const H = root.device.height || 480;
  $("pageSizeLabel").textContent = W + "×" + H;
  cvs.style.width = W + "px";
  cvs.style.height = H + "px";
  const bco = pg ? color565ToHex(pg.bco || 0) : "#000";
  cvs.style.background = bco;
  cvs.innerHTML = "";

  if (!pg) return;

  (pg.components || []).forEach(c => {
    const el = document.createElement("div");
    el.className = "comp" + (c.uid === selectedUid ? " selected" : "");
    if (c.vis === 0 || (c.type === "timer" || c.type === "variable")) el.classList.add("hidden-comp");
    el.dataset.uid = c.uid;
    el.style.left = (c.x || 0) + "px";
    el.style.top = (c.y || 0) + "px";
    el.style.width = (c.w || 20) + "px";
    el.style.height = (c.h || 20) + "px";

    // WYSIWYG: фон только при sta == 1
    const sta = c.sta ?? 1;
    if (sta === 1) {
      const bco2 = c.bco !== undefined ? color565ToHex(c.bco) : "#1476";
      el.style.background = bco2;
    } else {
      el.style.background = "transparent";
    }

    const pco = c.pco !== undefined ? color565ToHex(c.pco) : "#fff";
    el.style.color = pco;
    el.style.padding = "6px";
    el.style.boxSizing = "border-box";
    el.style.overflow = "hidden";
    el.style.whiteSpace = c.isbr ? "normal" : "nowrap";
    const xi = c.xcen ?? 1;
    const yi = c.ycen ?? 1;
    el.style.justifyContent = xi === 0 ? "flex-start" : xi === 2 ? "flex-end" : "center";
    el.style.alignItems = yi === 0 ? "flex-start" : yi === 2 ? "flex-end" : "center";

    // WYSIWYG: форма по style
    const style = c.style ?? 0;
    const w0 = c.w || 20, h0 = c.h || 20;
    if (style === 3) {
      el.style.borderRadius = "50%";
    } else if (style === 2) {
      el.style.borderRadius = (Math.min(w0, h0) / 2) + "px";
    } else if (style === 1) {
      el.style.borderRadius = Math.max(4, Math.min(w0, h0) / 6) + "px";
    } else {
      el.style.borderRadius = "0";
    }

    const t = c.type || c.t || "text";
    if (t === "text" || t === "number" || t === "button" || t === "dualstate") {
      el.textContent = c.txt || (t === "number" ? "0" : t);
    } else {
      el.textContent = t;
    }
    el.style.fontSize = fontPxFor(c.font ?? 1) + "px";
    el.onmousedown = e => startDrag(e, c);
    el.onclick = e => {
      e.stopPropagation();
      selectedUid = c.uid;
      renderCanvas();
      renderProps();
      setTab("props");
    };
    cvs.appendChild(el);
  });
}

function initCanvasClick() {
  canvas().onclick = () => {
    selectedUid = null;
    renderCanvas();
    renderProps();
  };
}

// ---------- drag ----------
function startDrag(e, c) {
  e.preventDefault();
  e.stopPropagation();
  selectedUid = c.uid;
  renderCanvas();
  renderProps();
  const startX = e.clientX, startY = e.clientY;
  const ox = c.x || 0, oy = c.y || 0;

  const move = ev => {
    let nx = ox + (ev.clientX - startX);
    let ny = oy + (ev.clientY - startY);
    if (snap) { nx = Math.round(nx / 5) * 5; ny = Math.round(ny / 5) * 5; }
    c.x = nx; c.y = ny;
    const el = canvas().querySelector('[data-uid="' + c.uid + '"]');
    if (el) { el.style.left = nx + "px"; el.style.top = ny + "px"; }
    renderProps();
  };
  const up = () => {
    window.removeEventListener("mousemove", move);
    window.removeEventListener("mouseup", up);
    status("Moved: " + c.objname + " → " + c.x + "," + c.y);
  };
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", up);
}

// ---------- add component ----------
function addComponent(type) {
  const pg = getPage();
  if (!pg) { alert("Create a page first"); return; }
  if (!pg.components) pg.components = [];
  const id = (pg.components.reduce((m, c) => Math.max(m, c.id || 0), 0) || 0) + 1;
  const name = type + id;
  const comp = {
    uid: uid("w"), type, objname: name, id,
    x: 20, y: 20, vis: 1,
    events: { press: "", release: "", preinit: "", timer: "" },
    w: type === "button" ? 120 : 80, h: type === "button" ? 40 : 30,
    txt: type === "button" ? "BTN" : type === "text" ? "Text" : "",
    font: 1, pco: 65535, bco: 1476,
    pco2: 65535, bco2: 2390,
    sta: 1, style: 0, xcen: 1, ycen: 1, pic: 0, pic2: 0
  };
  if (type === "number") { comp.val = 0; comp.minval = 0; comp.maxval = 100; }
  if (type === "progress") { comp.val = 0; comp.minval = 0; comp.maxval = 100; }
  if (type === "slider") { comp.val = 0; comp.minval = 0; comp.maxval = 100; comp.wid = 8; comp.hig = 20; }
  if (type === "gauge") { comp.val = 0; comp.minval = 0; comp.maxval = 100; comp.wid = 6; comp.pco2 = 63488; comp.fco = 65535; comp.style = 2; }
  if (type === "dualstate") { comp.val = 0; comp.txt2 = "ON"; }
  if (type === "checkbox" || type === "switch") { comp.val = 0; }
  if (type === "timer") { comp.en = 0; comp.tim = 200; }
  if (type === "variable") { comp.val = 0; comp.txt = ""; comp.vscope = 0; }
  pg.components.push(comp);
  selectedUid = comp.uid;
  renderCanvas();
  renderProps();
  status("Component " + name + " added");
}

// ---------- delete component ----------
function deleteSelected() {
  const pg = getPage();
  if (!pg || !selectedUid) {
    status("Nothing selected");
    return;
  }
  const before = pg.components.length;
  pg.components = (pg.components || []).filter(x => x.uid !== selectedUid);
  if (pg.components.length === before) {
    status("Nothing to delete");
    return;
  }
  status("Component " + selectedUid + " deleted");
  selectedUid = null;
  renderCanvas();
  renderProps();
}

// ---------- properties ----------
function renderProps() {
  const el = propsEl();
  const pg = getPage();
  if (!pg) { el.innerHTML = '<div class="hint">No page.</div>'; return; }
  const c = (pg.components || []).find(x => x.uid === selectedUid);
  if (!c) {
    el.innerHTML = '<div class="hint">Select a component on the canvas.</div>' +
      '<h3>Page</h3>' +
      '<label>objname<input data-page="objname" value="' + esc(pg.objname || "") + '"></label>' +
      '<label>bco (background)<input type="color" data-page="bco" value="' + color565ToHex(pg.bco || 0) + '"></label>' +
      '<label>sta<input type="number" data-page="sta" min="0" max="3" value="' + (pg.sta ?? 1) + '"></label>';
    bindPageProps();
    return;
  }

  const fontMax = (root.fonts && root.fonts.length) ? (root.fonts.length - 1) : 3;

  let html = '<h3>' + esc(c.objname || c.type) + '</h3>';
  html += '<label>objname<input data-p="objname" value="' + esc(c.objname) + '"></label>';
  html += '<label>type<input data-p="type" value="' + esc(c.type) + '"></label>';
  html += '<label>id<input type="number" data-p="id" min="1" max="255" value="' + (c.id || 0) + '"></label>';
  html += '<div class="row2"><label>x<input type="number" data-p="x" value="' + (c.x || 0) + '"></label>' +
          '<label>y<input type="number" data-p="y" value="' + (c.y || 0) + '"></label></div>';
  html += '<div class="row2"><label>w<input type="number" data-p="w" min="0" value="' + (c.w || 0) + '"></label>' +
          '<label>h<input type="number" data-p="h" min="0" value="' + (c.h || 0) + '"></label></div>';
  html += '<label>txt<input data-p="txt" value="' + esc(c.txt || "") + '"></label>';
  html += '<div class="row2"><label>pco<input type="color" data-p="pco" value="' + compColor(c, "pco", "#ffffff") + '"></label>' +
          '<label>bco<input type="color" data-p="bco" value="' + compColor(c, "bco", "#114476") + '"></label></div>';
  html += '<div class="row2"><label>pco2<input type="color" data-p="pco2" value="' + compColor(c, "pco2", "#ffffff") + '"></label>' +
          '<label>bco2<input type="color" data-p="bco2" value="' + compColor(c, "bco2", "#223390") + '"></label></div>';
  html += '<div class="row2"><label>font<input type="number" data-p="font" min="0" max="' + fontMax + '" value="' + (c.font ?? 1) + '"></label>' +
          '<label>style<input type="number" data-p="style" min="0" max="3" value="' + (c.style ?? 0) + '"></label></div>';
  html += '<div class="row2"><label>xcen<input type="number" data-p="xcen" min="0" max="2" value="' + (c.xcen ?? 1) + '"></label>' +
          '<label>ycen<input type="number" data-p="ycen" min="0" max="2" value="' + (c.ycen ?? 1) + '"></label></div>';
  html += '<div class="row2"><label>vis<input type="number" data-p="vis" min="0" max="1" value="' + (c.vis ?? 1) + '"></label>' +
          '<label>sta<input type="number" data-p="sta" min="0" max="3" value="' + (c.sta ?? 1) + '"></label></div>';
  html += '<label style="display:flex;align-items:center;gap:6px;margin:8px 0">' +
          '<input type="checkbox" data-p="std" ' + ((c.nostd ?? 0) ? '' : 'checked') + '> Send standard Nextion command</label>';
  if (c.type === "number" || c.type === "progress" || c.type === "slider" || c.type === "gauge") {
    html += '<label>val<input type="number" data-p="val" value="' + (c.val ?? 0) + '"></label>';
    html += '<div class="row2"><label>minval<input type="number" data-p="minval" value="' + (c.minval ?? 0) + '"></label>' +
            '<label>maxval<input type="number" data-p="maxval" value="' + (c.maxval ?? 100) + '"></label></div>';
  }
  if (c.type === "slider") {
    html += '<div class="row2"><label>wid<input type="number" data-p="wid" min="0" value="' + (c.wid ?? 8) + '"></label>' +
            '<label>hig<input type="number" data-p="hig" min="0" value="' + (c.hig ?? 20) + '"></label></div>';
  }
  if (c.type === "gauge") {
    html += '<label>fco<input type="color" data-p="fco" value="' + compColor(c, "fco", "#ffffff") + '"></label>';
  }
  if (c.type === "dualstate") {
    html += '<label>txt2<input data-p="txt2" value="' + esc(c.txt2 || "ON") + '"></label>';
  }
  if (c.type === "timer") {
    html += '<div class="row2"><label>tim<input type="number" data-p="tim" min="1" value="' + (c.tim ?? 200) + '"></label>' +
            '<label>en<input type="number" data-p="en" min="0" max="1" value="' + (c.en ?? 0) + '"></label></div>';
  }
  if (c.type === "variable") {
    html += '<div class="row2"><label>val<input type="number" data-p="val" value="' + (c.val ?? 0) + '"></label>' +
            '<label>vscope<input type="number" data-p="vscope" min="0" max="1" value="' + (c.vscope ?? 0) + '"></label></div>';
  }
  html += '<h3>Events</h3>';
  html += '<label>press<textarea data-e="press">' + esc(c.events?.press || "") + '</textarea></label>';
  html += '<label>release<textarea data-e="release">' + esc(c.events?.release || "") + '</textarea></label>';
  html += '<label>preinit<textarea data-e="preinit">' + esc(c.events?.preinit || "") + '</textarea></label>';
  html += '<label>timer<textarea data-e="timer">' + esc(c.events?.timer || "") + '</textarea></label>';
  html += '<div style="margin-top:12px"><button id="delComp" class="danger" style="width:100%">Delete component</button></div>';
  el.innerHTML = html;
  bindCompProps(c);
}

function bindCompProps(c) {
  const fontMax = (root.fonts && root.fonts.length) ? (root.fonts.length - 1) : 3;
  propsEl().querySelectorAll("[data-p]").forEach(inp => {
    const handler = () => {
      const k = inp.dataset.p;
      if (k === "std") {
        c.nostd = inp.checked ? 0 : 1;
        renderCanvas();
        renderProps();
        status("Standard command: " + (inp.checked ? "on" : "off"));
        return;
      }
      let v = inp.value;
      if (inp.type === "number") v = parseFloat(v) || 0;
      if (k === "pco" || k === "bco" || k === "pco2" || k === "bco2" || k === "fco") {
        setCompColor(c, k, v);
      } else {
        // пределы
        if (k === "w" || k === "h" || k === "wid" || k === "hig") {
          if (v < 0) v = 0;
        } else if (k === "id") {
          v = Math.max(1, Math.min(255, v));
        } else if (k === "font") {
          v = Math.max(0, Math.min(fontMax, v));
        } else if (k === "style") {
          v = Math.max(0, Math.min(3, v));
        } else if (k === "xcen" || k === "ycen") {
          v = Math.max(0, Math.min(2, v));
        } else if (k === "vis") {
          v = v ? 1 : 0;
        } else if (k === "sta") {
          v = Math.max(0, Math.min(3, v));
        } else if (k === "transp") {
          v = Math.max(0, Math.min(100, v));
        } else if (k === "tim") {
          v = Math.max(1, v);
        } else if (k === "en" || k === "vscope") {
          v = v ? 1 : 0;
        }
        c[k] = v;
      }
      renderCanvas();
      renderProps();
      status("Changed: " + k);
    };
    if (inp.type === "checkbox") inp.onclick = handler;
    else inp.onchange = handler;
  });
  propsEl().querySelectorAll("[data-e]").forEach(inp => {
    inp.onchange = () => {
      if (!c.events) c.events = {};
      c.events[inp.dataset.e] = inp.value;
      status("Event " + inp.dataset.e + " updated");
    };
  });
  const del = document.getElementById("delComp");
  if (del) {
    del.onclick = () => {
      const pg = getPage();
      if (!pg) return;
      pg.components = (pg.components || []).filter(x => x.uid !== c.uid);
      selectedUid = null;
      renderCanvas();
      renderProps();
      status("Component " + (c.objname || c.uid) + " deleted");
    };
  }
}

function bindPageProps() {
  propsEl().querySelectorAll("[data-page]").forEach(inp => {
    inp.onchange = () => {
      const pg = getPage();
      if (inp.dataset.page === "bco") pg.bco = colorTo565(inp.value);
      else pg[inp.dataset.page] = inp.value;
      renderCanvas();
      status("Page updated");
    };
  });
}

// ---------- tabs ----------
function setTab(name) {
  document.querySelectorAll(".tab-bar button").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".tab-content").forEach(c => c.classList.toggle("active", c.id === "tab-" + name));
}

function initTabs() {
  document.querySelectorAll(".tab-bar button").forEach(b => {
    b.onclick = () => setTab(b.dataset.tab);
  });
}

// ---------- device ----------
function renderDevice() {
  document.querySelectorAll("[data-dev]").forEach(inp => {
    const k = inp.dataset.dev;
    if (k === "width" || k === "height") inp.value = root.device[k] || 0;
    else inp.value = root.device[k] || "";
    inp.onchange = () => {
      if (k === "width" || k === "height") root.device[k] = parseFloat(inp.value) || 0;
      else root.device[k] = inp.value;
      renderCanvas();
      status("Device: " + k);
    };
  });
  document.querySelectorAll("[data-touch]").forEach(inp => {
    if (!root.device.touch) root.device.touch = {};
    inp.value = root.device.touch[inp.dataset.touch] || "";
    inp.onchange = () => {
      root.device.touch[inp.dataset.touch] = inp.value;
      status("Touch: " + inp.dataset.touch);
    };
  });
  document.querySelectorAll("[data-uart]").forEach(inp => {
    if (!root.device.hostUart) root.device.hostUart = {};
    inp.value = root.device.hostUart[inp.dataset.uart] ?? "";
    inp.onchange = () => {
      root.device.hostUart[inp.dataset.uart] = parseFloat(inp.value) || 0;
      status("UART: " + inp.dataset.uart);
    };
  });
}

// ---------- bindings ----------
function renderBindings() {
  const el = $("bindings");
  el.innerHTML = "";
  if (!root.bindings) root.bindings = [];
  if (!root.bindings.length) {
    el.innerHTML = '<div class="hint">No bindings.</div>';
    return;
  }
  root.bindings.forEach((b, i) => {
    const row = document.createElement("div");
    row.className = "binding-row";
    row.innerHTML =
      '<div class="row2">' +
        '<label class="small">widget<input data-b="' + i + '" data-bk="widget" value="' + esc(b.widget || "") + '"></label>' +
        '<label class="small">attr<input data-b="' + i + '" data-bk="attr" value="' + esc(b.attr || "") + '"></label>' +
      '</div>' +
      '<div class="row2">' +
        '<label class="small">kind<input data-b="' + i + '" data-bk="kind" value="' + esc(b.kind || "") + '"></label>' +
        '<label class="small">direction<input data-b="' + i + '" data-bk="direction" value="' + esc(b.direction || "") + '"></label>' +
      '</div>' +
      '<div class="row2">' +
        '<label class="small">pin<input type="number" data-b="' + i + '" data-bk="pin" value="' + (b.pin ?? 0) + '"></label>' +
        '<label class="small">pin2<input type="number" data-b="' + i + '" data-bk="pin2" value="' + (b.pin2 ?? 0) + '"></label>' +
      '</div>' +
      '<div class="row2">' +
        '<label class="small">intervalMs<input type="number" data-b="' + i + '" data-bk="intervalMs" value="' + (b.intervalMs ?? 0) + '"></label>' +
        '<label class="small">enabled<input type="number" data-b="' + i + '" data-bk="enabled" value="' + (b.enabled ? 1 : 0) + '"></label>' +
      '</div>' +
      '<label class="small">note<input data-b="' + i + '" data-bk="note" value="' + esc(b.note || "") + '"></label>' +
      '<button class="danger small" data-delb="' + i + '" style="margin-top:4px">Delete</button>';
    el.appendChild(row);
  });
  el.querySelectorAll("[data-b]").forEach(inp => {
    inp.onchange = () => {
      const i = parseInt(inp.dataset.b);
      const k = inp.dataset.bk;
      let v = inp.value;
      if (inp.type === "number") v = parseFloat(v) || 0;
      if (k === "enabled") v = !!v;
      root.bindings[i][k] = v;
      status("Binding " + i + ": " + k);
    };
  });
  el.querySelectorAll("[data-delb]").forEach(btn => {
    btn.onclick = () => {
      root.bindings.splice(parseInt(btn.dataset.delb), 1);
      renderBindings();
      status("Binding deleted");
    };
  });
}

function addBinding() {
  if (!root.bindings) root.bindings = [];
  root.bindings.push({
    id: uid("b"),
    page: getPage()?.objname || "home",
    widget: "", attr: "val",
    kind: "dht22_temp", direction: "in",
    pin: 0, pin2: 0, intervalMs: 2000,
    scale: 1, offset: 0, enabled: true, note: ""
  });
  renderBindings();
  status("Binding added");
}

// ---------- arduino ----------
function renderArduino() {
  if (!root.arduino) root.arduino = { includes: "", globals: "", setup: "", loop: "" };
  document.querySelectorAll("[data-ard]").forEach(inp => {
    inp.value = root.arduino[inp.dataset.ard] || "";
    inp.onchange = () => {
      root.arduino[inp.dataset.ard] = inp.value;
      status("Arduino: " + inp.dataset.ard);
    };
  });
}

// ---------- public API ----------
export function initEditor(rootRef, statusCb) {
  root = rootRef;
  statusFn = statusCb || ((m) => {});
  initCanvasClick();
  initTabs();
  $("addPage").onclick = addPage;
  $("addComp").onclick = () => addComponent($("addType").value);
  $("delCompBtn").onclick = deleteSelected;
  $("snap").onchange = e => { snap = e.target.checked; };
  $("addBinding").onclick = addBinding;
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Delete" || !selectedUid) return;
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    deleteSelected();
  });
}

export function renderAll() {
  renderPages();
  renderCanvas();
  renderProps();
  renderDevice();
  renderBindings();
  renderArduino();
}

export function getRoot() { return root; }
export function setRoot(r) { root = r; }