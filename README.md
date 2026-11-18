# tools.ezrasnotes.com

Free value investing calculators. Static site on GitHub Pages: no server, no database, everything runs in the reader's browser.

## Cómo funciona

- `tools.yaml`: la lista de herramientas de la portada, las filas de cada calculadora y el ID de Google Analytics (`ga_id`).
- `templates/`: el HTML. `base.html` lleva la cabecera, el pie y Analytics para todas las páginas.
- `static/`: el CSS (copiado de letters.ezrasnotes.com) y el JavaScript. `calc.js` es lo que comparten todas las calculadoras; `net-net.js` son solo las fórmulas del net-net.
- `tests/`: cada calculadora se compara con los resultados de la plantilla de Excel. Si una fórmula deja de coincidir, el sitio no se actualiza y te llega un issue.
- `docs/`: el sitio ya construido, que es lo que publica GitHub Pages. No lo edites a mano; se genera solo.

Cada vez que cambias algo en `main`, GitHub Actions corre las pruebas, reconstruye `docs/` y lo publica.
