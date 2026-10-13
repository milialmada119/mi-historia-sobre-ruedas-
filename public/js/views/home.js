/* Inicio: saludo, recuerdo de hoy, resumen y vista previa del garaje. */
import { api } from "../api.js";
import { h, formatDate, plural } from "../utils.js";
import { icon } from "../icons.js";
import { loader, emptyState } from "../ui.js";
import { carCard, statCard } from "../components.js";
import { openCar, navigate } from "../router.js";
import { openCarForm } from "../car-forms.js";

export default function renderHome(ctx) {
  const view = h("div", {}, loader("Cargando tu historia…"));
  load(view, ctx);
  return view;
}

async function load(view, ctx) {
  const [memoryRes, statsRes, garageRes, featuredRes] = await Promise.allSettled([
    api.memoryToday(),
    api.stats(),
    api.garage(),
    api.featured(3),
  ]);
  const memory = memoryRes.status === "fulfilled" ? memoryRes.value.memory : null;
  const stats = statsRes.status === "fulfilled" ? statsRes.value : null;
  const garage = garageRes.status === "fulfilled" ? garageRes.value.cars : [];
  const featuredRaw = featuredRes.status === "fulfilled" ? featuredRes.value : { memories: [], photos: [] };
  const featured = [
    ...(featuredRaw.memories || []),
    ...(featuredRaw.photos || []).map((p) => ({
      kind: "photo", car_id: p.car_id, brand: p.brand, model: p.model,
      path: p.path, body: `Una foto favorita de tu ${p.brand} ${p.model}.`, section: "favorita",
    })),
  ].slice(0, 3);

  const firstName = (ctx.user.name || "").split(/\s+/)[0];
  const cards = garage.slice(0, 4).map((c) => carCard(c, openCar));

  view.replaceChildren(h("div", {},
    heroSection(firstName, garage, stats),
    memorySection(memory, ctx),
    stats ? statsSection(stats) : null,
    garageSection(garage, cards),
    featured.length ? featuredSection(featured) : null,
  ));
}

/* ------------------------------ secciones ------------------------------- */

function heroSection(firstName, garage, stats) {
  return h("section", { class: "hero", style: { marginBottom: "26px" } },
    h("div", { class: "hero-glow" }),
    h("div", { class: "hero-inner" },
      h("div", { class: "eyebrow" }, "tu álbum automotor"),
      h("h1", {}, `${firstName}, cada auto que tuviste `, h("br"), "cuenta algo de vos."),
      h("p", {}, "Guardá las fotos, las modificaciones y los recuerdos de todos los autos que formaron parte de tu vida. Acá viven, aunque ya no estén en tu garaje."),
      h("div", { style: { display: "flex", gap: "11px", marginTop: "24px", flexWrap: "wrap" } },
        h("button", { class: "btn btn-primary", onclick: () => openCarForm() }, icon("plus"), "Sumar un auto"),
        h("button", { class: "btn btn-ghost", onclick: () => navigate("/coleccion") }, icon("collection"), "Ver mi colección"))),
    h("div", { class: "hero-road" }));
}

function statsSection(stats) {
  return h("section", { style: { marginBottom: "30px" } },
    h("div", { class: "grid grid-stats" },
      statCard({ iconName: "car", label: "Autos en total", value: stats.total, foot: "a lo largo de tu vida" }),
      statCard({ iconName: "garage", label: "En mi garaje", value: stats.current, accent: "accent-blue", foot: stats.current === 1 ? "tu compañero actual" : "los que te acompañan hoy" }),
      statCard({ iconName: "flag", label: "Vendidos", value: stats.sold, foot: stats.sold ? "vendidos, pero no olvidados" : "todavía no dijiste un hasta luego" }),
      statCard({ iconName: "wrench", label: "Modificaciones", value: stats.modifications, foot: "cambios registrados" })));
}

function garageSection(garage, cards) {
  const head = h("div", { class: "card-head", style: { marginBottom: "16px" } },
    h("div", {}, h("h2", {}, "Mi garaje actual"),
      h("p", {}, garage.length ? plural(garage.length, "auto que te acompaña hoy", "autos que te acompañan hoy") : "Todavía no cargaste ningún auto")),
    garage.length ? h("button", { class: "btn btn-ghost btn-sm", onclick: () => navigate("/garaje") }, "Ver todos") : null);

  const body = garage.length
    ? h("div", { class: "grid grid-cars" }, cards)
    : emptyState({
        iconName: "garage",
        title: "Tu garaje está esperando",
        text: "Esos fierros que tuviste (y los que tenés) merecen un lugar. Empezá cargando el primero.",
        action: h("button", { class: "btn btn-primary", onclick: () => openCarForm() }, icon("plus"), "Agregar mi primer auto"),
      });

  return h("section", {}, head, body);
}

function featuredSection(featured) {
  const cards = featured.map((entry) => {
    const cover = entry.photos?.[0]?.path || entry.path || entry.car_photo;
    return h("article", { class: "card", style: { cursor: "pointer" }, onclick: () => openCar(entry.car_id) },
      h("div", { style: { aspectRatio: "16/9", overflow: "hidden", background: "#0a0f16" } },
        h("img", { src: cover || "", alt: "", loading: "lazy", style: { width: "100%", height: "100%", objectFit: "cover" } })),
      h("div", { class: "card-pad" },
        entry.title ? h("h3", { style: { margin: "0 0 6px", fontSize: "16px" } }, entry.title) : null,
        h("p", { style: { margin: "0", color: "#c3d1e4", fontSize: "13.5px", lineHeight: "1.65", fontStyle: "italic" } },
          entry.body && entry.body.length > 170 ? `${entry.body.slice(0, 170)}…` : (entry.body || "")),
        h("div", { style: { marginTop: "12px", fontSize: "12.5px", color: "var(--faint)", display: "flex", gap: "8px", alignItems: "center" } },
          icon("car"), `${entry.brand} ${entry.model}`)));
  });

  return h("section", { style: { marginTop: "34px" } },
    h("div", { class: "card-head", style: { marginBottom: "16px" } },
      h("div", {}, h("h2", {}, "Recuerdos destacados"),
        h("p", {}, "Los momentos que elegiste para que no se borren")),
      h("button", { class: "btn btn-ghost btn-sm", onclick: () => navigate("/recuerdos") }, "Ver todos")),
    h("div", { class: "grid grid-cars" }, cards));
}

/* --------------------------- recuerdo de hoy ---------------------------- */

function memorySection(memory, ctx) {
  if (!memory) {
    return h("section", { style: { marginBottom: "30px" } },
      sectionTitle("Un recuerdo de hoy", "Algo de tu historia, para hoy"),
      h("div", { class: "prompt-card", style: { cursor: "default" } },
        h("h4", {}, icon("sparkles"), "Tu primer recuerdo todavía no existe"),
        h("p", {}, "Sumá un auto, escribí un recuerdo o cargá una foto y este rincón empezará a traerte momentos de tu historia: tal vez algo que pasó un día como hoy.")));
  }

  const photo = memory.photos?.[0]?.path || memory.car_photo;
  const kindLabel = {
    story: "tu historia",
    modification: "una modificación",
    car: "un auto",
  }[memory.kind] || "tu historia";

  return h("section", { style: { marginBottom: "30px" } },
    sectionTitle("Un recuerdo de hoy", "Algo de tu historia, para hoy"),
    h("div", { class: "memory-today" },
      photo
        ? h("div", { class: "mt-media", onclick: () => openCar(memory.car_id), style: { cursor: "pointer" } },
            h("img", { src: photo, alt: "" }))
        : null,
      h("div", { class: "mt-body" },
        h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
          h("span", { class: "badge badge-blue" }, icon("sparkles"), kindLabel),
          memory.on_this_day ? h("span", { class: "badge badge-amber" }, icon("calendar"), "Tal día como hoy") : null),
        h("blockquote", {}, memoryBody(memory)),
        h("div", { style: { display: "flex", gap: "12px", alignItems: "center", marginTop: "4px", flexWrap: "wrap" } },
          h("span", { style: { color: "var(--faint)", fontSize: "13px", display: "inline-flex", gap: "6px", alignItems: "center" } },
            icon("car"), `${memory.brand} ${memory.model}`),
          memory.date ? h("span", { style: { color: "var(--faint)", fontSize: "13px", display: "inline-flex", gap: "6px", alignItems: "center" } },
            icon("calendar"), formatDate(memory.date, "long")) : null),
        h("button", { class: "btn btn-ghost btn-sm", style: { alignSelf: "flex-start", marginTop: "6px" },
            onclick: () => openCar(memory.car_id) },
          "Ver este auto", icon("chevron")))));
}

function memoryBody(memory) {
  if (memory.kind === "car") return `Tal día como hoy llegó ${memory.brand} ${memory.model} a tu vida.`;
  return memory.body || (memory.title ? memory.title : "Un momento guardado en tu historia.");
}

function sectionTitle(title, subtitle) {
  return h("div", { class: "card-head", style: { marginBottom: "12px" } },
    h("div", {}, h("h2", { style: { fontSize: "19px" } }, title), h("p", {}, subtitle)));
}