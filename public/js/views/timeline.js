/* Línea de tiempo: la historia automotriz completa, capítulo por capítulo. */
import { api } from "../api.js";
import { h, formatDate, plural } from "../utils.js";
import { icon } from "../icons.js";
import { loader, emptyState } from "../ui.js";
import { sectionHead, categoryLabel, statusBadge } from "../components.js";
import { openCar } from "../router.js";
import { openCarForm } from "../car-forms.js";

export default function renderTimeline(ctx) {
  const view = h("div", {}, loader());
  api.timeline()
    .then(({ stages }) => {
      if (!stages.length) {
        view.replaceChildren(
          sectionHead("línea de tiempo", "Tu historia sobre ruedas",
            "Desde el primer auto hasta el último: cada capítulo con sus fotos, sus modificaciones y sus recuerdos."),
          emptyState({
            iconName: "timeline",
            title: "La línea del tiempo está en blanco",
            text: "Sumá tu primer auto y acá se va a armar, en orden, toda tu historia automotriz.",
            action: h("button", { class: "btn btn-primary", onclick: () => openCarForm() }, icon("plus"), "Sumar mi primer auto"),
          }));
        return;
      }
      const items = stages.map((stage) => {
        const c = stage.car;
        const memory = stage.memory;
        const mods = stage.modifications.slice(0, 4);
        const sold = c.status === "sold";
        return h("div", { class: "tl-item" },
          h("div", { class: `tl-dot ${sold ? "sold" : ""}` }, String(stage.order)),
          h("article", { class: "card tl-card", style: { cursor: "pointer" },
              onclick: () => openCar(c.id) },
            h("div", { class: "tl-photo" },
              c.photo
                ? h("img", { src: c.photo, alt: `${c.brand} ${c.model}`, loading: "lazy" })
                : h("div", { style: { position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--faint)" } }, icon("car"))),
            h("div", { class: "tl-content" },
              h("div", { style: { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" } },
                h("span", { class: "tl-year" }, stage.order === 1 ? "mi primer auto" : `auto N° ${stage.order}`),
                statusBadge(c.status, { dot: false })),
              h("h3", {}, (c.nickname ? `${c.nickname} — ` : "") + `${c.brand} ${c.model}`, c.year ? h("span", { style: { color: "var(--faint)", fontWeight: 500, fontSize: "16px" } }, ` · ${c.year}`) : null),
              h("div", { style: { color: "var(--muted)", fontSize: "13.5px", display: "flex", gap: "14px", flexWrap: "wrap", alignItems: "center" } },
                h("span", { style: { display: "inline-flex", gap: "6px", alignItems: "center" } }, icon("calendar"),
                  c.purchase_date ? `Lo conseguí el ${formatDate(c.purchase_date, "long")}` : "Fecha de compra desconocida"),
                c.sold_date ? h("span", { style: { display: "inline-flex", gap: "6px", alignItems: "center" } }, icon("flag"),
                  `Lo vendí el ${formatDate(c.sold_date, "long")}`) : null),
              mods.length ? h("div", {},
                h("div", { style: { fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--faint)", fontWeight: 700, marginBottom: "7px" } },
                  plural(mods.length, "La modificación", "Las modificaciones más importantes")),
                h("div", { class: "tl-mods" },
                  mods.map((m) => h("span", { class: "chip chip-blue", title: m.description || "" },
                    icon("wrench"), `${categoryLabel(m.category)}${m.date ? ` · ${formatDate(m.date, "year")}` : ""}`)))) : null,
              memory && memory.body ? h("div", { class: "tl-memory" }, `“${truncate(memory.body, 190)}”`) : null,
              !mods.length && !memory ? h("div", { class: "tl-memory", style: { borderLeftColor: "transparent", color: "var(--faint)" } },
                "Todavía sin recuerdos cargados para este auto.") : null)));
      });
      view.replaceChildren(
        sectionHead("línea de tiempo", "Tu historia sobre ruedas",
          "Desde el primero hasta el último: fotos, modificaciones y recuerdos, en orden cronológico."),
        h("div", { class: "timeline" }, items));
    })
    .catch((err) => {
      view.replaceChildren(emptyState({ iconName: "alert", title: "No pudimos armar la línea de tiempo", text: err.message }));
    });
  return view;
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}