# Guia para levantar el proyecto

Esta aplicacion esta separada en dos partes:

- `backend`: API en Node.js, puerto `3001`.
- `frontend`: aplicacion React con Vite, puerto `5173`.

La forma recomendada de levantarla en desarrollo es abrir dos terminales desde la raiz del proyecto: una para el backend y otra para el frontend.

## Requisitos

- Node.js instalado.
- npm instalado.
- Estar situado en la raiz del proyecto, donde esta el archivo `package.json`.

Para comprobarlo:

```bash
node --version
npm --version
```

## Instalacion

Ejecutar una sola vez desde la raiz del proyecto:

```bash
npm install
```

Esto instala las dependencias de los workspaces `backend` y `frontend`.

## Levantar en Windows

Abre una terminal de PowerShell en la raiz del proyecto.

Terminal 1, backend:

```powershell
npm run dev:backend
```

Terminal 2, frontend:

```powershell
npm run dev:frontend
```

Despues abre la aplicacion en:

```text
http://127.0.0.1:5173/
```

La API queda disponible en:

```text
http://127.0.0.1:3001/
```

## Levantar en Linux

Abre una terminal en la raiz del proyecto.

Terminal 1, backend:

```bash
npm run dev:backend
```

Terminal 2, frontend:

```bash
npm run dev:frontend
```

Despues abre la aplicacion en:

```text
http://127.0.0.1:5173/
```

La API queda disponible en:

```text
http://127.0.0.1:3001/
```

## Comandos utiles

Comprobar sintaxis del backend y frontend:

```bash
npm run check
```

Generar build de produccion del frontend:

```bash
npm --workspace frontend run build
```

Previsualizar el build del frontend:

```bash
npm --workspace frontend run preview
```

## Datos y archivos generados

Las cartas comunes se guardan en:

```text
data/card.json
```

Los usuarios, colecciones y ultimas cartas obtenidas se guardan en:

```text
data/users.json
```

Las imagenes subidas al crear cartas se guardan en:

```text
assets/uploads/
```

## Notas

- El frontend usa Vite y redirige `/api` y `/assets` al backend en `http://127.0.0.1:3001`.
- Si el puerto `3001` o `5173` esta ocupado, hay que cerrar el proceso que lo este usando o cambiar el puerto en los scripts/configuracion.
- No es necesario configurar variables de entorno para desarrollo local.
