# Traspaso a Lovable — «Mi Historia sobre Ruedas»

Este archivo te deja todo listo para recrear la app en Lovable.

## Cómo usarlo

1. En Lovable, creá un **proyecto nuevo**.
2. Pegá el **Prompt principal** (abajo) tal cual.
3. Después pegá, de a uno, los **Prompts de seguimiento** (en orden).
4. Para la IA, seguí la nota **«La API key, segura»** al final.

> En Lovable la app se **recrea** (React + Supabase), no se copia: es otro stack. Este prompt captura pantallas, datos, diseño e integraciones para que quede lo más parecido posible.

---

## Prompt principal (pegá esto primero)

```
Creá una web app personal llamada «Mi Historia sobre Ruedas»: un álbum digital para
guardar la vida de TODOS los autos de una persona (los que tuvo, los que tiene y los
que vendió). Todo el texto de la interfaz va en español rioplatense (voseo: "vos",
"tenés"), con un tono cálido, personal y un poco nostálgico.

STACK
- React + Vite + TypeScript + Tailwind CSS.
- Supabase para Auth (email + contraseña), base de datos Postgres y Storage (fotos).
- lucide-react para los íconos.

DISEÑO (estética automotriz moderna, oscura)
- Mobile-first y 100% responsive.
- Paleta: fondo #0b0f14 y #0e141b; tarjetas #141b24; acento principal ámbar/naranja
  #ff7a1a; acento secundario azul #3b82f6; texto #e6edf3; texto suave #93a1b1;
  bordes #1f2a37.
- Bordes redondeados (16px en tarjetas), sombras suaves, mucho aire, jerarquía clara.
- Navegación: barra lateral fija en escritorio y barra inferior (bottom nav) en móvil.

AUTENTICACIÓN
- Registro e inicio de sesión con email y contraseña (Supabase Auth).
- Al registrarse, crear un perfil. Cada persona ve SOLO sus propios datos.

MODELO DE DATOS (Postgres, con Row Level Security por usuario)
- profiles (id = auth.users, name, avatar, created_at)
- cars (id, user_id, brand, model, year, nickname, color, description,
  purchase_date, sold_date, status 'current' | 'sold', photo_path,
  favorite bool, created_at, updated_at)
- car_photos (id, car_id, path, caption, taken_at, favorite, created_at)
- modifications (id, car_id, category, title, description, date, created_at)
- modification_photos (id, modification_id, path, kind 'before' | 'after', created_at)
- story_entries (id, car_id, section, title, body, date, featured bool,
  created_at, updated_at)
- story_photos (id, entry_id, path, favorite, created_at)
Aplicá RLS en todas: el dueño puede leer y modificar sólo sus filas.

PANTALLAS / NAVEGACIÓN
1) Inicio: saludo personal ("¡Hola, {nombre}!"), un "recuerdo de hoy" (una entrada
   de historia al azar), tarjetas de resumen (autos en el garaje, recuerdos, fotos) y
   una vista previa del garaje actual.
2) Mi garaje: grilla de tarjetas de los autos que la persona tiene hoy.
3) Colección: TODOS los autos, incluidos los vendidos. Los vendidos se conservan y se
   ven distintos (etiqueta "Vendido", foto en escala de grises, opacidad menor).
4) Timeline: línea de tiempo cronológica que mezcla autos, modificaciones y recuerdos,
   ordenada por fecha.
5) Recuerdos: las entradas de historia marcadas como destacadas ("Recuerdos destacados").
6) Estadísticas: totales (autos, en garaje, vendidos, modificaciones, recuerdos, fotos,
   fotos favoritas), marca más repetida y gráficos simples por marca y por categoría de
   modificación.
7) Ficha de auto (/auto/:id): un "hero" con la foto principal y los datos, y cuatro
   pestañas:
   - Ficha: datos del auto + descripción personal.
   - Modificaciones: cada modificación con fotos ANTES y DESPUÉS.
   - Historia: las entradas del diario agrupadas por sección.
   - Fotos: galería del auto.

SECCIONES DEL DIARIO (campo section de story_entries)
- origen            → "Cómo llegó a mi vida"
- primera_modificacion → "Mi primera modificación"
- mejores_recuerdos → "Mis mejores recuerdos"
- significado       → "Lo que significó para mí"
- despedida         → "Una despedida especial"
- libre             → "Página libre"

CATEGORÍAS DE MODIFICACIÓN (campo category)
llantas, pintura, motor, suspensión, escape, interior, audio, accesorios, performance, otras.

FUNCIONES CLAVE
- CRUD completo de autos, fotos, modificaciones (con fotos antes/después) y recuerdos.
- Subida de fotos con redimensionado en el navegador antes de subirlas (máximo 1800 px
  de ancho y JPEG con calidad ~0.86) y guardado en Supabase Storage.
- Marcar fotos y recuerdos como favoritos/destacados.
- Botón para buscar/filtrar y estados vacíos amables ("Tu garaje está esperando").

Arrancá con: Supabase conectado, autenticación, el modelo de datos con RLS, el diseño
oscuro y las pantallas Inicio + Garaje + Colección + Ficha de auto con sus pestañas.
```

---

## Prompts de seguimiento (pegá después, de a uno)

**1. Modificaciones, recuerdos y fotos**
```
Completá las demás pantallas y formularios: modificaciones con fotos antes/después,
recuerdos (diario) con sus 6 secciones, galería de fotos por auto, marcar
favoritos/destacados, y las pantallas Timeline, Recuerdos destacados y Estadísticas con
sus gráficos. Usá redimensionado de imágenes en el navegador antes de subir a Storage.
```

**2. Integración de VIN (sin API key)**
```
Agregá en el formulario de alta de auto un campo "Completar por VIN". Cuando se ingresan
17 caracteres válidos (letras A-Z sin I, O, Q y números), consultá la API pública de la
NHTSA vPIC:
GET https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{VIN}?format=json
y autocompletá marca (Make), modelo (Model) y año (ModelYear). Hacé la llamada desde una
Edge Function de Supabase (no desde el navegador) para evitar problemas de CORS. Mostrá
estados de "buscando", éxito y error. Esta API es pública y NO necesita clave.
```

**3. Asistente de escritura con IA**
```
Agregá un asistente de escritura con IA, en español rioplatense:
- En el formulario de recuerdo: un botón "Ayudame a escribir" (redacta un borrador si el
  campo está vacío, o mejora el texto existente conservando todos los datos y el tono) y
  un botón "Sugerir título" (propone un título breve, de 3 a 8 palabras).
- En el formulario de auto: un botón "Resumir la ficha con IA" que redacta la descripción
  personal (2-3 párrafos, en primera persona) a partir de los datos del auto, sus
  modificaciones y sus recuerdos.
Ambos con un botón "Deshacer" y un aviso visible si el asistente no está configurado.
Toda la llamada a la IA debe hacerse desde una Edge Function; la API key va como Secret.
```

**3.bis. Si querés probar sin key (modelo local)**
```
Para pruebas sin API key, usá un modelo local servido por Ollama en
http://127.0.0.1:11434/v1 (endpoint OpenAI-compatible, modelo qwen2.5:1.5b).
```
> Nota: Ollama corre en la máquina de cada uno; en la nube de Lovable no está disponible.

**4. Detalles finales**
```
Agregá los estados vacíos y de carga en todas las pantallas, confirmaciones antes de
borrar, y que todo se sienta rápido y prolijo en celular. Mantené el español rioplatense.
```

---

## La API key, segura (importante)

En Lovable **nunca** pongas la key en el código del cliente ni en variables `VITE_`
(todo lo `VITE_` termina en el navegador y queda público al publicar).

La forma correcta:
1. **Cloud → Secrets** → creá un secreto, por ejemplo `OPENAI_API_KEY` (o `GROQ_API_KEY`,
   `GEMINI_API_KEY`, etc.).
2. Pedile a Lovable una **Edge Function** que lea ese secreto con `Deno.env.get(...)` y
   haga la llamada al proveedor de IA del lado del servidor.
3. El frontend llama a esa función, nunca directo al proveedor.

Así el navegador nunca ve la key. (Es el mismo principio que ya usamos en la versión
Python: la key vive en el servidor.)

---

## Prompt cortito de referencia (si preferís arrancar simple)

```
Quiero una web app personal llamada "Mi Historia sobre Ruedas": un álbum digital para
guardar fotos, modificaciones y recuerdos de todos los autos de una persona, incluidos
los que ya vendió. Estética automotriz moderna y oscura, en español rioplantense, React +
Vite + Tailwind + Supabase (auth, base de datos y fotos). Pantallas: Inicio, Mi garaje,
Colección (con los vendidos diferenciados), Timeline, Recuerdos destacados, Estadísticas
y la ficha de cada auto con pestañas (Ficha, Modificaciones con antes/después, Historia,
Fotos). Empezá por la estructura, el diseño y las pantallas principales.
```
