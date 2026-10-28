// Отправка ui.ehmi + монитор порта + отправка команд

export async function uploadToDisplay(ehmiBytes, onProgress) {
  if (!("serial" in navigator)) {
    throw new Error("Web Serial не поддерживается. Откройте в Chrome/Edge на localhost или https.");
  }
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 115200 });

  const writer = port.writable.getWriter();
  const reader = port.readable.getReader();

  const writeStr = async (s) => {
    await writer.write(new TextEncoder().encode(s));
    await writer.write(new Uint8Array([0xFF, 0xFF, 0xFF]));
  };

  const readAck = async (timeoutMs = 5000) => {
    const start = Date.now();
    let buf = "";
    while (Date.now() - start < timeoutMs) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      buf += new TextDecoder().decode(value);
      if (buf.includes("HMI+RDY") || buf.includes("HMI+ACK") ||
          buf.includes("HMI+OK") || buf.includes("HMI+ERR")) {
        if (buf.includes("HMI+ERR")) return "ERR";
        if (buf.includes("HMI+OK")) return "OK";
        if (buf.includes("HMI+RDY")) return "RDY";
        return "ACK";
      }
    }
    throw new Error("Таймаут ожидания ACK");
  };

  try {
    await writeStr("ehmi " + ehmiBytes.length);
    const first = await readAck();
    if (first === "ERR") throw new Error("Прошивка отвергла загрузку");

    const CHUNK = 1024;
    for (let i = 0; i < ehmiBytes.length; i += CHUNK) {
      const chunk = ehmiBytes.slice(i, i + CHUNK);
      await writer.write(chunk);
      const ack = await readAck();
      if (ack === "ERR") throw new Error("Ошибка при передаче данных");
      if (onProgress) onProgress(Math.min(100, Math.round((i + chunk.length) * 100 / ehmiBytes.length)));
    }
    const last = await readAck(10000);
    if (last === "ERR") throw new Error("Прошивка не приняла UI");
  } finally {
    try { reader.releaseLock(); } catch {}
    try { writer.releaseLock(); } catch {}
    try { await port.close(); } catch {}
  }
}

// ---- Monitor mode ----
let monitorPort = null;
let monitorReader = null;
let monitorWriter = null;

export async function openMonitor(onData) {
  if (monitorPort) return;
  if (!("serial" in navigator)) {
    throw new Error("Web Serial не поддерживается");
  }
  monitorPort = await navigator.serial.requestPort();
  await monitorPort.open({ baudRate: 115200 });
  monitorReader = monitorPort.readable.getReader();
  monitorWriter = monitorPort.writable.getWriter();
  (async () => {
    let buf = new Uint8Array(0);
    while (true) {
      try {
        const { value, done } = await monitorReader.read();
        if (done) break;
        if (!value) continue;
        // добавляем в буфер
        const tmp = new Uint8Array(buf.length + value.length);
        tmp.set(buf); tmp.set(value, buf.length);
        buf = tmp;
        // ищем FF FF FF
        while (true) {
          let idx = -1;
          for (let i = 0; i + 2 < buf.length; i++) {
            if (buf[i] === 0xFF && buf[i+1] === 0xFF && buf[i+2] === 0xFF) {
              idx = i; break;
            }
          }
          if (idx < 0) break;
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 3);
          if (frame.length === 0) continue;
          // показываем как hex
          const hex = Array.from(frame).map(b => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
          onData(hex);
        }
        // защита от переполнения
        if (buf.length > 1024) buf = buf.slice(-256);
      } catch (e) { break; }
    }
  })();
}

export async function sendToDisplay(cmd) {
  if (!monitorWriter) throw new Error("Monitor not open. Click 'Open monitor' first.");
  await monitorWriter.write(new TextEncoder().encode(cmd));
  await monitorWriter.write(new Uint8Array([0xFF, 0xFF, 0xFF]));
}

export async function closeMonitor() {
  try { monitorReader?.releaseLock(); } catch {}
  try { monitorWriter?.releaseLock(); } catch {}
  try { await monitorPort?.close(); } catch {}
  monitorPort = null; monitorReader = null; monitorWriter = null;
}