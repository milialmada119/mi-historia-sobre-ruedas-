/* Componentes visuales reutilizables. */
import { h, formatDate, periodOf, plural, lightbox } from "./utils.js";
import { icon } from "./icons.js";

export function statusBadge(status, { dot = true } = {}) {
  const current = status === "current";
  return h("span", { class: `badge ${current ? "badge-current" : "badge-sold"}` },
    dot ? h("span", { class: "badge-dot" }) : null,
    current ? "Lo tengo" : "Vendido");
}

export function carCard(car, onOpen) {
  const media = h("div", { class: "car-media" });
  if (car.photo) {
    media.appendChild(h("img", { src: car.photo, alt: `${car.brand} ${car.model}`, loading: "lazy" }));
  } else {
    media.appendChild(h("div", { class: "no-photo" }, icon("car"), h("span", {}, "Todavía sin foto")));
  }
  media.appendChild(h("div", { class: "car-badges" }, statusBadge(car.status)));
  if (car.favorite) {
    media.appendChild(h("div", { class: "car-fav" },
      h("span", { class: "badge badge-amber", title: "Auto destacado" }, icon("star"))));
  }

  return h("article", { class: "car-card", onclick: () => onOpen(car.id), tabindex: "0",
      onkeydown: (e) => { if (e.key === "Enter") onOpen(car.id); } },
    media,
    h("div", { class: "car-body" },
      h("div", { class: "car-title" }, car.nickname || `${car.brand} ${car.model}`),
      h("div", { class: "car-sub" }, [car.nickname ? `${car.brand} ${car.model}` : null, car.year ? `${car.year}` : null]
        .filter(Boolean).join(" · ")),
      car.status === "sold" && car.period ? h("div", { class: "car-quote" }, `Fue mío: ${car.period}`) : null,
      h("div", { class: "car-meta" },
        h("span", {}, icon("calendar"), periodOf(car)),
        h("span", {}, icon("wrench"), plural(car.modifications || 0, "modificación", "modificaciones")),
        h("span", {}, icon("book"), plural(car.memories || 0, "recuerdo", "recuerdos")))));
}

export function statCard({ iconName, label, value, suffix, foot, accent = "" }) {
  return h("div", { class: `stat ${accent}`.trim() },
    h("div", { class: "stat-label" }, icon(iconName), label),
    h("div", { class: "stat-value" }, String(value), suffix ? h("small", {}, ` ${suffix}`) : null),
    foot ? h("div", { class: "stat-foot" }, foot) : null);
}

export function sectionHead(eyebrow, title, subtitle, actions) {
  return h("div", { class: "page-head" },
    h("div", {}, eyebrow ? h("div", { class: "eyebrow" }, eyebrow) : null,
      h("h1", {}, title), subtitle ? h("p", {}, subtitle) : null),
    actions ? h("div", { style: { display: "flex", gap: "10px", flexWrap: "wrap" } }, actions) : null);
}

export function cardHead(title, subtitle, actions) {
  return h("div", { class: "card-head" },
    h("div", {}, h("h2", {}, title), subtitle ? h("p", {}, subtitle) : null),
    actions || null);
}

export function photoTile({ src, caption, favorite, onFavorite, onDelete, onView, badgeText }) {
  return h("div", { class: "photo-tile" },
    h("img", { src, alt: caption || "", loading: "lazy", onclick: () => (onView ? onView(src) : lightbox(src)) }),
    badgeText ? h("div", { class: "ba-tag after", style: { zIndex: 3 } }, badgeText) : null,
    caption ? h("div", { class: "photo-caption" }, caption) : null,
    (onFavorite || onDelete) ? h("div", { class: "tile-bar" },
      onFavorite ? h("button", {
        class: `tile-btn ${favorite ? "on" : ""}`, title: favorite ? "Quitar de destacadas" : "Marcar como favorita",
        onclick: (e) => { e.stopPropagation(); onFavorite(); },
      }, icon("star")) : null,
      onDelete ? h("button", {
        class: "tile-btn danger", title: "Eliminar foto",
        onclick: (e) => { e.stopPropagation(); onDelete(); },
      }, icon("trash")) : null) : null);
}

export function barList(items, { labelKey = "label", valueKey = "value", formatLabel } = {}) {
  const max = Math.max(1, ...items.map((i) => i[valueKey]));
  return h("div", {}, items.map((item) =>
    h("div", { class: "bar-row" },
      h("div", { class: "bar-label" }, formatLabel ? formatLabel(item[labelKey]) : item[labelKey]),
      h("div", { class: "bar-track" },
        h("div", { class: "bar-fill", style: { width: `${Math.round((item[valueKey] / max) * 100)}%` } })),
      h("div", { class: "bar-val" }, String(item[valueKey])))));
}

export function fact(label, value) {
  return h("div", { class: "fact" }, h("span", {}, label), h("b", {}, value || "—"));
}

export function memoryCard(entry, onOpenCar) {
  const photo = (entry.photos && entry.photos[0]) ? entry.photos[0].path : entry.car_photo;
  return h("article", { class: "card", style: { cursor: onOpenCar ? "pointer" : "default" },
      onclick: () => onOpenCar && onOpenCar(entry.car_id) },
    photo ? h("div", { style: { aspectRatio: "16/9", overflow: "hidden", background: "#0a0f16" } },
      h("img", { src: photo, alt: "", loading: "lazy", style: { width: "100%", height: "100%", objectFit: "cover" } })) : null,
    h("div", { class: "card-pad" },
      h("div", { style: { display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center", marginBottom: "10px" } },
        h("span", { class: "badge badge-blue" }, sectionLabel(entry.section)),
        entry.featured ? h("span", { class: "badge badge-amber" }, icon("star"), "Destacado") : null),
      entry.title ? h("h3", { style: { margin: "0 0 8px", fontSize: "16.5px" } }, entry.title) : null,
      h("p", { style: { margin: "0", color: "#c3d1e4", fontSize: "14px", lineHeight: "1.7" } },
        (entry.body || "").length > 220 ? `${entry.body.slice(0, 220)}…` : entry.body || ""),
      h("div", { style: { marginTop: "14px", display: "flex", gap: "10px", alignItems: "center", fontSize: "12.5px", color: "var(--faint)" } },
        h("span", {}, icon("calendar"), formatDate(entry.date, "short")),
        h("span", {}, icon("car"), `${entry.brand} ${entry.model}`))));
}

export const SECTIONS = {
  origen: { label: "Cómo llegó a mi vida", icon: "key" },
  primera_modificacion: { label: "Mi primera modificación", icon: "wrench" },
  mejores_recuerdos: { label: "Mis mejores recuerdos", icon: "heart" },
  significado: { label: "Lo que significó para mí", icon: "sparkles" },
  despedida: { label: "Una despedida especial", icon: "flag" },
  libre: { label: "Página libre", icon: "book" },
};

export function sectionLabel(section) {
  return (SECTIONS[section] || SECTIONS.libre).label;
}

export const CATEGORIES = {
  llantas: { label: "Llantas", icon: "gauge" },
  pintura: { label: "Pintura", icon: "droplet" },
  motor: { label: "Motor", icon: "spark" },
  suspension: { label: "Suspensión", icon: "sliders" },
  escape: { label: "Escape", icon: "spark" },
  interior: { label: "Interior", icon: "car" },
  audio: { label: "Audio", icon: "sliders" },
  accesorios: { label: "Accesorios", icon: "tag" },
  performance: { label: "Performance", icon: "spark" },
  otras: { label: "Otras", icon: "wrench" },
};

export function categoryLabel(key) {
  return (CATEGORIES[key] || CATEGORIES.otras).label;
}
