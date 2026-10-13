/* Arranque de la aplicación: autenticación, shell y rutas. */
import { api } from "./api.js";
import { h, clear, initials, toast } from "./utils.js";
import { icon } from "./icons.js";
import { loader, formModal, openModal } from "./ui.js";
import { renderAuth } from "./views/auth.js";
import renderHome from "./views/home.js";
import renderGarage from "./views/garage.js";
import renderCollection from "./views/collection.js";
import renderTimeline from "./views/timeline.js";
import renderMemories from "./views/memories.js";
import renderStats from "./views/stats.js";
import renderCar from "./views/car.js";
import { parseRoute, onRefresh, navigate } from "./router.js";
import { openCarForm } from "./car-forms.js";

const app = document.getElementById("app");
const appName = "Mi Historia sobre Ruedas";

const NAV_DESKTOP = [
  { path: "/inicio", label: "Inicio", icon: "home" },
  { path: "/garaje", label: "Mi garaje", icon: "garage" },
  { path: "/coleccion", label: "Colección", icon: "collection" },
  { path: "/timeline", label: "Línea de tiempo", icon: "timeline" },
  { path: "/recuerdos", label: "Recuerdos", icon: "heart" },
  { path: "/estadisticas", label: "Estadísticas", icon: "chart" },
];

const NAV_MOBILE = [
  { path: "/inicio", label: "Inicio", icon: "home" },
  { path: "/garaje", label: "Garaje", icon: "garage" },
  null, // botón central: agregar auto
  { path: "/timeline", label: "Historia", icon: "timeline" },
  { path: "/recuerdos", label: "Recuerdos", icon: "heart" },
];

let user = null;
let routeReady = false;

boot();

async function boot() {
  try {
    const { user: me } = await api.get("/api/auth/me");
    user = me;
    buildShell();
  } catch (err) {
    if (err.status === 401) {
      showAuth();
    } else {
      app.replaceChildren(
        h("div", { class: "loader" }, h("div", { class: "spinner" }),
          h("button", { class: "btn btn-primary", onclick: () => boot() }, "Reintentar conexión")));
    }
  }
}

function showAuth() {
  routeReady = false;
  document.title = `${appName} — ingreso`;
  app.replaceChildren(renderAuth((me) => {
    user = me;
    buildShell();
  }));
}

function handleLogout() {
  api.post("/api/auth/logout").catch(() => {});
  toast("Cerraste sesión. Tus recuerdos siguen guardados.");
  showAuth();
}

function buildShell() {
  document.title = appName;

  const sidebar = h("aside", { class: "sidebar" },
    navBrand(),
    h("nav", { class: "nav" }, NAV_DESKTOP.map((item) =>
      h("button", { class: "nav-item", dataset: { route: item.path }, onclick: () => navigate(item.path) },
        icon(item.icon), item.label))),
    h("div", { class: "sidebar-foot" },
      userChip(),
      h("button", { class: "btn btn-ghost btn-block", onclick: handleLogout }, icon("logout"), "Cerrar sesión")));

  const topbar = h("header", { class: "topbar" },
    h("div", { class: "brand", style: { padding: 0 } },
      h("div", { class: "brand-mark", style: { width: "36px", height: "36px", borderRadius: "11px" } }, icon("car")),
      h("div", { class: "brand-text" }, h("b", {}, "Mi Historia sobre Ruedas"))));

  const viewEl = h("div", { class: "view", id: "view" });
  const main = h("main", { class: "main" }, topbar, viewEl);

  const bottom = h("nav", { class: "bottom-nav" },
    NAV_MOBILE.map((item) =>
      item === null
        ? h("button", { class: "bn-item fab", title: "Sumar un auto", onclick: () => openCarForm() },
            h("span", { class: "fab-btn" }, icon("plus")), "Agregar")
        : h("button", { class: "bn-item", dataset: { route: item.path }, onclick: () => navigate(item.path) },
            icon(item.icon), item.label)));

  const shell = h("div", { class: "shell" }, sidebar, main, bottom);
  app.replaceChildren(shell);

  window.addEventListener("hashchange", () => routeReady && renderRoute());
  onRefresh(() => routeReady && renderRoute());
  routeReady = true;
  renderRoute();
}

function navBrand() {
  return h("div", { class: "brand" },
    h("div", { class: "brand-mark" }, icon("car")),
    h("div", { class: "brand-text" },
      h("b", {}, "Mi Historia sobre Ruedas"),
      h("span", {}, "álbum automotor")));
}

function userChip() {
  const chip = h("button", { class: "user-chip", onclick: openProfileModal },
    h("div", { class: "avatar" },
      user.avatar ? h("img", { src: user.avatar, alt: user.name, style: { width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" } }) : initials(user.name)),
    h("div", { style: { minWidth: 0, textAlign: "left" } },
      h("div", { class: "u-name" }, user.name),
      h("div", { class: "u-mail" }, "editar perfil")));
  return chip;
}

function openProfileModal() {
  formModal({
    title: "Tu perfil",
    subtitle: "Así te ve tu álbum.",
    submitLabel: "Guardar perfil",
    size: "narrow",
    fields: [
      { name: "name", label: "Nombre", type: "text", value: user.name, required: true },
      { name: "avatar", label: "Foto de perfil", type: "photo", value: user.avatar, hintPicker: "Opcional. La vas a ver en el menú." },
    ],
    onSubmit: async (values) => {
      const res = await api.patch("/api/auth/profile", values);
      user = res.user;
      toast("Perfil actualizado.");
      buildShell();
    },
  });
}

/* ------------------------------ rutas ---------------------------------- */

const ROUTES = {
  inicio: renderHome,
  garaje: renderGarage,
  coleccion: renderCollection,
  timeline: renderTimeline,
  recuerdos: renderMemories,
  estadisticas: renderStats,
  auto: renderCar,
};

function renderRoute() {
  const route = parseRoute();
  const viewEl = document.getElementById("view");
  if (!viewEl) return;

  const factory = ROUTES[route.name];
  const ctx = {
    user,
    navigate,
    refresh: () => renderRoute(),
    route,
  };

  clear(viewEl);
  if (!factory) {
    viewEl.appendChild(h("div", { class: "view" }, renderHome(ctx)));
  } else {
    viewEl.appendChild(factory(ctx, route.param));
  }
  setActiveNav(route.name);
}

function setActiveNav(name) {
  const map = { inicio: "/inicio", garaje: "/garaje", coleccion: "/coleccion",
    timeline: "/timeline", recuerdos: "/recuerdos", estadisticas: "/estadisticas", auto: null };
  const target = map[name] || (name === "auto" ? "/coleccion" : null);
  document.querySelectorAll("[data-route]").forEach((el) => {
    el.classList.toggle("active", el.dataset.route === target);
  });
}

window.addEventListener("error", (event) => {
  if (import.meta && event.message) console.error("Error de frontend:", event.message);
});