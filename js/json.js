// Загрузка/сохранение JSON + конвертация из короткого формата в длинный

function fromAuthorFormat(j) {
  const out = {
    version: j.v ?? j.version ?? 1,
    name: j.name || "project",
    device: convertDevice(j.device || {}),
    pages: (j.pages || []).map(convertPage),
    pictures: j.pictures || [],
    fonts: j.fonts || [],
    gmovs: j.gmovs || []
  };
  if (j.bindings) out.bindings = j.bindings;
  if (j.arduino) out.arduino = j.arduino;
  if (j.github) out.github = j.github;
  return out;
}

function convertDevice(d) {
  const out = {
    id: d.id || "",
    name: d.name || "",
    mcu: d.mcu || "ESP32-S3",
    width: d.width ?? d.w ?? 800,
    height: d.height ?? d.h ?? 480,
    rotation: d.rotation ?? d.rot ?? 0,
    display: d.display || {},
    touch: d.touch || {},
    hostUart: d.hostUart || d.uart || {},
    backlightOn: d.backlightOn ?? d.blOn ?? 1,
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
  return {
    uid: p.uid || ("p_" + Math.random().toString(36).slice(2, 8)),
    id: p.id ?? 0,
    objname: p.objname || p.name || ("page" + (p.id ?? 0)),
    bco: p.bco ?? 0,
    sta: p.sta ?? 1,
    pic: p.pic ?? 0,
    events: p.events || p.ev || { preinit: "", timer: "" },
    components: (p.components || p.c || []).map(convertComp),
    locked: p.locked || false
  };
}

function convertComp(c) {
  const out = {
    uid: c.uid || ("w_" + Math.random().toString(36).slice(2, 8)),
    type: c.type || c.t || "text",
    objname: c.objname || c.n || "",
    id: c.id ?? 0,
    events: c.events || c.ev || { press: "", release: "", preinit: "", timer: "" },
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
  return out;
}

export function loadJsonFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      try {
        const raw = JSON.parse(r.result);
        const isAuthor = raw.v !== undefined || (raw.pages && raw.pages[0] && raw.pages[0].c !== undefined);
        resolve(isAuthor ? fromAuthorFormat(raw) : raw);
      } catch (e) { reject(e); }
    };
    r.onerror = () => reject(r.error);
    r.readAsText(file);
  });
}

export function saveJsonFile(root, filename) {
  const data = JSON.stringify(root, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename || ((root.name || "project") + ".json");
  a.click();
  URL.revokeObjectURL(a.href);
}