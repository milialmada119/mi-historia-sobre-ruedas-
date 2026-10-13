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

## Estructura

```
.
├── app.py                # Servidor HTTP (http.server) + rutas estáticas y API
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

---

Hecho con 💙 y cero dependencias. [Ver un auto, subir una foto, recordarlo].