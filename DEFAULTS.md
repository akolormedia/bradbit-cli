# Defaults de escritura (`bradbit-cli`)

`bradbit-cli` es un fork de OpenCode (MIT) pensado como runtime de agentes para
escritores. Este documento congela los **defaults de escritura** de la
distribución: qué trae activo, qué queda apagado y qué vive fuera del core.

## Marca visible

- El CLI se presenta como **`bradbit`** (`bradbit --help`, `bradbit --version`).
- Los comandos descriptivos del CLI usan lenguaje Bradbit.

## Toolset Genérico

El core expone herramientas **genéricas de manipulación de texto y archivos**,
que sirven igual para `.md`, `.mdx`, `.fountain` y `.txt`:

`read`, `write`, `edit`, `patch`, `glob`, `grep`, `shell` (bash), `todo`,
`question`, `skill`, `webfetch`, `websearch`, `subagent`, `schedule`.

No hay herramientas de compilación, depuración ni LSP cableadas al core. Cada
agente del kit declara qué herramientas usa (ver `ADR-004`).

## LSP / Diagnostics

En la base actual de OpenCode (2.2.5, rama `dev`) el schema de configuración
acepta `lsp` (`boolean` o servidores), pero **no hay runtime LSP activo** que se
arranque por defecto: el código solo deja la configuración y notas `TODO` para
cuando exista el runtime. Por tanto, `bradbit` **no arranca LSP ni diagnostics
por defecto**; si un proyecto declara `lsp` en su configuración, es opt-in.

## Capacidades narrativas: fuera del core

Los agentes (`guionista`, `editor`, `investigador`, `personaje`), comandos
(`/idea`, `/escena`, `/revisar`, `/voz`…) y skills viven en el **kit del
proyecto** (`.opencode/` + `AGENTS.md`), nunca en el código del core. Esto es
deliberado (`ADR-004`): el kit funciona igual en `opencode` por terminal y en
`bradbit`.

## Pendiente (fuera de este ticket)

- `upgrade` / `uninstall` siguen apuntando a los canales de **upstream**
  (Homebrew `opencode`, `~/.opencode/bin`, WinGet `anomaly.opencode_*`). Se
  adaptan a los releases de Bradbit en `T-3.1.6`; hasta entonces su texto se deja
  sin rebrandear para no describir un comportamiento que no es el real.
