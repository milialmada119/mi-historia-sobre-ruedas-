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
    onReady: ({ set }) => vin.wire(set),
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
      {
        name: "body", label: "Contalo con tus palabras", type: "textarea", value: entry?.body, rows: 8,
        placeholder: sectionPrompt(section),
      },
      { name: "photos", label: "Fotos de este recuerdo", type: "photos", value: (entry?.photos || []).map((p) => p.path) },
    ],
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
