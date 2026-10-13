/* Pantalla de bienvenida: iniciar sesión o crear cuenta. */
import { api } from "../api.js";
import { h, toast } from "../utils.js";
import { icon } from "../icons.js";

const FEATURES = [
  { icon: "camera", text: "Un álbum con las fotos que más te gustan de cada auto." },
  { icon: "wrench", text: "Seguí cada modificación, con el antes y el después." },
  { icon: "book", text: "Escribí tus recuerdos como en un diario personal." },
  { icon: "timeline", text: "Mirá toda tu historia automotriz en una línea de tiempo." },
];

export function renderAuth(onSuccess) {
  let mode = "login";
  const root = h("div", { class: "auth" });

  const visual = h("section", { class: "auth-visual" },
    h("div", { class: "brand" },
      h("div", { class: "brand-mark" }, icon("car")),
      h("div", { class: "brand-text" }, h("b", {}, "Mi Historia sobre Ruedas"),
        h("span", {}, " álbum automotor personal"))),
    h("h1", {}, "Todos los autos que tuviste ", h("br"), "viven para siempre acá."),
    h("p", {}, "No es un catálogo ni un concesionario: es tu álbum. Cada vehículo con sus fotos, sus modificaciones y los recuerdos que lo hacen único."),
    h("div", { class: "auth-feats" },
      FEATURES.map((f) => h("div", { class: "auth-feat" },
        h("div", { class: "dot" }, icon(f.icon)), h("div", {}, f.text)))));

  const card = h("div", { class: "auth-card" });
  const panel = h("section", { class: "auth-panel" }, card);

  function renderCard() {
    const isLogin = mode === "login";
    const error = h("div", { class: "form-error", style: { display: "none" } });
    const nameInput = h("input", { class: "input", placeholder: "Tu nombre", autocomplete: "name" });
    const mailInput = h("input", { class: "input", type: "email", placeholder: "tucorreo@ejemplo.com", autocomplete: "email" });
    const passInput = h("input", { class: "input", type: "password", placeholder: "Al menos 6 caracteres", autocomplete: isLogin ? "current-password" : "new-password" });
    const toggle = h("button", { type: "button", class: "modal-close", style: { position: "absolute", right: "11px", top: "50%", transform: "translateY(-50%)" } }, icon("eye"));

    const submit = h("button", { class: "btn btn-primary btn-block", style: { marginTop: "6px" } },
      icon(isLogin ? "lock" : "sparkles"), isLogin ? "Entrar a mi álbum" : "Crear mi cuenta");

    let busy = false;
    async function send(event) {
      if (event) event.preventDefault();
      if (busy) return;
      error.style.display = "none";
      const email = mailInput.value.trim();
      const password = passInput.value;
      const name = nameInput.value.trim();
      if (!email || !password || (!isLogin && !name)) {
        error.textContent = "Completá todos los datos para continuar.";
        error.style.display = "block";
        return;
      }
      busy = true;
      submit.disabled = true;
      submit.textContent = isLogin ? "Entrando…" : "Creando tu cuenta…";
      try {
        const result = isLogin
          ? await api.post("/api/auth/login", { email, password })
          : await api.post("/api/auth/register", { name, email, password });
        toast(isLogin ? `¡Qué bueno verte de nuevo, ${result.user.name}!` : "¡Tu álbum está listo!");
        onSuccess(result.user);
      } catch (err) {
        error.textContent = err.message;
        error.style.display = "block";
        busy = false;
        submit.disabled = false;
        submit.replaceChildren(icon(isLogin ? "lock" : "sparkles"),
          document.createTextNode(isLogin ? "Entrar a mi álbum" : "Crear mi cuenta"));
      }
    }

    toggle.addEventListener("click", () => {
      passInput.type = passInput.type === "password" ? "text" : "password";
    });

    card.replaceChildren(
      h("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "22px" } },
        h("div", { class: "brand-mark", style: { width: "38px", height: "38px", borderRadius: "12px" } }, icon("car")),
        h("div", { class: "brand-text" }, h("b", {}, "Mi Historia sobre Ruedas"),
          h("span", {}, "álbum automotor personal"))),
      h("h2", {}, isLogin ? "Bienvenido de vuelta" : "Empezá tu álbum"),
      h("p", {}, isLogin
        ? "Ingresá para volver a recorrer tu colección y tus recuerdos."
        : "Creá tu cuenta y empezá a guardar la historia de cada auto que pasó por tu vida."),
      error,
      h("form", { onsubmit: send },
        isLogin ? null : h("div", { class: "field" }, h("label", {}, "Nombre"), nameInput),
        h("div", { class: "field" }, h("label", {}, "Correo electrónico"), mailInput),
        h("div", { class: "field" },
          h("label", {}, "Contraseña"),
          h("div", { style: { position: "relative" } },
            passInput, toggle)),
        submit),
      h("div", { class: "auth-swap" },
        isLogin ? "¿Todavía no tenés cuenta?" : "¿Ya tenés una cuenta?",
        h("button", { type: "button", onclick: () => { mode = isLogin ? "register" : "login"; renderCard(); } },
          isLogin ? "Creala acá" : "Ingresá")));
    setTimeout(() => (mode === "login" ? mailInput : nameInput).focus(), 60);
  }

  renderCard();
  root.append(visual, panel);
  return root;
}
