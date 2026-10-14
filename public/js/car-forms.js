/* Formularios de creación y edición (autos, modificaciones, recuerdos). */
import { api } from "./api.js";
import { formModal } from "./ui.js";
import { CATEGORIES, SECTIONS, sectionLabel } from "./components.js";
import { toast, h } from "./utils.js";
import { icon } from "./icons.js";
import { navigate, refresh, openCar } from "./router.js";

const sectionOptions = Object.entries(SECTIONS).map(([value, def]) => ({ value, label: def.label }));
const categoryOptions = Object.entries(CATEGORIES).map(([value, def]) => ({ value, label: def.label }));

export async function openCarForm(car = null) {
  const editing = Boolean(car);
  const vin = vinLookup();
  const carAi = aiCarWidget(car?.id || null);
  return formModal({
    title: editing ? "Editar ficha del auto" : "Sumar un auto a mi historia",
    subtitle: editing
      ? "Actualizá los datos de este vehículo."
      : "Contanos qué auto fue y cuándo llegó a tu vida.",
    submitLabel: editing ? "Guardar cambios" : "Sumar a mi colección",
    size: "wide",
    fields: [
      { type: "static", node: vin.node },
      { name: "brand", label: "Marca", type: "text", value: car?.brand, required: true, half: true, placeholder: "Ford, Volkswagen…" },
      { name: "model", label: "Modelo", type: "text", value: car?.model, required: true, half: true, placeholder: "Mustang, Golf…" },
      { name: "year", label: "Año de fabricación", type: "number", value: car?.year, half: true, min: 1886, max: 2100, placeholder: "1987" },
      { name: "nickname", label: "Apodo (opcional)", type: "text", value: car?.nickname, half: true, placeholder: "El Rojo" },
      { name: "color", label: "Color", type: "text", value: car?.color, half: true, placeholder: "Azul noche" },
      { name: "purchase_date", label: "Fecha en que lo compré", type: "date", value: car?.purchase_date, half: true },
      {
        name: "status", label: "Estado", type: "select", value: car?.status || "current", half: true,
        options: [{ value: "current", label: "Lo tengo actualmente" }, { value: "sold", label: "Lo vendí" }],
      },
      {
        name: "sold_date", label: "Fecha en que lo vendí", type: "date", value: car?.sold_date, half: true,
        hint: "Completala solo si ya no está con vos.",
      },
      { type: "static", node: carAi.node },
      {
        name: "description", label: "Descripción personal", type: "textarea", value: car?.description, rows: 4,
        placeholder: "Qué te gusta de este auto, cómo era, qué te hace sentir al verlo…",
      },
      {
        name: "photo", label: "Foto principal", type: "photo", value: car?.photo,
        hintPicker: "Una buena foto de perfil es la que más vas a mirar. Que se luzca.",
      },
      { name: "favorite", label: "Auto destacado", type: "switch", value: car?.favorite,
        hint: "Marcalo para tenerlo siempre a mano entre tus favoritos." },
    ],
    onReady: ({ get, set }) => { vin.wire(set); carAi.wire({ get, set }); },
    onSubmit: async (values) => {
      if (editing) {
        await api.updateCar(car.id, values);
        toast("Ficha actualizada.");
        refresh();
      } else {
        const created = await api.createCar(values);
        toast("Auto sumado a tu historia. ¡A cargar los recuerdos!");
        openCar(created.id);
      }
    },
  });
}

/**
 * Widget opcional para completar la ficha a partir del VIN.
 * Consulta la API pública de la NHTSA (sin API key): el navegador pide a nuestro
 * backend y el backend hace la consulta externa, así el frontend nunca ve secretos.
 */
function vinLookup() {
  const input = h("input", {
    class: "input", placeholder: "Ej: 1HGCM82633A004352", maxlength: "17",
    autocapitalize: "characters", autocomplete: "off", spellcheck: "false",
    style: { textTransform: "uppercase", fontFamily: "ui-monospace, SFMono-Regular, monospace", letterSpacing: "0.06em" },
  });
  const button = h("button", { class: "btn btn-ghost", type: "button" }, icon("search"), "Buscar datos");
  const status = h("div", { class: "hint vin-status" });
  const node = h("div", { class: "field vin-field" },
    h("label", {}, "Completar por VIN (opcional)"),
    h("div", { class: "vin-row" }, input, button),
    h("div", { class: "hint" },
      "Ingresá el VIN (17 caracteres) y completamos marca, modelo y año. Lo encontrás en la cédula del auto o en el parabrisas."),
    status);

  let applyValue = () => {};
  const say = (text, kind = "") => { status.textContent = text; status.className = `hint vin-status ${kind}`.trim(); };

  async function search() {
    const vin = input.value.trim().toUpperCase();
    if (!vin) { say("Escribí el VIN para buscarlo.", "err"); input.focus(); return; }
    button.disabled = true;
    button.replaceChildren(icon("search"), "Buscando…");
    say("Consultando el registro de VIN…");
    try {
      const data = await api.decodeVin(vin);
      if (data.brand) applyValue("brand", data.brand);
      if (data.model) applyValue("model", data.model);
      if (data.year) applyValue("year", data.year);
      const found = [data.brand, data.model, data.year].filter(Boolean).join(" ");
      const extra = [data.trim, data.body, data.engine].filter(Boolean).join(" · ");
      say(`✓ ${found}${extra ? ` — ${extra}` : ""}`, "ok");
    } catch (err) {
      say(err.message || "No pudimos consultar ese VIN.", "err");
    } finally {
      button.disabled = false;
      button.replaceChildren(icon("search"), "Buscar datos");
    }
  }

  button.addEventListener("click", search);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); search(); }
  });

  return { node, wire: (set) => { applyValue = set; } };
}

export async function openModForm(carId, mod = null) {
  const editing = Boolean(mod);
  const beforePaths = (mod?.before || []).map((p) => p.path);
  const afterPaths = (mod?.after || []).map((p) => p.path);

  return formModal({
    title: editing ? "Editar modificación" : "Registrar una modificación",
    subtitle: "Llantas, pintura, motor, suspensión, escape, accesorios… todo cuenta.",
    submitLabel: editing ? "Guardar cambios" : "Agregar modificación",
    size: "wide",
    fields: [
      { name: "title", label: "¿Qué le hiciste?", type: "text", value: mod?.title, required: true, placeholder: "Llantas deportivas 17\"" },
      { name: "category", label: "Categoría", type: "select", value: mod?.category || "llantas", half: true, options: categoryOptions },
      { name: "date", label: "Fecha", type: "date", value: mod?.date, half: true },
      { name: "description", label: "Detalles", type: "textarea", value: mod?.description, rows: 4,
        placeholder: "Marca, medida, taller, cómo quedó, qué sentiste al verlo terminado…" },
      {
        name: "before", label: "Fotos del antes", type: "photos", value: beforePaths,
        hintPicker: "Así se veía el auto antes de este cambio.",
      },
      {
        name: "after", label: "Fotos del después", type: "photos", value: afterPaths,
        hintPicker: "El resultado final. Comparar el antes y el después es mágico.",
      },
    ],
    onSubmit: async (values) => {
      const payload = { ...values, before: values.before || [], after: values.after || [] };
      if (editing) {
        await api.updateMod(mod.id, payload);
        await syncModPhotos(mod, beforePaths, payload.before, "before");
        await syncModPhotos(mod, afterPaths, payload.after, "after");
        toast("Modificación actualizada.");
      } else {
        await api.addMod(carId, payload);
        toast("Modificación guardada.");
      }
      refresh();
    },
  });
}

/** Sincroniza altas y bajas de fotos de una modificación existente. */
async function syncModPhotos(mod, original, next, kind) {
  const kept = next.filter((src) => original.includes(src));
  const removed = original.filter((src) => !next.includes(src));
  const added = next.filter((src) => !original.includes(src));
  for (const path of removed) {
    const photo = (mod.before || []).concat(mod.after || []).find((p) => p.path === path);
    if (photo) await api.deleteModPhoto(photo.id).catch(() => {});
  }
  for (const data of added) await api.addModPhoto(mod.id, { kind, data }).catch(() => {});
}

export async function openStoryForm(carId, entry = null, presetSection = null) {
  const editing = Boolean(entry);
  const section = entry?.section || presetSection || "libre";
  const ai = aiStoryWidget(carId);
  return formModal({
    title: editing ? "Editar este recuerdo" : "Escribir un recuerdo",
    subtitle: "Un diario personal: escribí con libertad, con tus palabras, como si le contaras la historia a alguien.",
    submitLabel: editing ? "Guardar recuerdo" : "Guardar en mi historia",
    size: "wide",
    fields: [
      {
        name: "section", label: "¿De qué se trata?", type: "select", value: section,
        options: sectionOptions,
      },
      { name: "title", label: "Título (opcional)", type: "text", value: entry?.title, placeholder: "El día que lo traje a casa" },
      { name: "date", label: "Fecha del recuerdo", type: "date", value: entry?.date, half: true },
      { name: "featured", label: "Recuerdo destacado", type: "switch", value: entry?.featured, half: false,
        hint: "Lo vas a ver en «Recuerdos destacados» y en «Un recuerdo de hoy»." },
      { type: "static", node: ai.node },
      {
        name: "body", label: "Contalo con tus palabras", type: "textarea", value: entry?.body, rows: 8,
        placeholder: sectionPrompt(section),
      },
      { name: "photos", label: "Fotos de este recuerdo", type: "photos", value: (entry?.photos || []).map((p) => p.path) },
    ],
    onReady: ({ get, set }) => ai.wire({ get, set }),
    onSubmit: async (values) => {
      const payload = { ...values, photos: values.photos || [] };
      if (editing) {
        await api.updateStory(entry.id, payload);
        await syncStoryPhotos(entry, payload.photos);
        toast("Recuerdo actualizado.");
      } else {
        await api.addStory(carId, payload);
        toast("Recuerdo guardado en tu historia.");
      }
      refresh();
    },
  });
}

/**
 * Asistente de escritura con IA para los recuerdos.
 * El navegador pide a nuestro backend; el backend (con la API key en el entorno)
 * habla con el proveedor elegido.
 */
function aiStoryWidget(carId) {
  const status = h("div", { class: "hint ai-status" });
  const assist = h("button", { class: "btn btn-primary btn-sm", type: "button" }, icon("sparkles"), "Ayudame a escribir");
  const titleBtn = h("button", { class: "btn btn-ghost btn-sm", type: "button" }, icon("tag"), "Sugerir título");
  const undo = h("button", { class: "btn btn-ghost btn-sm", type: "button", style: { display: "none" } },
    icon("refresh"), "Deshacer");
  const node = h("div", { class: "field ai-field" },
    h("label", {}, "Asistente de escritura"),
    h("div", { class: "ai-row" }, assist, titleBtn, undo),
    h("div", { class: "hint" }, "La IA puede redactar un borrador, mejorar lo que escribiste o proponerte un título. Revisá el resultado: la historia es tuya."),
    status);

  let ctrl = null;
  let previous = null;
  let available = false;

  const say = (text, kind = "") => { status.textContent = text; status.className = `hint ai-status ${kind}`.trim(); };
  const setBusy = (busy, which = "") => {
    assist.disabled = busy;
    titleBtn.disabled = busy;
    assist.replaceChildren(icon("sparkles"), busy && which !== "title" ? "Pensando…" : "Ayudame a escribir");
    titleBtn.replaceChildren(icon("tag"), busy && which === "title" ? "Pensando…" : "Sugerir título");
  };
  const ready = () => {
    if (!available) { say("El asistente IA no está configurado en este servidor. Agregá MHSR_AI_KEY para activarlo.", "err"); return false; }
    return Boolean(ctrl);
  };

  async function run() {
    if (!ready()) return;
    const current = (ctrl.get("body") || "").trim();
    if (current && !window.confirm("La IA va a reemplazar el texto que escribiste. ¿Continuamos? (podés deshacerlo)")) return;
    setBusy(true, "story");
    say("Escribiendo…");
    try {
      const data = await api.aiAssist({
        task: "story", car_id: carId, section: ctrl.get("section") || "libre", text: current,
      });
      previous = current;
      ctrl.set("body", data.text);
      undo.style.display = "";
      say(`✓ ${data.mode === "improve" ? "Texto mejorado" : "Borrador listo"} con ${data.provider} · ${data.model}`, "ok");
    } catch (err) {
      say(err.message || "El asistente no pudo responder.", "err");
    } finally {
      setBusy(false);
    }
  }

  async function suggestTitle() {
    if (!ready()) return;
    setBusy(true, "title");
    say("Pensando un título…");
    try {
      const data = await api.aiAssist({
        task: "title", car_id: carId, section: ctrl.get("section") || "libre", text: (ctrl.get("body") || "").trim(),
      });
      ctrl.set("title", data.text);
      say(`✓ Título sugerido con ${data.provider} · ${data.model}`, "ok");
    } catch (err) {
      say(err.message || "El asistente no pudo responder.", "err");
    } finally {
      setBusy(false);
    }
  }

  assist.addEventListener("click", run);
  titleBtn.addEventListener("click", suggestTitle);
  undo.addEventListener("click", () => {
    if (previous === null || !ctrl) return;
    ctrl.set("body", previous);
    previous = null;
    undo.style.display = "none";
    say("Texto restaurado.");
  });

  // ¿Está configurado el asistente en este servidor?
  api.aiStatus().then((s) => {
    available = Boolean(s && s.enabled);
    if (available) say(`Disponible: ${s.provider} · ${s.model}`);
    else say("El asistente IA no está configurado. Agregá MHSR_AI_KEY en el servidor para activarlo.");
  }).catch(() => { say("No pudimos consultar el estado del asistente."); });

  return { node, wire: (c) => { ctrl = c; } };
}

/**
 * Asistente de IA que redacta la "Descripción personal" del auto a partir de
 * sus datos, sus modificaciones y sus recuerdos (tarea "summary").
 */
function aiCarWidget(carId) {
  const status = h("div", { class: "hint ai-status" });
  const button = h("button", { class: "btn btn-primary btn-sm", type: "button" }, icon("sparkles"), "Resumir la ficha con IA");
  const undo = h("button", { class: "btn btn-ghost btn-sm", type: "button", style: { display: "none" } },
    icon("refresh"), "Deshacer");
  const node = h("div", { class: "field ai-field" },
    h("label", {}, "Redactar con IA"),
    h("div", { class: "ai-row" }, button, undo),
    h("div", { class: "hint" }, "La IA escribe una descripción personal a partir de los datos, las modificaciones y los recuerdos de este auto."),
    status);

  let ctrl = null;
  let previous = null;
  let available = false;

  const say = (text, kind = "") => { status.textContent = text; status.className = `hint ai-status ${kind}`.trim(); };
  const setBusy = (busy) => {
    button.disabled = busy;
    button.replaceChildren(icon("sparkles"), busy ? "Escribiendo…" : "Resumir la ficha con IA");
  };

  async function run() {
    if (!ctrl) return;
    if (!available) { say("El asistente IA no está configurado en este servidor. Agregá MHSR_AI_KEY para activarlo.", "err"); return; }
    const current = (ctrl.get("description") || "").trim();
    if (current && !window.confirm("La IA va a reemplazar la descripción actual. ¿Continuamos? (podés deshacerlo)")) return;
    setBusy(true);
    say("Escribiendo…");
    try {
      const data = await api.aiAssist({
        task: "summary", car_id: carId,
        brand: ctrl.get("brand"), model: ctrl.get("model"),
        year: ctrl.get("year"), color: ctrl.get("color"),
      });
      previous = current;
      ctrl.set("description", data.text);
      undo.style.display = "";
      say(`✓ Descripción generada con ${data.provider} · ${data.model}`, "ok");
    } catch (err) {
      say(err.message || "El asistente no pudo responder.", "err");
    } finally {
      setBusy(false);
    }
  }

  button.addEventListener("click", run);
  undo.addEventListener("click", () => {
    if (previous === null || !ctrl) return;
    ctrl.set("description", previous);
    previous = null;
    undo.style.display = "none";
    say("Texto restaurado.");
  });

  api.aiStatus().then((s) => {
    available = Boolean(s && s.enabled);
    if (available) say(`Disponible: ${s.provider} · ${s.model}`);
    else say("El asistente IA no está configurado. Agregá MHSR_AI_KEY en el servidor para activarlo.");
  }).catch(() => { say("No pudimos consultar el estado del asistente."); });

  return { node, wire: (c) => { ctrl = c; } };
}

async function syncStoryPhotos(entry, next) {
  const original = (entry.photos || []).map((p) => p.path);
  for (const path of original) {
    if (next.includes(path)) continue;
    const photo = (entry.photos || []).find((p) => p.path === path);
    if (photo) await api.deleteStoryPhoto(photo.id).catch(() => {});
  }
  for (const data of next.filter((src) => !original.includes(src))) {
    await api.addStoryPhoto(entry.id, { data }).catch(() => {});
  }
}

function sectionPrompt(section) {
  return {
    origen: "¿Cuándo y cómo llegó este auto a tu vida? ¿Fue tu primer auto, una herencia, una oportunidad que no podías dejar pasar?",
    primera_modificacion: "¿Qué fue lo primero que le cambiaste? ¿Cómo lo decidiste y qué sentiste cuando lo viste terminado?",
    mejores_recuerdos: "Viajes, encuentros, momentos especiales, anécdotas… todo lo que viviste arriba de este auto.",
    significado: "¿Por qué fue importante este vehículo para vos? ¿Qué etapa de tu vida representa?",
    despedida: "Si lo vendiste, contá qué sentiste al despedirte. Las últimas palabras para ese auto que tanto te acompañó.",
    libre: "Escribí lo que quieras recordar de este auto…",
  }[section] || "Escribí lo que quieras recordar de este auto…";
}

export { sectionLabel };
