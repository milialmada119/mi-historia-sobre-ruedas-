/* Enrutado por hash y refresco de la vista actual. */

const listeners = new Set();

export function onRefresh(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function refresh() {
  listeners.forEach((fn) => fn());
}

export function navigate(path) {
  const target = `#${path.startsWith("/") ? path : `/${path}`}`;
  if (location.hash === target) {
    refresh();
  } else {
    location.hash = target;
  }
}

export function openCar(id) {
  navigate(`/auto/${id}`);
}

export function currentPath() {
  return (location.hash || "#/inicio").slice(1);
}

export function parseRoute() {
  const path = currentPath();
  const parts = path.split("/").filter(Boolean);
  return { path, parts, name: parts[0] || "inicio", param: parts[1] || null };
}
