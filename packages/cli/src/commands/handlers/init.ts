import { EOL } from "node:os"
import { Effect } from "effect"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { initProject } from "../../kit/init-project"
import { errorMessage } from "../../util/error"

export default Runtime.handler(
  Commands.commands.init,
  (input) =>
    Effect.tryPromise({
      try: () => initProject(input.destination, input.kit),
      catch: (cause) => cause,
    }).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          const prefix = result.alreadyInitialized
            ? "Bradbit project already initialized"
            : "Created Bradbit project"
          process.stdout.write(`${prefix} "${result.name}" at ${result.path}${EOL}`)
          process.stdout.write(`Kit: ${input.kit}${EOL}`)
          if (result.gitInitialized) process.stdout.write(`Initialized Git repository${EOL}`)
        }),
      ),
      Effect.catch((error) =>
        Effect.sync(() => {
          process.stderr.write(errorMessage(error) + EOL)
          process.exitCode = 1
        }),
      ),
    ),
)
