/* Mi garaje actual: solo los autos que se tienen hoy. */
import { api } from "../api.js";
import { h, plural } from "../utils.js";
import { icon } from "../icons.js";
import { loader, emptyState } from "../ui.js";
import { carCard, sectionHead } from "../components.js";
import { openCar } from "../router.js";
import { openCarForm } from "../car-forms.js";

export default function renderGarage(ctx) {
  const view = h("div", {}, loader());
  api.garage()
    .then(({ cars }) => {
      view.replaceChildren(
        sectionHead("mi garaje", "Mi garaje actual",
          cars.length
            ? `Estos son ${plural(cars.length, "el auto que", "los autos que")} te acompañan hoy.`
            : "Los autos que tenés hoy van a aparecer acá.",
          [h("button", { class: "btn btn-primary", onclick: () => openCarForm() }, icon("plus"), "Sumar un auto")]),
        cars.length
          ? h("div", { class: "grid grid-cars" }, cars.map((c) => carCard(c, openCar)))
          : emptyState({
              iconName: "garage",
              title: "Tu garaje está vacío",
              text: "No seas tímido: el que está durmiendo en tu cochera (o el que soñás tener) se merece su ficha.",
              action: h("button", { class: "btn btn-primary", onclick: () => openCarForm() }, icon("plus"), "Sumar mi primer auto"),
            }));
    })
    .catch((err) => {
      view.replaceChildren(emptyState({ iconName: "alert", title: "No pudimos cargar tu garaje", text: err.message }));
    });
  return view;
}