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

`read`, `write`, `edit`, `patch`, `glob`, `grep`, `shell` (bash), `todowrite`,
`question`, `skill`, `webfetch`, `websearch`, `subagent`; y los `schedule_*`
cuando el proyecto habilita agendas. Las herramientas de artefactos, MCP e
imagen son plugins opcionales y no forman parte del toolset de escritura base.

No hay herramientas de compilación, depuración ni LSP cableadas al core. Cada
agente del kit declara qué herramientas usa (ver `ADR-004`).

## LSP / Diagnostics

En la base actual de OpenCode (2.2.5, rama `dev`) el schema de configuración
acepta `lsp` (`boolean` o servidores), pero **no hay runtime LSP activo** que se
arranque por defecto: el código solo deja la configuración y notas `TODO` para
cuando exista el runtime. Por tanto, `bradbit` **no arranca LSP ni diagnostics
por defecto**; si un proyecto declara `lsp` en su configuración, es opt-in.

## Capacidades de escritura: fuera del core

Los agentes, comandos y skills viven en los **kits del proyecto**
(`guionista-kit`, `campaign-kit`, `libro-kit`) dentro de `.bradbit/` +
`AGENTS.md`; `.opencode/` queda como legado. Nunca están en el código del
core. Esto es deliberado (`ADR-004`): el kit es contenido declarativo y
`bradbit init --kit <id>` instala el que corresponda.

## Pendiente (fuera de este ticket)

- `upgrade` / `uninstall` siguen apuntando a los canales de **upstream**
  (Homebrew `opencode`, `~/.opencode/bin`, WinGet `anomaly.opencode_*`). Se
  adaptan a los releases de Bradbit en `T-3.1.6`; hasta entonces su texto se deja
  sin rebrandear para no describir un comportamiento que no es el real.
