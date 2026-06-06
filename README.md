# PBIX Bookmark Updater

Herramienta web para actualizar bookmarks de archivos `.pbix` (Power BI) sin necesidad de abrir Power BI Desktop. Procesamiento 100% en el navegador — los archivos nunca salen de tu computador.

🌐 **App en vivo:** [próximamente — link de Vercel]

## ✨ Características

- ⚡ Procesamiento 100% client-side: cero uploads, cero servidor
- 📁 Trabajo con carpetas locales mediante File System Access API
- 🎯 5 reglas inteligentes por sufijo de bookmark (`_NEDIT`, `_BYTD`, `_BP-1`, `_BP-2`, normal)
- 🌍 Soporta formato legacy (`Report/Layout`) y moderno (Fabric/PBIR)
- 📊 Resumen técnico de cada lote procesado
- 🚀 Soporta archivos `.pbix` de hasta ~1 GB

## 🛠️ Stack técnico

- **Frontend:** Next.js 16 + TypeScript + Tailwind CSS + shadcn/ui
- **Procesamiento:** TypeScript + fflate (Web Worker dedicado)
- **Hosting:** Vercel
- **Compatibilidad:** Chrome, Edge, Opera, Brave, Arc (navegadores con File System Access API)

## 📦 Estructura del proyecto

├── core-migration/      # Core TypeScript de procesamiento
│   ├── src/             # Pipeline, bookmarks updater, CLI
│   └── tests/           # Tests de paridad
└── web/                 # Aplicación web Next.js
├── app/             # App Router
├── components/      # UI components (shadcn)
└── lib/             # FS Access, processing, store

## 🏃 Ejecutar localmente

```bash
npm install
npm run build --workspace=@pbix/core
npm run dev --workspace=web
```

Abre `http://localhost:3000`.

## 🧪 Tests

```bash
npm run test --workspace=@pbix/core
```

## 👤 Autor

Desarrollado por **César A. Contreras** como parte del programa **Data Champions**.

[LinkedIn](https://linkedin.com/in/tu-perfil)

## 📄 Licencia

MIT
