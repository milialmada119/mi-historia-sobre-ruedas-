# 🚗 Mi Historia sobre Ruedas

Tu álbum automotriz personal: guardá, ordená y recordá **todos los autos que tuviste** — con fotos, modificaciones (antes/después), un diario personal por auto, línea de tiempo, estadísticas y recuerdos destacados.

Sin dependencias externas: **Python 3.10+ solo con la biblioteca estándar** y JavaScript vanilla (sin frameworks, sin npm, sin node).

---

## Características

- **Mi garaje actual** — solo los autos que seguís teniendo, con su foto principal.
- **Colección histórica** — todos tus autos, actuales y vendidos. Los vendidos no se borran: quedan diferenciados visualmente pero siempre consultables.
- **Ficha por auto** — marca, modelo, año, color, apodo, período de propiedad, descripción personal y estado.
- **Modificaciones** — cada cambio con categoría (llantas, pintura, motor, suspensión, escape, interior, audio, accesorios, performance, otras), fecha, descripción y **fotos de antes/después**.
- **"Mi historia con este auto"** — un diario en forma de guía, no de formulario: cómo llegó, tu primera modificación, los mejores recuerdos, qué significó y, si lo vendiste, la despedida. Más entradas libres con fecha y fotos.
- **Línea de tiempo** — de tu primer auto al último, con fechas, modificaciones clave y un recuerdo destacado.
- **Estadísticas** — total de autos, actuales, vendidos, primer vehículo, conteos de modificaciones/recuerdos/fotos, marca más repetida, categorías favoritas.
- **Recuerdos destacados y "Un recuerdo de hoy"** — revive lo que pasó un día como hoy.
- **Cuenta personal** — registro e inicio de sesión con contraseña protegida (`scrypt`), sesión por cookie HttpOnly. Tus datos sobreviven al cierre de sesión.
- **Autocompletar la ficha por VIN** — ingresás el VIN del auto y se completan marca, modelo, año, motor y más, usando la API pública de la NHTSA (sin API key).
- **Asistente de escritura con IA** — te ayuda a redactar un borrador de cada recuerdo, mejorar lo que escribiste, proponer un título y resumir la ficha del auto. Configurable con tu proveedor (OpenAI, Anthropic, Gemini, Groq, OpenRouter u Ollama local); la API key vive solo en el servidor.

## Requisitos

- **Python 3.10 o superior** (desarrollado y probado en 3.14).
- Sin librerías de terceros — solo la stdlib.

## Cómo ejecutarlo

```bash
python3 app.py                 # http://127.0.0.1:8000
```

Opciones útiles:

```bash
python3 app.py --port 9000     # puerto distinto
python3 app.py --host 0.0.0.0  # accesible desde la red local
```

Abrí la URL que imprime en la terminal, creá tu cuenta y empezá a cargar tu primer auto. 🏁

## Integraciones

### Ficha del auto por VIN (sin API key)

En el formulario de un auto, ingresá el VIN (17 caracteres) y el backend consulta la API pública de la [NHTSA vPIC](https://vpic.nhtsa.dot.gov/api/) para completar marca, modelo, año, carrocería, motor y combustible. No requiere configuración ni key. La consulta externa la hace el servidor, no el navegador.

### Asistente de escritura con IA (opcional)

Te ayuda a **redactar un borrador** de cada recuerdo, **mejorar** lo que ya escribiste, **proponer un título** para el recuerdo y **resumir la ficha** del auto (una descripción personal escrita a partir de sus datos, sus modificaciones y sus recuerdos). Se activa definiendo variables de entorno **antes** de arrancar el servidor:

| Variable | Valores | Default |
|---|---|---|
| `MHSR_AI_PROVIDER` | `openai` · `groq` · `openrouter` · `anthropic` · `gemini` · `ollama` | `openai` |
| `MHSR_AI_KEY` | tu API key del proveedor | — |
| `MHSR_AI_MODEL` | modelo a usar | según proveedor |
| `MHSR_AI_URL` | URL base alternativa (OpenAI-compatible local, etc.) | según proveedor |
| `MHSR_AI_TIMEOUT` | segundos de espera | `40` |

> **Alternativa recomendada:** en vez de pasar todo por la línea de comandos, copiá `.env.example` a `.env` (`cp .env.example .env`), completá la key ahí y arrancá normal con `python3 app.py`. El servidor lee `.env` al iniciar (lo que ya exista en el entorno pisa al archivo) y ese archivo **no se versiona**. Así no repetís la key en cada arranque ni queda en el historial de la shell.

```bash
# OpenAI
MHSR_AI_PROVIDER=openai MHSR_AI_KEY=sk-... python3 app.py

# Anthropic
MHSR_AI_PROVIDER=anthropic MHSR_AI_KEY=sk-ant-... python3 app.py

# Gemini
MHSR_AI_PROVIDER=gemini MHSR_AI_KEY=AIza... python3 app.py

# Ollama local (sin key)
MHSR_AI_PROVIDER=ollama MHSR_AI_MODEL=llama3.1 python3 app.py
```

> **La key nunca viaja al navegador.** El frontend le pide a este backend y el backend habla con el proveedor. Sin `MHSR_AI_KEY` (y sin proveedor local) el asistente aparece desactivado, con un mensaje que explica cómo activarlo.

## Estructura

```
.
├── app.py                # Servidor HTTP (http.server) + rutas estáticas y API
├── .env.example          # Plantilla de variables de entorno (IA) — copiar a .env
├── mhsr/
│   ├── api.py            # Endpoints REST (autos, fotos, mods, diario, stats…)
│   ├── auth.py           # Hashing scrypt + tokens de sesión
│   └── db.py             # Esquema SQLite + rutas de datos
└── public/               # Frontend (SPA vanilla JS, hash routing)
    ├── index.html
    ├── css/styles.css
    └── js/
        ├── app.js        # Shell, router y arranque de sesión
        ├── views/        # Inicio, garaje, colección, timeline, recuerdos, stats, ficha de auto
        └── ...           # API client, componentes, formularios, iconos, utilidades
```

## Datos

Todo se guarda localmente en `data/` (creada automáticamente al primer arranque):

```
data/
├── mhsr.db       # Base SQLite (usuarios, autos, modificaciones, diario)
└── uploads/      # Fotos subidas (redimensionadas en el navegador)
```

> Esta carpeta está en `.gitignore`: no se versiona. Al clonar el repo en otra máquina, basta con `python3 app.py` y el esquema se recrea solo.

## Seguridad (resumen)

- Contraseñas con `hashlib.scrypt` + salt por usuario.
- Sesiones con token aleatorio opaco en cookie `HttpOnly; SameSite=Lax`.
- Límite de 24 MB por request; las imágenes se redimensionan a ≤1800 px (JPEG ~0.86) en el navegador antes de subirlas.
- Toda mutación exige sesión activa (401 en caso contrario).
- Las API keys de IA se leen de variables de entorno y quedan **solo en el servidor**; el navegador nunca las recibe.

---

Hecho con 💙 y cero dependencias. [Ver un auto, subir una foto, recordarlo].