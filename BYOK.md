# BYOK y proveedores personalizados (T-3.1.5)

`bradbit` hereda el sistema de proveedores de OpenCode: cada proveedor declara sus
modelos, su endpoint y **cómo recibe la credencial**. El editor puede inyectar
claves por el entorno del proceso `bradbit serve` sin escribirlas nunca en el
proyecto.

## Dos formas de conectar una clave

1. **Guardada por el CLI** con `bradbit auth login`. La credencial queda en el
   almacén de credenciales del sistema y `bradbit auth list` la muestra como
   `stored`.
2. **Inyectada por entorno** (recomendada para `bradbit-editor`). El proveedor
   declara una o más variables en `env`; si alguna está presente, `/connect` y
   `/api/integration/<id>` la reportan como conexión `env`. La clave no se copia
   al proyecto, a `opencode.json` ni a los logs.

## Ejemplo: proveedor OpenAI-compatible

Configuración inline (la que puede enviar el editor por
`OPENCODE_CONFIG_CONTENT`):

```json
{
  "providers": {
    "mi-proveedor": {
      "name": "Mi proveedor",
      "package": "@opencode/ai/providers/openai-compatible",
      "env": ["MI_PROVEEDOR_API_KEY"],
      "settings": {
        "baseURL": "https://api.ejemplo.com/v1"
      },
      "models": {
        "mi-modelo": {
          "name": "Mi modelo",
          "modelID": "mi-modelo",
          "type": "chat"
        }
      }
    }
  }
}
```

El editor arranca el servidor con:

```bash
MI_PROVEEDOR_API_KEY=... bradbit serve --hostname 127.0.0.1 --port <puerto>
```

Y opcionalmente pasa la configuración sin escribirla en disco:

```bash
OPENCODE_CONFIG_CONTENT='{"providers":{...}}' bradbit serve ...
```

## Comprobar el estado

```bash
bradbit auth list
bradbit auth list --format json
```

- Una conexión `stored` se puede eliminar con `bradbit auth logout`.
- Una conexión `env` se elimina del entorno del proceso; `auth logout` no puede
  borrar una variable del sistema.

## Seguridad

- No pongas claves en `opencode.json`, `.bradbit/`, `.opencode/`, `AGENTS.md` ni en los
  argumentos del comando (`ps` puede verlos).
- El servidor no imprime las claves en stdout/stderr; el contrato
  [`byok-contract.ts`](packages/cli/test/contract/byok-contract.ts) verifica que
  una clave inyectada no aparezca en la salida.
- Usa variables de entorno con permisos restringidos y no las incluyas en el
  control de versiones.
- El login OIDC de una cuenta Bradbit no forma parte de este ticket; queda en la
  Story 3.3.
