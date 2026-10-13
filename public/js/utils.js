/* Utilidades de DOM, formato y manejo de imágenes. */

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "class") el.className = value;
      else if (key === "html") el.innerHTML = value;
      else if (key === "for") el.htmlFor = value;
      else if (key === "dataset") Object.assign(el.dataset, value);
      else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
      else if (key.startsWith("on") && typeof value === "function")
        el.addEventListener(key.slice(2).toLowerCase(), value);
      else if (value === true) el.setAttribute(key, "");
      else if (key in el) el[key] = value;
      else el.setAttribute(key, value);
    }
  }
  appendChildren(el, children);
  return el;
}

export function appendChildren(parent, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false || child === true) continue;
    if (Array.isArray(child)) appendChildren(parent, child);
    else if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/* ------------------------------- formato -------------------------------- */

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export function parseDate(value) {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function formatDate(value, style = "long") {
  const d = parseDate(value);
  if (!d) return "Sin fecha";
  const y = d.getFullYear();
  if (style === "year") return String(y);
  if (style === "short") return `${MONTHS[d.getMonth()].slice(0, 3)} ${y}`;
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${y}`;
}

export function periodOf(car) {
  const start = car.purchase_date ? formatDate(car.purchase_date, "year") : "—";
  const end = car.status === "current" ? "hoy" : (car.sold_date ? formatDate(car.sold_date, "year") : "vendido");
  return `${start} — ${end}`;
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

export function initials(name) {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

/* ------------------------------ imágenes -------------------------------- */

export function fileToImage(file, { max = 1800, quality = 0.86 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      return reject(new Error("El archivo no es una imagen."));
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, max / Math.max(width, height));
      width = Math.max(1, Math.round(width * scale));
      height = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);
      const keepPng = /png/i.test(file.type) && file.size < 1_600_000;
      resolve(canvas.toDataURL(keepPng ? "image/png" : "image/jpeg", quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No pudimos leer esa imagen."));
    };
    img.src = url;
  });
}

export async function filesToImages(fileList, options) {
  const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
  const out = [];
  for (const file of files) {
    try {
      out.push(await fileToImage(file, options));
    } catch (err) {
      console.warn(err);
    }
  }
  return out;
}

/* ---------------------------- UI efímera -------------------------------- */

export function toast(message, type = "ok") {
  let root = document.getElementById("toast-root");
  if (!root) {
    root = h("div", { id: "toast-root", class: "toast-root" });
    document.body.appendChild(root);
  }
  const el = h(
    "div",
    { class: `toast ${type}` },
    h("span", { html: svgMini(type === "error" ? "alert" : "check") }),
    h("span", {}, message)
  );
  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity .3s ease, transform .3s ease";
    el.style.opacity = "0";
    el.style.transform = "translateY(8px)";
    setTimeout(() => el.remove(), 320);
  }, 3400);
}

function svgMini(name) {
  const paths = {
    check: '<path d="M20 6L9 17l-5-5"/>',
    alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
    stroke-linecap="round" stroke-linejoin="round" style="width:17px;height:17px">${paths[name] || ""}</svg>`;
}

export function lightbox(src) {
  const el = h("div", { class: "lightbox", onclick: () => el.remove() }, h("img", { src, alt: "" }));
  document.body.appendChild(el);
  const close = (e) => { if (e.key === "Escape") { el.remove(); document.removeEventListener("keydown", close); } };
  document.addEventListener("keydown", close);
}

export function confirmDialog({ title, message, confirmLabel = "Confirmar", danger = false }) {
  return new Promise((resolve) => {
    const overlay = h("div", { class: "modal-overlay" });
    const close = (value) => { overlay.remove(); resolve(value); };
    const modal = h(
      "div",
      { class: "modal narrow", onclick: (e) => e.stopPropagation() },
      h("div", { class: "modal-head" },
        h("div", {}, h("h2", {}, title), message ? h("p", {}, message) : null)),
      h("div", { class: "modal-foot" },
        h("button", { class: "btn btn-ghost", onclick: () => close(false) }, "Cancelar"),
        h("button", { class: `btn ${danger ? "btn-danger" : "btn-primary"}`, onclick: () => close(true) }, confirmLabel))
    );
    overlay.appendChild(modal);
    overlay.addEventListener("click", () => close(false));
    document.body.appendChild(overlay);
  });
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
