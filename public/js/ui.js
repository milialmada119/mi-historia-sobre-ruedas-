/* Modales, constructores de formularios y selectores de imágenes. */
import { h, filesToImages, lightbox } from "./utils.js";
import { icon } from "./icons.js";

/* ------------------------------- modales -------------------------------- */

export function openModal({ title, subtitle, content, footer, size = "", onMount }) {
  const overlay = h("div", { class: "modal-overlay" });
  const modal = h("div", { class: `modal ${size}`.trim(), onclick: (e) => e.stopPropagation() });

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    document.body.style.overflow = "";
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };

  modal.appendChild(
    h("div", { class: "modal-head" },
      h("div", {}, h("h2", {}, title), subtitle ? h("p", {}, subtitle) : null),
      h("button", { class: "modal-close", onclick: close, title: "Cerrar", "aria-label": "Cerrar" }, icon("x")))
  );
  const body = h("div", { class: "modal-body" });
  body.appendChild(content);
  modal.appendChild(body);
  if (footer) modal.appendChild(footer);
  overlay.appendChild(modal);
  overlay.addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.style.overflow = "hidden";
  document.body.appendChild(overlay);
  if (onMount) onMount(body);
  return { close, modal, body };
}

/* --------------------------- selector de imágenes ----------------------- */

export function imagePicker({ multiple = false, value = null, hint = "" } = {}) {
  let items = multiple ? [...(value || [])] : value ? [value] : [];
  const grid = h("div", { class: "preview-grid" });
  const input = h("input", { type: "file", accept: "image/*", multiple, style: { display: "none" } });
  const zoneText = h("div", {},
    h("b", {}, multiple ? "Sumar fotografías" : "Elegir una fotografía"),
    h("small", {}, hint || "Arrastrá las imágenes o hacé clic para buscarlas · JPG, PNG o WEBP"));

  const zone = h("div", { class: "dropzone", onclick: () => input.click() },
    icon("camera"), zoneText, input);

  ["dragenter", "dragover"].forEach((ev) =>
    zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("drag"); }));
  ["dragleave", "drop"].forEach((ev) =>
    zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("drag"); }));
  zone.addEventListener("drop", (e) => addFiles(e.dataTransfer.files));

  input.addEventListener("change", () => {
    addFiles(input.files);
    input.value = "";
  });

  async function addFiles(files) {
    const urls = await filesToImages(files);
    if (!urls.length) return;
    items = multiple ? [...items, ...urls] : [urls[urls.length - 1]];
    render();
  }

  function render() {
    grid.replaceChildren();
    if (!items.length) return;
    items.forEach((src, index) => {
      grid.appendChild(
        h("div", { class: "preview-item" },
          h("img", { src, alt: "", onclick: () => lightbox(src) }),
          h("button", {
            type: "button", title: "Quitar",
            onclick: () => { items.splice(index, 1); render(); },
          }, "×"))
      );
    });
  }
  render();

  return {
    node: h("div", {}, zone, grid),
    get: () => (multiple ? [...items] : items[0] || null),
    set: (v) => { items = multiple ? [...(v || [])] : v ? [v] : []; render(); },
  };
}

/* --------------------------- formulario genérico ------------------------ */

/**
 * Construye un formulario dentro de un modal a partir de una definición de campos.
 * Cada campo: { name, label, type, value, options, placeholder, hint, half, required, rows }
 * type: text | number | date | textarea | select | switch | photo | photos | static
 */
export function formModal({
  title, subtitle, fields = [], submitLabel = "Guardar", size = "",
  onSubmit, extraFoot = null, intro = null,
}) {
  const controls = new Map();
  const body = h("div", {});
  if (intro) body.appendChild(intro);

  let row = null;
  const flush = () => { if (row) { body.appendChild(row); row = null; } };

  for (const def of fields) {
    if (def.type === "static") {
      flush();
      body.appendChild(def.node);
      continue;
    }
    const control = buildControl(def);
    controls.set(def.name, control);
    const wrapper = h("div", { class: "field" },
      def.label ? h("label", {}, def.label, def.required ? h("span", { style: { color: "var(--blue-light)" } }, " *") : null) : null,
      control.node,
      def.hint ? h("div", { class: "hint" }, def.hint) : null);

    if (def.half) {
      if (!row) row = h("div", { class: "row" });
      row.appendChild(wrapper);
      if (row.childElementCount === 2) flush();
    } else {
      flush();
      body.appendChild(wrapper);
    }
  }
  flush();

  const error = h("div", { class: "form-error", style: { display: "none" } });
  body.prepend(error);

  const submitBtn = h("button", { class: "btn btn-primary", onclick: (e) => { e.preventDefault(); submit(); } },
    icon("check"), submitLabel);
  const cancelBtn = h("button", { class: "btn btn-ghost", onclick: (e) => { e.preventDefault(); ref.close(); } }, "Cancelar");
  const footer = h("div", { class: "modal-foot" }, extraFoot, cancelBtn, submitBtn);

  const form = h("form", { onsubmit: (e) => { e.preventDefault(); submit(); } }, body);
  const ref = openModal({ title, subtitle, content: form, footer, size });

  function collect() {
    const values = {};
    for (const [name, control] of controls) values[name] = control.get();
    return values;
  }

  async function submit() {
    error.style.display = "none";
    const values = collect();
    for (const def of fields) {
      if (def.required && !String(values[def.name] ?? "").trim()) {
        error.textContent = `Completá el campo «${def.label}».`;
        error.style.display = "block";
        return;
      }
    }
    submitBtn.disabled = true;
    submitBtn.textContent = "Guardando…";
    try {
      const result = await onSubmit(values);
      ref.close();
      return result;
    } catch (err) {
      error.textContent = err.message || "No pudimos guardar los cambios.";
      error.style.display = "block";
      submitBtn.disabled = false;
      submitBtn.replaceChildren(icon("check"), document.createTextNode(submitLabel));
    }
  }

  const first = body.querySelector("input:not([type=file]), textarea, select");
  if (first) setTimeout(() => first.focus(), 60);

  return { ...ref, collect, submit };
}

function buildControl(def) {
  const value = def.value ?? def.default ?? "";

  switch (def.type) {
    case "textarea": {
      const input = h("textarea", { class: "textarea", placeholder: def.placeholder || "", rows: def.rows || 4 });
      input.value = value || "";
      return { node: input, get: () => input.value.trim() || null };
    }
    case "select": {
      const input = h("select", { class: "select" });
      for (const opt of def.options || []) {
        const option = h("option", { value: opt.value }, opt.label);
        if (String(opt.value) === String(value)) option.selected = true;
        input.appendChild(option);
      }
      return { node: input, get: () => input.value || null };
    }
    case "switch": {
      const input = h("input", { type: "checkbox" });
      input.checked = Boolean(value);
      const node = h("div", { class: "switch-row" },
        h("div", { class: "txt" }, h("b", {}, def.label), def.hint ? h("span", {}, def.hint) : null),
        h("label", { class: "switch" }, input, h("span", { class: "track" })));
      return { node, get: () => input.checked };
    }
    case "photo":
    case "photos": {
      const picker = imagePicker({
        multiple: def.type === "photos",
        value: def.type === "photos" ? value || [] : value || null,
        hint: def.hintPicker,
      });
      return picker;
    }
    case "number": {
      const input = h("input", { class: "input", type: "number", value: value || "", placeholder: def.placeholder || "", min: def.min, max: def.max });
      return { node: input, get: () => (input.value === "" ? null : Number(input.value)) };
    }
    case "date": {
      const input = h("input", { class: "input", type: "date", value: value || "" });
      return { node: input, get: () => input.value || null };
    }
    default: {
      const input = h("input", { class: "input", type: def.type || "text", value: value || "", placeholder: def.placeholder || "", autocomplete: def.autocomplete || "off" });
      return { node: input, get: () => input.value.trim() || null };
    }
  }
}

/* ------------------------------- variados ------------------------------- */

export function loader(text = "Cargando…") {
  return h("div", { class: "loader" }, h("div", { class: "spinner" }), h("span", {}, text));
}

export function emptyState({ iconName = "car", title, text, action }) {
  return h("div", { class: "empty" },
    h("div", { class: "em-icon" }, icon(iconName)),
    h("h3", {}, title),
    text ? h("p", {}, text) : null,
    action || null);
}
