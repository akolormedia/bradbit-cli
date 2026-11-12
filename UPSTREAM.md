# Upstream de `bradbit-cli`

`bradbit-cli` es un fork de **OpenCode** (`anomalyco/opencode`, MIT). El pin
vigente está en [`upstream.json`](upstream.json) y es la fuente de verdad para
scripts y CI.

| Campo | Valor |
|---|---|
| Repositorio | [`anomalyco/opencode`](https://github.com/anomalyco/opencode) |
| Rama | `dev` |
| Versión de OpenCode | `2.2.5` |
| Commit | `20c056d84249fe29be7244ff4f9e0aad044c4799` |
| Fecha del pin | `2026-11-09` |

## Divergencia intencional

El fork mantiene el protocolo de `opencode serve` como contrato drop-in
([`CONTRACT.md`](CONTRACT.md)) y solo diverge en:

- Binario y nombre de comando `bradbit`, con atribución en [`NOTICE`](NOTICE).
- `bradbit init` y el snapshot embebido del `guionista-kit`
  ([`packages/cli/src/kit`](packages/cli/src/kit)).
- Rebranding visible del CLI (`T-3.1.3`) y defaults de escritura
  ([`DEFAULTS.md`](DEFAULTS.md)).
- Documentación BYOK ([`BYOK.md`](BYOK.md)).
- Workflow `CI` propio; los workflows heredados de upstream se desactivan en el
  fork para no ejecutar jobs que dependen de runners/secrets de Anomaly.

## Sincronizar con upstream

```bash
git fetch upstream dev
git checkout -b chore/upstream-<fecha> origin/dev
git merge upstream/dev
```

Después de resolver conflictos:

1. Actualiza `upstream.json` con el nuevo commit, versión y fecha.
2. Ejecuta `bun run check`.
3. Compila y ejecuta los contratos:
   ```bash
   bun run packages/cli/script/build.ts --skip-web-ui --outdir=dist/review
   BRADBIT_BIN="$PWD/packages/cli/dist/review/cli-darwin-arm64/bin/bradbit" \
     bun run packages/cli/test/contract/serve-contract.ts
   BRADBIT_BIN="$PWD/packages/cli/dist/review/cli-darwin-arm64/bin/bradbit" \
     bun run packages/cli/test/contract/byok-contract.ts
   ```
4. Revisa `CONTRACT.md` si upstream cambió la superficie HTTP/SSE.
5. Abre un PR contra `dev` con el pin actualizado.

## Validación automática

`bun run packages/cli/script/check-upstream-pin.ts` comprueba que:

- `upstream.json` tiene los campos esperados y un commit SHA de 40 caracteres.
- `CONTRACT.md` menciona el mismo commit.
- El remoto `upstream dev` sigue en el pin; si avanzó, avisa sin fallar para que
  se planifique el rebase.
