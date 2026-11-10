# Contrato de `bradbit serve` (T-3.1.2)

Congela la superficie HTTP/SSE que consume **`bradbit-editor`**. Si un rebase de
upstream cambia cualquiera de estos comportamientos, la suite
[`packages/cli/test/contract/serve-contract.ts`](packages/cli/test/contract/serve-contract.ts)
falla y bloquea el merge.

## Base

- Upstream: [`anomalyco/opencode`](https://github.com/anomalyco/opencode), rama `dev`.
- Versión de OpenCode en el fork inicial: `2.2.5` (tag/commit pinneado al sincronizar).
- Arranque: `bradbit serve --hostname 127.0.0.1 --port <port>` con `cwd` = carpeta del proyecto.

## Arranque (stdout)

| Señal | Formato |
|---|---|
| URL | `server listening on http://127.0.0.1:<port>` |
| Password | `server password <pw>` |

Autenticación: **HTTP Basic** `opencode:<pw>` en todas las rutas `/api/*`.

## Endpoints

| Método | Ruta | Respuesta esperada |
|---|---|---|
| GET | `/api/info` | `200 { version: string, … }` |
| GET | `/api/model` | `200 { data: […] }` |
| GET | `/api/session` | `200 { data: [{ id: "ses_…", … }] }` |
| POST | `/api/session` | `{ data: { id: "ses_…", … } }` |
| PATCH | `/api/session/{id}` | `204 No Content` |
| GET | `/api/session/{id}/message?limit=200&order=asc` | `200 { data: […] }` |
| GET | `/api/session/{id}/permission` | `200 { data: [{ id: "per_…", … }] }` |
| POST | `/api/session/{id}/permission/{requestId}/reply` | acepta `{ decision: "once" \| "always" \| "reject" }` |
| GET | `/api/session/{id}/form` | `200 { data: [{ id: "frm_…", … }] }` |
| POST | `/api/session/{id}/form/{formId}/reply` | acepta `{ answer: object }` |
| POST | `/api/session/{id}/prompt` | requiere proveedor/modelo configurado |
| POST | `/api/session/{id}/interrupt` | `200 { interrupted: boolean }` |
| POST | `/api/session/{id}/agent` | requiere un agente válido |
| POST | `/api/session/{id}/model` | requiere proveedor/modelo válido |
| POST | `/api/session/{id}/command` | requiere un comando válido |
| GET | `/api/event` | `200 text/event-stream` (SSE) |

## Convenciones

- IDs de sesión: prefijo `ses_`.
- IDs de permiso: prefijo `per_`.
- IDs de formulario: prefijo `frm_`.
- Errores: JSON con `message` o `_tag`; el proceso **nunca** debe caerse.

## Matriz de compatibilidad

| `bradbit-cli` | Base OpenCode | Contrato probado |
|---|---|---|
| `v0.1.0-alpha.1` | `2.2.5` (`dev`) | 16/16 |

## Cobertura y límites

La suite ejercita de forma determinista: arranque/password, 401 sin auth,
`/api/info`, `/api/model`, sesiones (crear/listar/renombrar), mensajes,
permission/form lists, interrupt, rechazo de IDs de sesión inválidos, SSE y
supervivencia tras errores.

Los prefijos `per_`/`frm_` y los endpoints `prompt`/`agent`/`model`/`command`
dependen de un proveedor de IA configurado; la suite verifica que responden sin
caerse (2xx/4xx), pero no la semántica completa de una generación real.

## Cómo correrlo

```bash
BRADBIT_BIN=/abs/path/to/bradbit bun run packages/cli/test/contract/serve-contract.ts
```

En CI corre automáticamente tras compilar `darwin-arm64`.
