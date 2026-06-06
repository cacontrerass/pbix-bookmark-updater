# pbix-bookmark-updater-core

Migración de `Scripts_v2/` a TypeScript puro. Procesa archivos `.pbix` (Power BI)
actualizando sus bookmarks sin abrir Power BI Desktop. Equivale funcionalmente a
la app de escritorio Python en `Scripts_v2/`.

## Correr la CLI

```bash
npm run dev -- --source ./input --target ./output --mes-nuevo Nov --anio-nuevo 2026L --meses-bytd "Ene,Feb,Mar,Abr,May,Jun,Jul,Ago,Sep,Oct" --period-column "Mes corto" --year-column "Año" --taxonomy es_short_only
```

## Correr tests

```bash
# Una vez
npm test

# Modo watch
npm run test:watch
```

Los tests de paridad (`tests/parity.test.ts`) comparan el output de la versión TS
contra el de la versión Python. Los `.pbix` de referencia van en
`tests/fixtures/input/` y `tests/fixtures/expected/` — **no se versionan en git**
(están en `.gitignore`). Solo se versionan los `.gitkeep` de esas carpetas.

Coloca los `.pbix` de muestra en `tests/fixtures/input/` y ejecuta la app Python
(`Scripts_v2/`) para generar el output esperado en `tests/fixtures/expected/`
antes de correr los tests de paridad.

## Build

```bash
npm run build
```

Compila a `dist/`.
