# Contrato de `bradbit serve` (T-3.1.2)

Congela la superficie HTTP/SSE que consume **`bradbit-editor`**. Si un rebase de
upstream cambia cualquiera de estos comportamientos, la suite
[`packages/cli/test/contract/serve-contract.ts`](packages/cli/test/contract/serve-contract.ts)
falla y bloquea el merge.

## Base

- Upstream: [`anomalyco/opencode`](https://github.com/anomalyco/opencode), rama `dev`.
- Versión de OpenCode en el fork inicial: `2.2.5` (commit `20c056d84249fe29be7244ff4f9e0aad044c4799` del `2026-11-09`, pinneado al sincronizar; ver [`upstream.json`](upstream.json)).
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
| `v0.1.0-alpha.1` | `2.2.5` (`dev`) | 16/16 (sin CLI surface ni kit discovery) |
| `dev` (T-3.1.4) | `2.2.5` (`dev`) | 24/24 |
| `dev` BYOK (T-3.1.5) | `2.2.5` (`dev`) | 7/7 (contrato separado) |

## Contrato BYOK (T-3.1.5)

[`byok-contract.ts`](packages/cli/test/contract/byok-contract.ts) congela el camino que usará `bradbit-editor` para BYOK:

- Config inline vía `OPENCODE_CONFIG_CONTENT` con un proveedor OpenAI-compatible custom.
- Credencial inyectada por una variable declarada en `providers.<id>.env`; `/api/integration/<id>` la reporta como conexión `env`.
- `settings.baseURL` se conserva en `/api/provider/<id>`.
- La clave nunca aparece en stdout/stderr del servidor.
- El servidor sigue vivo después del setup.

## Cobertura y límites

La suite ejercita de forma determinista: superficie del CLI (`--help` como
Bradbit, `run --help` con el texto de Bradbit e `init --help`/`init` con el kit embebido), arranque/password, 401 sin auth, `/api/info`, `/api/model`,
descubrimiento del kit del proyecto (`/api/agent`, `/api/command`, `/api/skill`
desde `.opencode/`), sesiones (crear/listar/renombrar), mensajes,
permission/form lists, interrupt, rechazo de IDs de sesión inválidos, SSE y
supervivencia tras errores.

Los prefijos `per_`/`frm_` y los endpoints `prompt`/`agent`/`model`/`command`
dependen de un proveedor de IA configurado; la suite verifica que responden sin
caerse (2xx/4xx), pero no la semántica completa de una generación real.

## Cómo correrlo

```bash
BRADBIT_BIN=/abs/path/to/bradbit bun run packages/cli/test/contract/serve-contract.ts
```

En CI corre automáticamente tras compilar `darwin-arm64` y `darwin-x64`; el runner Intel ejecuta ambos contratos contra el binario nativo `darwin-x64` (un runner Intel no puede lanzar el binario arm64).

```bash
BRADBIT_BIN=/abs/path/to/bradbit bun run packages/cli/test/contract/byok-contract.ts
```
