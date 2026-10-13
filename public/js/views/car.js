/* Ficha completa de un vehículo: datos, modificaciones, historia y fotos. */
import { api } from "../api.js";
import { h, formatDate, plural, lightbox, toast, confirmDialog } from "../utils.js";
import { icon } from "../icons.js";
import { loader, emptyState, imagePicker } from "../ui.js";
import { statusBadge, sectionLabel, categoryLabel, SECTIONS, CATEGORIES, fact, photoTile, cardHead } from "../components.js";
import { navigate } from "../router.js";
import { openCarForm, openModForm, openStoryForm } from "../car-forms.js";

export default function renderCar(ctx, id) {
  const view = h("div", {});
  const state = { car: null, tab: "ficha", err: null };

  load().catch((err) => {
    state.err = err;
    view.replaceChildren(emptyState({
      iconName: "alert",
      title: "No pudimos abrir esa ficha",
      text: err.message,
      action: h("button", { class: "btn btn-ghost", onclick: () => navigate("/coleccion") }, icon("arrowLeft"), "Volver a mi colección"),
    }));
  });

  async function load() {
    state.car = await api.car(id);
    paint();
  }

  function paint() {
    if (!state.car) return;
    view.replaceChildren(hero(), tabs(), tabContent());
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function reload() {
    try {
      state.car = await api.car(id);
      paint();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  /* ------------------------------- hero -------------------------------- */
  function hero() {
    const car = state.car;
    const cover = car.photo || car.photos[0]?.path || null;
    const coverNode = cover
      ? h("img", { src: cover, alt: `${car.brand} ${car.model}`, onclick: () => lightbox(cover) })
      : h("div", { style: { position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--faint)" } },
          icon("car"), h("span", { style: { marginTop: "12px", fontSize: "14px" } }, "Este auto todavía espera su foto"));

    const actions = h("div", { class: "detail-actions" },
      h("button", { class: "btn btn-primary", onclick: () => openCarForm(car).then(() => reload()) },
        icon("edit"), "Editar ficha"),
      car.status === "current"
        ? h("button", { class: "btn btn-ghost", onclick: () => markSold() }, icon("flag"), "Marcar como vendido")
        : h("button", { class: "btn btn-ghost", onclick: () => markCurrent() }, icon("refresh"), "Volvió al garaje"),
      h("button", { class: `btn ${car.favorite ? "btn-primary" : "btn-ghost"}`, onclick: toggleFavorite },
        icon("star"), car.favorite ? "Destacado" : "Destacar"),
      h("button", { class: "btn btn-danger", onclick: () => remove() }, icon("trash"), "Eliminar"));

    const facts = h("div", { class: "detail-facts" });
    facts.append(
      fact("Marca", car.brand), fact("Modelo", car.model), fact("Año", car.year || "—"),
      fact("Color", car.color || "—"),
      fact("Lo compré", car.purchase_date ? formatDate(car.purchase_date, "long") : "—"),
      fact("Lo vendí", car.sold_date ? formatDate(car.sold_date, "long") : (car.status === "current" ? "sigue conmigo" : "—")),
      fact("Período", car.period));

    return h("section", { class: "detail-hero" },
      h("div", { class: "detail-cover" },
        coverNode,
        h("div", { class: "detail-cover-bar" },
          h("button", { class: "btn btn-ghost btn-sm", onclick: () => navigate("/coleccion"), style: { backdropFilter: "blur(10px)" } },
            icon("arrowLeft"), "Colección"),
          h("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
            statusBadge(car.status),
            car.favorite ? h("span", { class: "badge badge-amber" }, icon("star"), "Destacado") : null))),
      h("div", { class: "detail-info" },
        h("div", { class: "sub" }, `${car.brand} ${car.model}` + (car.year ? ` · ${car.year}` : "")),
        h("h1", {}, car.nickname || `${car.brand} ${car.model}`),
        actions,
        facts));
  }

  /* ------------------------------- tabs -------------------------------- */
  function tabs() {
    const counts = state.car.counts;
    const defs = [
      ["ficha", "Ficha", "list", null],
      ["mods", "Modificaciones", "wrench", counts.modifications],
      ["historia", "Historia", "book", counts.memories],
      ["fotos", "Fotos", "image", counts.photos],
    ];
    const bar = h("div", { class: "tabs" });
    for (const [key, label, ic, count] of defs) {
      bar.appendChild(h("button", { class: `tab ${state.tab === key ? "active" : ""}`, onclick: () => { state.tab = key; paint(); } },
        icon(ic), label, count !== null ? h("span", { class: "count" }, String(count)) : null));
    }
    return bar;
  }

  function tabContent() {
    if (state.tab === "mods") return modsTab();
    if (state.tab === "historia") return historiaTab();
    if (state.tab === "fotos") return photosTab();
    return fichaTab();
  }

  /* ----------------------------- acciones ------------------------------ */
  async function markSold() {
    const ok = await confirmDialog({
      title: "¿Lo vendiste?",
      message: "No pasa nada: el auto queda guardado en tu colección histórica con todo — fotos, modificaciones y recuerdos. Solo se marca como anterior.",
      confirmLabel: "Sí, lo vendí",
    });
    if (!ok) return;
    const today = new Date().toISOString().slice(0, 10);
    state.car = await api.updateCar(id, { status: "sold", sold_date: today });
    toast("Anotado. Ese auto ya es parte de tu historia.");
    paint();
  }

  async function markCurrent() {
    const ok = await confirmDialog({
      title: "¿Volvió al garaje?",
      message: "Lo marcamos como tu auto actual de nuevo.",
      confirmLabel: "Sí, lo tengo",
    });
    if (!ok) return;
    state.car = await api.updateCar(id, { status: "current" });
    toast("De nuevo en el garaje actual.");
    paint();
  }

  async function toggleFavorite() {
    state.car = await api.updateCar(id, { favorite: state.car.favorite ? 0 : 1 });
    paint();
  }

  async function remove() {
    const ok = await confirmDialog({
      title: "Eliminar este auto para siempre",
      message: "Se van a borrar sus fotos, modificaciones y recuerdos. Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar definitivamente",
      danger: true,
    });
    if (!ok) return;
    await api.deleteCar(id);
    toast("Auto eliminado de tu historia.");
    navigate("/coleccion");
  }

  /* ------------------------------ ficha -------------------------------- */
  function fichaTab() {
    const car = state.car;

    const specs = h("div", { class: "detail-facts", style: { border: "none", padding: "0 0 18px", marginTop: "0" } });
    specs.append(
      fact("Marca", car.brand), fact("Modelo", car.model), fact("Año", car.year || "—"),
      fact("Color", car.color || "—"), fact("Apodo", car.nickname || "—"),
      fact("Comprado", car.purchase_date ? formatDate(car.purchase_date, "long") : "—"),
      fact("Vendido", car.sold_date ? formatDate(car.sold_date, "long") : (car.status === "current" ? "sigue conmigo" : "—")),
      fact("Estado", car.status === "current" ? "En mi garaje" : "En mi colección histórica"));

    const description = h("p", { style: { color: "#c3d1e4", lineHeight: "1.75", fontSize: "14.5px" } },
      car.description || h("em", { style: { color: "var(--faint)" } },
        "Todavía no escribiste por qué este auto importa. Contalo en la pestaña Historia."));

    const leftCard = h("div", { class: "card card-pad" },
      cardHead("La ficha", "Los datos de este vehículo"),
      specs,
      h("label", { style: { fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--faint)" } }, "Descripción personal"),
      car.color ? h("div", {}, colorChip(car.color)) : null,
      description);

    // Mini lista de modificaciones destacadas
    const modRows = car.modifications.slice(0, 3).map((m) => {
      const cat = CATEGORIES[m.category] || CATEGORIES.otras;
      return h("div", { style: { display: "flex", gap: "10px", alignItems: "center", padding: "9px 0", borderTop: "1px solid var(--line-soft)" } },
        h("div", { class: "mod-icon", style: { width: "34px", height: "34px", borderRadius: "10px" } }, icon(cat.icon)),
        h("div", { style: { flex: 1, minWidth: 0 } },
          h("div", { style: { fontSize: "14px", fontWeight: 600 } }, m.title || cat.label),
          h("div", { style: { fontSize: "12px", color: "var(--faint)" } },
            `${m.date ? ` · ${formatDate(m.date, "year")}` : ""}`)));
    });

    const modsCard = h("div", { class: "card card-pad", style: { marginBottom: "18px", cursor: "pointer" },
        onclick: () => { state.tab = "mods"; paint(); } },
      cardHead("Lo que le hice", "Modificaciones y personalizaciones",
        h("span", { class: "badge badge-blue" }, plural(car.counts.modifications, "cambio", "cambios"))));

    if (car.modifications.length) {
      modRows.forEach((row) => modsCard.appendChild(row));
    } else {
      modsCard.appendChild(h("p", { style: { color: "var(--faint)", fontSize: "13.5px", fontStyle: "italic", margin: "12px 0 0" } },
        "Llantas, pintura, motor, escape… todo lo que le cambiaste, con el antes y el después."));
    }
    modsCard.appendChild(h("div", { style: { marginTop: "14px" } },
      h("button", { class: "btn btn-ghost btn-sm", onclick: (e) => { e.stopPropagation(); openModForm(id).then(() => reload()); } },
        icon("plus"), "Agregar modificación")));

    const storyCard = h("div", { class: "card card-pad", style: { cursor: "pointer" },
        onclick: () => { state.tab = "historia"; paint(); } },
      cardHead("Lo que viví con él", "Recuerdos y experiencias",
        h("span", { class: "badge badge-blue" }, plural(car.counts.memories, "recuerdo", "recuerdos"))),
      h("p", { style: { color: "var(--muted)", lineHeight: "1.65", fontSize: "14px", margin: 0 } },
        "Cómo llegó, tu primera modificación, los mejores viajes, lo que significó y — si lo vendiste — una despedida especial. Este es el diario del auto."),
      h("div", { style: { marginTop: "14px" } },
        h("button", { class: "btn btn-primary btn-sm", onclick: (e) => { e.stopPropagation(); openStoryForm(id).then(() => reload()); } },
          icon("book"), "Escribir un recuerdo")));

    return h("div", { class: "grid grid-2" },
      leftCard,
      h("div", {}, modsCard, storyCard));
  }

  /* --------------------------- modificaciones --------------------------- */
  function modsTab() {
    const car = state.car;
    const list = car.modifications.map((m) => {
      const before = m.before || [];
      const after = m.after || [];
      const cat = CATEGORIES[m.category] || CATEGORIES.otras;

      const titleRow = h("div", { style: { display: "flex", gap: "9px", alignItems: "center", flexWrap: "wrap" } },
        h("h3", { style: { margin: 0, fontSize: "16.5px" } }, m.title || "Modificación"),
        h("span", { class: "badge badge-blue" }, cat.label),
        m.date
          ? h("span", { style: { fontSize: "12.5px", color: "var(--faint)", display: "inline-flex", gap: "6px", alignItems: "center" } },
              icon("calendar"), formatDate(m.date, "long"))
          : null);

      const description = m.description
        ? h("p", { style: { margin: "8px 0 0", color: "var(--muted)", fontSize: "13.5px", lineHeight: "1.6" } }, m.description)
        : null;

      const headRow = h("div", { class: "mod-head" },
        h("div", { class: "mod-icon" }, icon(cat.icon)),
        h("div", { style: { flex: 1, minWidth: 0 } }, titleRow, description),
        h("div", { style: { display: "flex", gap: "7px" } },
          h("button", { class: "btn btn-ghost btn-icon", title: "Editar", onclick: () => openModForm(id, m).then(() => reload()) }, icon("edit")),
          h("button", { class: "btn btn-danger btn-icon", title: "Eliminar", onclick: () => deleteMod(m) }, icon("trash"))));

      const article = h("article", { class: "mod-card" }, headRow);

      if (before.length || after.length) {
        article.appendChild(baColumn("before", "Antes", before));
        article.appendChild(baColumn("after", "Después", after));
      }
      return article;
    });

    const header = h("div", { class: "card-head", style: { marginBottom: "16px" } },
      h("div", {}, h("h2", {}, "Modificaciones"),
        h("p", {}, "Cada cambio que le hiciste, con su antes y su después.")),
      h("button", { class: "btn btn-primary", onclick: () => openModForm(id).then(() => reload()) }, icon("plus"), "Agregar modificación"));

    let body;
    if (car.modifications.length) {
      body = h("div", { style: { display: "grid", gap: "18px" } }, list);
    } else {
      body = emptyState({
        iconName: "wrench",
        title: "Todavía no hubo modificaciones",
        text: "Pero seguro algo le hiciste: unas llantas, un cambio de pintura, un escape… Registralo y el antes y el después va a quedar en la historia.",
        action: h("button", { class: "btn btn-primary", onclick: () => openModForm(id).then(() => reload()) }, icon("plus"), "Registrar la primera"),
      });
    }
    return h("div", {}, header, body);
  }

  function baColumn(kind, label, photos) {
    const col = h("div", { class: "ba-col" });
    col.appendChild(h("span", { class: `ba-tag ${kind}` }, label));
    if (photos.length) {
      const photo = photos[0];
      col.appendChild(h("img", {
        src: photo.path, alt: label, loading: "lazy",
        onclick: () => lightbox(photo.path),
        style: { width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block", cursor: "zoom-in" },
      }));
    } else {
      col.appendChild(h("div", { class: "ba-empty" }, `Sin foto del ${label.toLowerCase()}`));
    }
    return h("div", { class: "before-after" }, col);
  }

  async function deleteMod(m) {
    const ok = await confirmDialog({ title: "Eliminar modificación", message: `Se van a borrar «${m.title}» y sus fotos.`, confirmLabel: "Eliminar", danger: true });
    if (!ok) return;
    await api.deleteMod(m.id);
    toast("Modificación eliminada.");
    reload();
  }

  /* ------------------------------ historia ------------------------------ */
  function historiaTab() {
    const car = state.car;
    const entries = car.story || [];
    const guided = [
      "origen", "primera_modificacion", "mejores_recuerdos", "significado", "despedida",
    ];

    return h("div", {},
      h("div", { class: "card-head", style: { marginBottom: "16px" } },
        h("div", {}, h("h2", {}, "Mi historia con este auto"),
          h("p", {}, "Un diario personal, en tus palabras.")),
        h("button", { class: "btn btn-primary", onclick: () => openStoryForm(id).then(() => reload()) }, icon("book"), "Escribir un recuerdo")),

      // secciones guiadas
      h("div", { class: "story-grid", style: { marginBottom: "10px" } },
        guided.map((section) => {
          const def = SECTIONS[section];
          const those = entries.filter((e) => e.section === section);
          if (those.length) {
            return h("div", {}, those.map((e) => storyCard(e, def)));
          }
          return h("div", { class: "prompt-card", onclick: () => openStoryForm(id, null, section).then(() => reload()) },
            h("h4", {}, icon(def.icon), def.label),
            h("p", {}, promptText(section)));
        })),

      // página libre
      (() => {
        const libre = entries.filter((e) => e.section === "libre");
        if (!libre.length) return null;
        return h("div", { style: { marginTop: "26px" } },
          h("div", { class: "card-head", style: { marginBottom: "13px" } },
            h("div", {}, h("h2", {}, "Página libre"),
              h("p", {}, "Anotaciones espontáneas sobre este auto"))),
          h("div", { class: "story-grid" }, libre.map((e) => storyCard(e, SECTIONS.libre))));
      })());
  }

  function storyCard(entry, def) {
    const p = entry.photos || [];
    return h("article", { class: `story-card ${entry.featured ? "featured" : ""}` },
      h("div", { style: { display: "flex", gap: "9px", alignItems: "center", flexWrap: "wrap", marginBottom: "10px" } },
        h("span", { class: "badge badge-blue" }, icon(def.icon), def.label),
        entry.featured ? h("span", { class: "badge badge-amber" }, icon("star"), "Destacado") : null,
        h("button", { class: "btn btn-ghost btn-sm", style: { marginLeft: "auto" }, title: entry.featured ? "Quitar destacado" : "Destacar este recuerdo", onclick: () => toggleFeatured(entry) },
          icon("star"))),
      entry.title ? h("h4", {}, entry.title) : null,
      entry.date ? h("div", { class: "date" }, icon("calendar"), formatDate(entry.date, "long")) : null,
      h("div", { class: `story-body${entry.body ? "" : " empty"}` }, entry.body || "Sin texto aún."),
      p.length ? h("div", { class: "story-photos" }, p.map((photo) =>
        h("img", { src: photo.path, alt: "", loading: "lazy", onclick: () => lightbox(photo.path) }))) : null,
      h("div", { style: { display: "flex", gap: "8px", marginTop: "16px" } },
        h("button", { class: "btn btn-ghost btn-sm", onclick: () => openStoryForm(id, entry).then(() => reload()) }, icon("edit"), "Editar"),
        h("button", { class: "btn btn-danger btn-sm", onclick: () => deleteStory(entry) }, icon("trash"), "Eliminar")));
  }

  async function toggleFeatured(entry) {
    await api.updateStory(entry.id, { featured: entry.featured ? 0 : 1 });
    reload();
  }

  async function deleteStory(entry) {
    const ok = await confirmDialog({ title: "Eliminar recuerdo", message: "Este recuerdo y sus fotos se van a borrar de la historia de este auto.", confirmLabel: "Eliminar", danger: true });
    if (!ok) return;
    await api.deleteStory(entry.id);
    toast("Recuerdo eliminado.");
    reload();
  }

  /* ------------------------------- fotos -------------------------------- */
  function photosTab() {
    const car = state.car;
    const picker = imagePicker({ multiple: true, hint: "Podés elegir varias a la vez. Se guardan al tocar el botón." });
    const saveBtn = h("button", { class: "btn btn-primary", onclick: async () => {
        const urls = picker.get();
        if (!urls.length) return;
        for (const data of urls) await api.addCarPhoto(id, { data, caption: "" });
        toast(`${plural(urls.length, "foto sumada", "fotos sumadas")} a la galería.`);
        reload();
      } }, icon("upload"), "Guardar fotos en la galería");

    return h("div", {},
      h("div", { class: "card-head", style: { marginBottom: "14px" } },
        h("div", {}, h("h2", {}, "Fotografías"),
          h("p", {}, "La galería de este auto. Marcala con estrella para destacarla.")),
        car.photos.length ? h("span", { class: "badge badge-blue" }, plural(car.photos.length, "foto", "fotos")) : null),

      h("div", { class: "card card-pad", style: { marginBottom: "20px" } },
        h("label", { style: { fontSize: "13px", fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: "11px" } }, "Sumar fotos a la galería"),
        picker.node,
        h("div", { style: { marginTop: "13px", display: "flex", gap: "9px", flexWrap: "wrap" } },
          saveBtn,
          h("button", { class: "btn btn-ghost", onclick: () => picker.set([]) }, "Limpiar"))),

      car.photos.length
        ? h("div", { class: "grid grid-photos" }, car.photos.map((p) => photoTile({
            src: p.path,
            caption: p.caption || "",
            favorite: Boolean(p.favorite),
            onView: () => lightbox(p.path),
            onFavorite: () => api.updatePhoto(p.id, { favorite: p.favorite ? 0 : 1 }).then(() => reload()),
            onDelete: () => removePhoto(p),
          })))
        : emptyState({
            iconName: "image",
            title: "La galería está vacía",
            text: "Subí las fotos que más te gustan de este auto. Las podés marcar como favoritas para que aparezcan en Recuerdos.",
          }));
  }

  async function removePhoto(p) {
    const ok = await confirmDialog({ title: "Eliminar foto", message: "Esta foto se va a borrar de la galería.", confirmLabel: "Eliminar", danger: true });
    if (!ok) return;
    await api.deletePhoto(p.id);
    toast("Foto eliminada.");
    reload();
  }

  return view;
}

/* ------------------------------ helpers -------------------------------- */
function promptText(section) {
  return {
    origen: "¿Cuándo y cómo llegó a tu vida? ¿Fue tu primer auto, una herencia, una oportunidad?",
    primera_modificacion: "¿Qué fue lo primero que le cambiaste y cómo te sentiste al verlo?",
    mejores_recuerdos: "Viajes, encuentros, momentos especiales, anécdotas inolvidables.",
    significado: "¿Por qué fue importante este vehículo para vos?",
    despedida: "Contá qué sentiste al despedirte. Las últimas palabras para ese auto.",
  }[section];
}

function colorChip(color) {
  const base = ["negro", "blanco", "gris", "plateado", "plata", "azul", "rojo", "verde", "amarillo", "naranja", "marrón", "beige", "bordo", "negro mate"];
  const map = {
    negro: "#1c2128", blanco: "#e8edf3", gris: "#79899c", plateado: "#c3cdd8", plata: "#c3cdd8",
    azul: "#3b82f6", rojo: "#ef4444", verde: "#22c55e", amarillo: "#facc15", naranja: "#f97316",
    marrón: "#8b5e3c", beige: "#d6c7a8", bordo: "#7f1d1d",
  };
  const tone = map[color.toLowerCase()] || null;
  return h("span", { class: "chip", style: tone ? { borderColor: tone + "66", color: tone } : null },
    h("span", { style: tone ? { width: "11px", height: "11px", borderRadius: "50%", background: tone, display: "inline-block" } : null }),
    color);
}