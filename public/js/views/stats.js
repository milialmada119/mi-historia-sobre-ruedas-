/* Estadísticas personales de la colección. */
import { api } from "../api.js";
import { h, formatDate } from "../utils.js";
import { icon } from "../icons.js";
import { loader, emptyState } from "../ui.js";
import { sectionHead, statCard, barList, fact, categoryLabel } from "../components.js";
import { openCar } from "../router.js";

export default function renderStats(ctx) {
  const view = h("div", {}, loader());
  api.stats()
    .then((s) => {
      view.replaceChildren(
        sectionHead("estadísticas", "Tu historia en números",
          "Un resumen de todo lo que viviste sobre ruedas."),

        h("div", { class: "grid grid-stats", style: { marginBottom: "26px" } },
          statCard({ iconName: "car", label: "Autos en total", value: s.total, accent: "accent-blue", foot: "vehículos en tu historia" }),
          statCard({ iconName: "garage", label: "En mi garaje", value: s.current, foot: "te acompañan hoy" }),
          statCard({ iconName: "flag", label: "Vendidos", value: s.sold, foot: "vendidos con su historia intacta" }),
          statCard({ iconName: "wrench", label: "Modificaciones", value: s.modifications, foot: "cambios registrados" }),
          statCard({ iconName: "book", label: "Recuerdos", value: s.memories, foot: "momentos escritos" }),
          statCard({ iconName: "image", label: "Fotografías", value: s.photos, foot: "imágenes guardadas" })),

        h("div", { class: "grid grid-2", style: { marginBottom: "26px" } },
          firstCarCard(s),
          h("div", { class: "card card-pad" },
            h("div", { class: "card-head" },
              h("div", {}, h("h2", {}, "La edad de tu afición"),
                h("p", {}, "De tu primer auto hasta el más reciente")),
              h("span", { class: "badge badge-blue" }, icon("layers"), "Historia")),
            h("div", { class: "grid grid-stats" },
              statCard({ iconName: "clock", label: "Primer auto", value: s.first ? formatDate(s.first.purchase_date, "year") : "—", foot: s.first ? `${s.first.brand} ${s.first.model}` : "todavía no cargaste ninguno" }),
              statCard({ iconName: "chevron", label: "Último auto", value: s.latest ? formatDate(s.latest.purchase_date, "year") : "—", foot: s.latest ? `${s.latest.brand} ${s.latest.model}` : "—" }),
              statCard({ iconName: "award", label: "Marca preferida", value: s.top_brand || "—", foot: s.brands && s.brands[0] ? `${s.brands[0].n} ${s.brands[0].n === 1 ? "auto" : "autos"}` : "—" }),
              statCard({ iconName: "heart", label: "Fotos favoritas", value: s.favorite_photos, foot: "marcadas como favoritas" })))),

        h("div", { class: "grid grid-2" },
          s.brands && s.brands.length ? h("div", { class: "card card-pad" },
            h("div", { class: "card-head" },
              h("div", {}, h("h2", {}, "Marcas en tu historia"),
                h("p", {}, "Cuántos autos tuviste de cada marca"))),
            barList(s.brands.map((b) => ({ label: b.brand, value: b.n })))) : null,
          s.categories && s.categories.length ? h("div", { class: "card card-pad" },
            h("div", { class: "card-head" },
              h("div", {}, h("h2", {}, "Lo que más modificaste"),
                h("p", {}, "Las áreas donde pusiste más cariño y herramienta"))),
            barList(s.categories.map((c) => ({ label: categoryLabel(c.category), value: c.n })))) : null));
    })
    .catch((err) => {
      view.replaceChildren(emptyState({ iconName: "alert", title: "No pudimos cargar tus estadísticas", text: err.message }));
    });
  return view;
}

function firstCarCard(s) {
  const first = s.first;
  return h("div", { class: "card", style: { cursor: first ? "pointer" : "default" },
      onclick: () => first && openCar(first.id) },
    first && first.photo
      ? h("div", { style: { aspectRatio: "16/9", overflow: "hidden", background: "#0a0f16" } },
          h("img", { src: first.photo, alt: "", style: { width: "100%", height: "100%", objectFit: "cover" } }))
      : h("div", { style: { aspectRatio: "16/9", display: "grid", placeItems: "center", background: "linear-gradient(140deg,#12203a,#0a0f16)", color: "var(--faint)" } },
          icon("car"), h("span", { style: { marginTop: "10px", fontSize: "13px" } }, "el primero de todos")),
    h("div", { class: "card-pad" },
      h("div", { style: { display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px" } },
        h("span", { class: "badge badge-blue" }, "El primero de todos")),
      h("h2", { style: { margin: "0 0 4px", fontSize: "22px", letterSpacing: "-0.5px" } },
        first ? `${first.brand} ${first.model}` : "Todavía no hay primero"),
      h("p", { style: { margin: "0", color: "var(--muted)", fontSize: "13.5px" } },
        first
          ? `Llegó el ${formatDate(first.purchase_date, "long")} y abrió esta historia. Fue el punto de partida.`
          : "Sumá tu primer auto y lo vas a ver acá, con su merecido lugar principal."),
      first ? h("div", { class: "detail-facts", style: { border: "none", padding: 0, marginTop: "16px" } },
        fact("Período", first.period),
        fact("Estado", first.status === "current" ? "Lo tengo" : "Vendido"),
        first.nickname ? fact("Apodo", first.nickname) : null) : null));
}