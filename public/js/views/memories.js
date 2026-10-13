/* Recuerdos destacados: lo que el usuario eligió para no olvidar. */
import { api } from "../api.js";
import { h, plural, lightbox } from "../utils.js";
import { icon } from "../icons.js";
import { loader, emptyState } from "../ui.js";
import { sectionHead, memoryCard, photoTile } from "../components.js";
import { openCar } from "../router.js";

export default function renderMemories(ctx) {
  const view = h("div", {}, loader());
  api.featured(30)
    .then(({ memories, photos }) => {
      const allEmpty = !memories.length && !photos.length;
      view.replaceChildren(
        sectionHead("recuerdos", "Recuerdos destacados",
          allEmpty
            ? "Cuando marques un recuerdo o una foto como destacados, van a vivir acá para siempre."
            : "Los momentos y las fotos que elegiste para que tu historia no se pierda.",
          [h("button", { class: "btn btn-ghost", onclick: () => ctx.navigate("/coleccion") },
            icon("collection"), "Ir a mi colección")]),

        allEmpty ? emptyState({
          iconName: "heart",
          title: "Todavía no destacaste nada",
          text: "Entrá a la ficha de un auto, escribí un recuerdo o subí una foto, y marcalos como destacados. Acá se arma tu álbum de los mejores momentos.",
        }) : h("div", {},

          memories.length ? h("div", { style: { marginBottom: "34px" } },
            h("div", { class: "card-head", style: { marginBottom: "14px" } },
              h("div", {}, h("h2", {}, "Momentos que elegiste"),
                h("p", {}, plural(memories.length, "recuerdo destacado", "recuerdos destacados"))),
              h("span", { class: "badge badge-amber" }, icon("star"), "Destacados")),
            h("div", { class: "grid grid-2" },
              memories.map((entry) => memoryCard(entry, openCar)))) : null,

          photos.length ? h("div", {},
            h("div", { class: "card-head", style: { marginBottom: "14px" } },
              h("div", {}, h("h2", {}, "Fotos favoritas"),
                h("p", {}, "Las imágenes que más te gustan de tus autos")),
              h("span", { class: "badge badge-blue" }, icon("image"), "Favoritas")),
            h("div", { class: "grid grid-photos" },
              photos.map((p) => photoTile({
                src: p.path,
                caption: p.caption || `${p.brand} ${p.model}`,
                favorite: true,
                onView: () => lightbox(p.path),
                onFavorite: () => api.updatePhoto(p.id, { favorite: false }).then(() => ctx.refresh()).catch(() => {}),
              })))) : null));
    })
    .catch((err) => {
      view.replaceChildren(emptyState({ iconName: "alert", title: "No pudimos cargar tus recuerdos", text: err.message }));
    });
  return view;
}