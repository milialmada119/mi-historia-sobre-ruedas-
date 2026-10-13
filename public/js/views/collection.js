/* Mi colección de autos: todos, con filtros por estado. */
import { api } from "../api.js";
import { h, plural } from "../utils.js";
import { icon } from "../icons.js";
import { loader, emptyState } from "../ui.js";
import { carCard, sectionHead } from "../components.js";
import { openCar } from "../router.js";
import { openCarForm } from "../car-forms.js";

export default function renderCollection(ctx) {
  const view = h("div", {}, loader());
  api.cars("all")
    .then(({ cars }) => {
      const all = cars;
      const current = cars.filter((c) => c.status === "current");
      const sold = cars.filter((c) => c.status === "sold");
      let filter = "all";

      const tabs = h("div", { class: "tabs" },
        tabDef("all", "Todos", all.length),
        tabDef("current", "Lo tengo", current.length),
        tabDef("sold", "Anteriores", sold.length));

      const grid = h("div", { class: "grid grid-cars" });

      function paint() {
        const list = filter === "current" ? current : filter === "sold" ? sold : all;
        grid.replaceChildren();
        if (!list.length) {
          grid.appendChild(emptyState({
            iconName: "car",
            title: filter === "sold" ? "Todavía no vendiste ninguno" : filter === "current" ? "No tenés autos cargados" : "Tu colección espera su primer auto",
            text: filter === "all"
              ? "Cada auto que pasó por tu vida merece una ficha. Sumá el primero y empezá a construir tu historia."
              : "Cuando sumes autos, los vas a encontrar acá.",
            action: h("button", { class: "btn btn-primary", onclick: () => openCarForm() }, icon("plus"), "Sumar un auto"),
          }));
        } else {
          for (const c of list) grid.appendChild(carCard(c, openCar));
        }
        for (const t of tabs.children) t.classList.toggle("active", t.dataset.filter === filter);
      }

      function tabDef(key, label, count) {
        return h("button", { class: "tab", dataset: { filter: key }, onclick: () => { filter = key; paint(); } },
          label, h("span", { class: "count" }, String(count)));
      }

      view.replaceChildren(
        sectionHead("mi colección", "Mi colección de autos",
          `${plural(all.length, "vehículo forma", "vehículos forman")} parte de tu historia sobre ruedas.`,
          [h("button", { class: "btn btn-primary", onclick: () => openCarForm() }, icon("plus"), "Sumar un auto")]),
        tabs,
        grid);
      paint();
    })
    .catch((err) => {
      view.replaceChildren(emptyState({ iconName: "alert", title: "No pudimos cargar la colección", text: err.message }));
    });
  return view;
}