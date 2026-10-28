// Упаковка JSON → ui.ehmi (32-байтный заголовок + JSON в коротком формате)

function toAuthorFormat(root) {
  const out = {
    v: root.version ?? root.v ?? 2,
    name: root.name || "project",
    device: convertDevice(root.device || {}),
    pages: (root.pages || []).map(convertPage),
    pictures: root.pictures || [],
    fonts: root.fonts || [],
    gmovs: root.gmovs || []
  };
  if (root.bindings && root.bindings.length) out.bindings = root.bindings;
  if (root.arduino) out.arduino = root.arduino;
  if (root.github) out.github = root.github;
  return out;
}

function convertDevice(d) {
  const out = {
    id: d.id || "",
    name: d.name || "",
    w: d.w ?? d.width ?? 800,
    h: d.h ?? d.height ?? 480,
    rot: d.rot ?? d.rotation ?? 0,
    mcu: d.mcu || "ESP32-S3",
    display: d.display || {},
    touch: d.touch || {},
    uart: d.uart || d.hostUart || {},
    blOn: d.blOn ?? d.backlightOn ?? 1,
    wifiSsid: d.wifiSsid || "",
    wifiPass: d.wifiPass || ""
  };
  if (d.series) out.series = d.series;
  if (d.vendor) out.vendor = d.vendor;
  if (d.colorDepth !== undefined) out.colorDepth = d.colorDepth;
  if (d.shape) out.shape = d.shape;
  if (d.notes) out.notes = d.notes;
  return out;
}

function convertPage(p) {
  const out = {
    id: p.id ?? 0,
    name: p.name || p.objname || ("page" + (p.id ?? 0)),
    bco: p.bco ?? 0,
    sta: p.sta ?? 1,
    pic: p.pic ?? 0,
    ev: p.ev || p.events || { preinit: "", timer: "" },
    c: (p.c || p.components || []).map(convertComp)
  };
  if (p.uid) out.uid = p.uid;
  if (p.locked !== undefined) out.locked = p.locked;
  return out;
}

function convertComp(c) {
  const out = {
    t: c.t || c.type || "text",
    n: c.n || c.objname || "",
    id: c.id ?? 0,
    ev: c.ev || c.events || { press: "", release: "", preinit: "", timer: "" },
    x: c.x ?? 0,
    y: c.y ?? 0,
    w: c.w ?? 10,
    h: c.h ?? 10,
    vis: c.vis ?? 1,
    sta: c.sta ?? 1,
    transp: c.transp ?? 0,
    txt: c.txt || "",
    font: c.font ?? 1,
    pco: c.pco ?? 65535,
    bco: c.bco ?? 0,
    pco2: c.pco2 ?? 65535,
    bco2: c.bco2 ?? 2390,
    style: c.style ?? 0,
    xcen: c.xcen ?? 1,
    ycen: c.ycen ?? 1,
    pic: c.pic ?? 0,
    pic2: c.pic2 ?? 0
  };
  const extras = ["val", "minval", "maxval", "wid", "hig", "fco", "txt2",
                  "tim", "en", "vscope", "isbr", "pw", "picc", "lenth",
                  "format", "gdh", "gdw", "gdc", "cropx", "cropy", "path", "from", "nostd"];
  for (const k of extras) if (c[k] !== undefined) out[k] = c[k];
  if (c.uid) out.uid = c.uid;
  return out;
}

export function packEhmi(json) {
  const authorJson = toAuthorFormat(json);
  const jsonStr = JSON.stringify(authorJson);
  console.log("PACKED_JSON:", jsonStr);  // <-- добавить
  const jsonBytes = new TextEncoder().encode(jsonStr);
  const out = new Uint8Array(32 + jsonBytes.length);
  out[0] = 0x45; out[1] = 0x48; out[2] = 0x4D; out[3] = 0x49;
  const len = jsonBytes.length;
  out[12] = len & 0xFF;
  out[13] = (len >> 8) & 0xFF;
  out[14] = (len >> 16) & 0xFF;
  out[15] = (len >> 24) & 0xFF;
  out.set(jsonBytes, 32);
  return out;
}