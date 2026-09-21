# clawdog-widget-renderer

> Schema-driven HTML widget renderer for ClawDog calculator surfaces. Vanilla JS, no framework, iframe-embeddable.

**Live URL (project Pages, served under the LodgeiT Labs apex):**
`https://www.lodgeit.org/clawdog-widget-renderer/widgets/gl-detail-csv-uploader/`

## What this is

`clawdog-widget-renderer` is **Surface B** of the ClawDog four-surface user-experience roadmap (CSV+agent contract / web widget / Office.js add-in / agentic pop-up). This repo houses the **web-widget surface**: small, JSON-Schema-driven HTML forms that any host shell can embed in an iframe to capture structured input for a ClawDog calculator, then POST that input to `clawdog-calculator-api` and render the response.

The first widget is the **GL Detail CSV uploader** (per CLAWDOG/151 §6). The second widget will be the **FBT car operating-cost data-entry widget** (OT #82, lands at Option-A PR 4).

## Architecture

Three load-bearing choices:

1. **Vanilla JS, no framework.** One widget today. If a second widget forces React/Vue/Svelte, add it THEN, not now (Lesson #31 - defer premature design when one demo is one data point).
2. **JSON Schema as the contract.** Each widget ships its own `schema.json`; `render.js` reads the schema, produces an HTML form, validates user input client-side, then POSTs to a calculator-API URL named in the widget's manifest.
3. **Iframe-embeddable + postMessage protocol.** The widget surface is loadable in any iframe. A `postMessage`-based protocol lets a host shell (e.g. `sbrm-global-frontend` via OT #76, or a partner-developer Office add-in via OT #87) receive submission results back from the widget.

## Repo layout

Layout is **flat at repo root** (per mc05-2026-05-28 move-to-root PR) to align with GitHub Pages' `/(root)` source convention + `clawdog-kit` precedent (one repo, one project, no deep src/ nesting):

```
clawdog-widget-renderer/
├── README.md                                       (this file)
├── LICENSE                                          Apache-2.0
├── package.json                                    minimal deps; no framework
├── .gitignore
├── .nojekyll                                       GitHub Pages — disable Jekyll processing
├── index.html                                      widget host page (renders any widget by URL slug)
├── render.js                                       JSON Schema → HTML form renderer (vanilla JS)
├── widgets/
│   └── gl-detail-csv-uploader/
│       ├── schema.json                             input shape (file picker + entity + period)
│       ├── widget.json                             widget manifest (name, version, schema ref, calc-api endpoint)
│       ├── handler.js                              submission handler (POSTs to calc-api)
│       └── index.html                              per-widget entry point
├── tests/
│   ├── test_schema_parsing.spec.mjs                node test — schema → form structure
│   ├── test_render_csv_uploader.spec.mjs           node test — renders form per schema
│   └── test_production_bundle.spec.mjs             SR #12 sibling — fetches deployed widget URL, asserts content
└── .github/workflows/
    └── ci.yml                                      node test + bundle gate + Pages deploy
```

## How to add a widget

Each widget lives under `widgets/<slug>/` with four files:

| File | Purpose |
|---|---|
| `schema.json` | JSON Schema describing the input shape. |
| `widget.json` | Widget manifest: `{name, version, schema_ref, calc_api_url, response_renderer?}`. |
| `handler.js` | Module exposing `handleSubmit(formData) → Promise<response>`. POSTs to the calc-api. |
| `index.html` | Per-widget entry point. Loads `render.js`, the widget's schema + manifest, then mounts the form. |

The widget's URL is `https://www.lodgeit.org/clawdog-widget-renderer/widgets/<slug>/`.

## Quick smoke test (local)

```bash
# Static file server (Python stdlib) — serves the repo root
python3 -m http.server 8000

# Then open:
#   http://localhost:8000/widgets/gl-detail-csv-uploader/
```

The widget should render a form. Submission POSTs to whatever URL is in `widget.json`'s `calc_api_url` field. For local development with a calc-api running on Cloud Run, you can leave the URL as-is and the widget will POST to production.

## Tests

```bash
npm install   # zero runtime deps; only node-test-runner for the spec files (devDependency)
npm test      # runs *.spec.mjs files via node --test
```

Four spec files:

1. **`test_schema_parsing.spec.mjs`** - given a schema, the renderer produces the expected form-field topology.
2. **`test_render_csv_uploader.spec.mjs`** - the GL Detail CSV uploader specifically renders all required fields.
3. **`test_production_bundle.spec.mjs`** - **SR #12 sibling at the JS layer.** Fetches the live deployed widget URL; asserts `<form>` element present + required input names present + `widget.json` accessible. This gate runs in CI against the production-deployed URL (per Lesson #40 - hermetic green without production-bundle green is pre-broken).
4. **`test_package_contents.spec.mjs`** - runs `npm pack --dry-run --json --ignore-scripts` and checks that the package contains the root entry files, renderer and GL Detail widget assets. Runs as part of `npm test`; no tarball is created or published.

## License

Apache-2.0. Same license, same shape, same forward-compatibility-with-public-flip posture as the sibling `lodgeit-labs/clawdog-kit` repo.

## Status

- **PR 1** (this initial commit) - repo skeleton + GL Detail CSV uploader widget + CI workflow + Apache-2.0 license + GitHub Pages enabled.
- **PR 2** - see `lodgeit-labs/clawdog-calculator-api` MCP extension (`/mcp` endpoint surfaces widgets via `ui_resource(widget_url=...)`).
- **PR 3** - host-shell integration in `lodgeit-labs/sbrm-global-frontend` (MCP-Apps WidgetMount).
- **PR 4** - FBT car operating-cost data-entry widget (closes OT #82; load-bearing Lesson #37 n=2 production-surface test).

Ratified sequence: `clawdog-brain/memory/2026-05-28-option-a-sprint-design.md` § Sequencing - RATIFIED `mut-2026-05-28-mc04`.

## Related repos

- [`lodgeit-labs/clawdog-kit`](https://github.com/lodgeit-labs/clawdog-kit) - Surface A (CSV+agent contract); shipped 2026-05-25.
- [`lodgeit-labs/clawdog-calculator-api`](https://github.com/lodgeit-labs/clawdog-calculator-api) - the backend all four surfaces consume.
- [`lodgeit-labs/sbrm-global-frontend`](https://github.com/lodgeit-labs/sbrm-global-frontend) - host shell (Surface B's mount point; OT #76).
- [`lodgeit-labs/clawdog`](https://github.com/lodgeit-labs/clawdog) - public ClawDog pipeline.
