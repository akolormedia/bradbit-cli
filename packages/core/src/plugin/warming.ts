export * as WarmingPlugin from "./warming.js"

import { define } from "@opencode/plugin/effect/plugin"
import type { SessionHooks } from "@opencode/plugin/effect/session"
import type { Provider } from "@opencode/schema/provider"
import type { Session } from "@opencode/schema/session"
import { ConfigWarming } from "@opencode/schema/config/warming"
import { Clock, Data, Deferred, Duration, Effect, FiberMap, Option, Schema, Stream } from "effect"
import { Config } from "../config.js"
import { resolveModel } from "./optimize.js"

const decodeWarming = Schema.decodeUnknownOption(ConfigWarming.Warming)

const defaults = {
  prompt: "This is a keep-alive request. Do not perform any work or use tools. Reply with exactly: OK",
  interval: "auto" as "auto" | Duration.Duration,
  duration: Duration.minutes(30),
}

/** `ttl` is how long the provider keeps a cache entry after the request that last sent it. */
type Settings = typeof defaults & { interval: Duration.Duration; ttl: Duration.Duration }

/** Whether a session is warmed after a request, and why not. */
type Decision = Data.TaggedEnum<{
  Warm: { readonly settings: Settings }
  /** Neither the top-level `warming` nor the model's `cache.warming` turns it on. */
  Off: {}
  /** `"auto"` timing on a cache that lasts longer than `duration`, so no ping is needed before the window closes. */
  CacheOutlivesWindow: {}
  /** An explicit interval that isn't positive and shorter than a finite `duration`. */
  InvalidInterval: {}
}>
const Decision = Data.taggedEnum<Decision>()

// The interval for "auto" when the model has no cache.ttl, a little under the five minutes most explicit caches last.
const fallbackInterval = Duration.minutes(4)
const fallbackTTL = Duration.minutes(5)

/**
 * Where a session is in warming. A session has a loop exactly while it is `Waiting`, `AwaitingRequest` or `Pinging`.
 * `StoppedAfterMiss` and `Outlived` only remember why a session isn't warmed until its next request or deletion, and
 * a session that stops for any other reason has no entry.
 *
 *   request ──▶ Waiting ──due──▶ Pinging ──hit──▶ Waiting
 *                  │                └────miss───▶ StoppedAfterMiss
 *                  ├──due, request running──▶ AwaitingRequest ──ended──▶ Pinging
 *                  │                                └──cache expired first──▶ (none)
 *                  └──window closed──▶ (none)
 *
 *   request that turns warming off ──▶ (none), or Outlived when the cache outlives the window
 */
type State = Data.TaggedEnum<{
  /** The next ping isn't due yet. */
  Waiting: {}
  /** A ping is due while a model request runs; it waits for the request to finish rather than compete with it. */
  AwaitingRequest: {}
  /** The ping's own request hooks recognize it by its prompt. */
  Pinging: { readonly prompt: string }
  /** A ping missed the cache, so pinging waits for the session's next real request. */
  StoppedAfterMiss: {}
  /** Already told that its cache outlives the window; the check runs on every request. */
  Outlived: {}
}>
const State = Data.taggedEnum<State>()

export const Plugin = define({
  id: "opencode.warming",
  effect: Effect.fn(function* (ctx) {
    const config = yield* Config.Service
    // A model's or provider's `cache.warming` overrides the top-level `warming`.
    const decide = Effect.fn("WarmingPlugin.decide")(function* (event: SessionHooks["context"]) {
      // Warming must never fail the request it hooks, so an unreadable catalog falls back to the top-level setting.
      const cache = (yield* resolveModel(ctx, event).pipe(Effect.orElseSucceed(() => undefined)))?.settings?.cache
      const local = cache?.warming === undefined ? undefined : Option.getOrUndefined(decodeWarming(cache.warming))
      if (cache?.warming !== undefined && local === undefined)
        yield* Effect.logWarning("invalid cache.warming setting; using the top-level warming setting", {
          model: event.model,
        })
      const global = Config.latest(yield* config.entries(), "warming")
      if (!(local ?? global)) return Decision.Off()
      // The keep-alive prompt is only set at the top level; a model's setting changes timing.
      const settings = {
        ...defaults,
        ...(typeof global === "object" ? global : {}),
        ...(typeof local === "object" ? local : {}),
      }
      const { duration } = settings
      const ttl = parseTTL(cache?.ttl)
      // "auto" pings at 90% of the cache's lifetime, so it lands before the cache expires.
      const interval =
        settings.interval === "auto" ? (ttl ? Duration.times(ttl, 0.9) : fallbackInterval) : settings.interval
      // A cache that outlives the window, such as "1h" with the 30-minute default, needs no keep-alive.
      if (
        settings.interval === "auto" &&
        Duration.isFinite(duration) &&
        Duration.isGreaterThanOrEqualTo(interval, duration)
      )
        return Decision.CacheOutlivesWindow()
      const valid =
        Duration.isFinite(duration) &&
        Duration.isGreaterThan(interval, Duration.zero) &&
        Duration.isLessThan(interval, duration)
      // Without a cache.ttl, an explicit interval longer than five minutes implies a cache that lasts at least that long.
      if (valid)
        return Decision.Warm({
          settings: { ...settings, interval, ttl: ttl ?? Duration.max(fallbackTTL, interval) },
        })
      yield* Effect.logWarning("warming interval must be positive and shorter than a finite duration", {
        interval,
        duration,
      })
      return Decision.InvalidInterval()
    })

    const sessions = new Map<Session.ID, State>()
    // Each session's loop. A real request replaces it, and closing the plugin's scope interrupts them all.
    const loops = yield* FiberMap.make<Session.ID>()
    // A ping during a model request would compete with the request it keeps warm, which stalls single-slot local models.
    // A request counts from its context or compaction hook, because `session.step.started` waits for the first
    // response chunk. Each entry completes and is removed when its request ends, which wakes a loop waiting to ping.
    const running = new Map<Session.ID, Deferred.Deferred<void>>()

    // `sent` is when the latest request or ping was sent, since a provider's cache lifetime starts when a request reads
    // or writes it, not when its response ends.
    const loop: (sessionID: Session.ID, settings: Settings, sent: number, expires: number) => Effect.Effect<void> =
      Effect.fn("WarmingPlugin.loop")(function* (sessionID, settings, sent, expires) {
        const now = yield* Clock.currentTimeMillis
        // The warming window has closed.
        if (now >= expires) return void sessions.delete(sessionID)
        const due = Math.min(sent + Duration.toMillis(settings.interval), expires)
        if (now < due) {
          sessions.set(sessionID, State.Waiting())
          yield* Effect.sleep(Duration.millis(due - now))
          return yield* loop(sessionID, settings, sent, expires)
        }
        const request = running.get(sessionID)
        if (request) {
          sessions.set(sessionID, State.AwaitingRequest())
          // Pinging as soon as the request ends keeps a cache that is about to expire. If the request outlasts the
          // cache, a ping would only write a new cache, so the next real request starts warming again.
          const ended = yield* Deferred.await(request).pipe(
            Effect.timeoutOption(Duration.millis(Math.max(0, sent + Duration.toMillis(settings.ttl) - now))),
          )
          if (Option.isNone(ended)) return void sessions.delete(sessionID)
          return yield* loop(sessionID, settings, sent, expires)
        }

        sessions.set(sessionID, State.Pinging({ prompt: settings.prompt }))
        yield* Effect.logInfo("warming session", { sessionID })
        // A real request sent during the ping replaces this loop, so the cache is judged by that request instead.
        const result = yield* ctx.session
          .generate({ sessionID, prompt: settings.prompt })
          .pipe(
            Effect.catchCause((cause) =>
              Effect.logWarning("failed to warm session", { sessionID, cause }).pipe(Effect.as(undefined)),
            ),
          )
        // A ping that wrote more to the cache than it read rebuilt the cache instead of keeping it, so later pings
        // would keep paying for that. Providers that report no cache usage never count as a miss.
        if (result && result.tokens.cache.read < result.tokens.cache.write) {
          sessions.set(sessionID, State.StoppedAfterMiss())
          yield* Effect.logInfo("stopped warming session after a cache miss", {
            sessionID,
            read: result.tokens.cache.read,
            write: result.tokens.cache.write,
          })
          return
        }
        // A ping touches the cache like any request, so the next interval counts from when it was sent.
        return yield* loop(sessionID, settings, now, expires)
      })

    const stop = (sessionID: Session.ID) =>
      FiberMap.remove(loops, sessionID).pipe(Effect.andThen(Effect.sync(() => sessions.delete(sessionID))))

    const hook = (event: SessionHooks["context"]) =>
      Effect.gen(function* () {
        const current = sessions.get(event.sessionID)
        // Once generate exposes request metadata to context hooks, tag warm requests instead of matching the prompt.
        if (current && State.$is("Pinging")(current) && isPrompt(event, current.prompt)) return

        const session = yield* ctx.session.get({ sessionID: event.sessionID }).pipe(Effect.orDie)
        if (session.parentID) return

        const decision = yield* decide(event)
        if (Decision.$is("CacheOutlivesWindow")(decision)) {
          yield* stop(event.sessionID)
          sessions.set(event.sessionID, State.Outlived())
          if (current && State.$is("Outlived")(current)) return
          return yield* Effect.logInfo("not warming: the prompt cache outlives the warming window", {
            sessionID: event.sessionID,
            model: event.model,
          })
        }
        if (!Decision.$is("Warm")(decision)) return yield* stop(event.sessionID)

        const now = yield* Clock.currentTimeMillis
        const expires = now + Duration.toMillis(decision.settings.duration)
        // Every real request restarts the interval and the window, so only a session without a loop is worth logging.
        if (!current || State.$is("StoppedAfterMiss")(current) || State.$is("Outlived")(current))
          yield* Effect.logInfo(
            current && State.$is("StoppedAfterMiss")(current) ? "resumed session warming" : "scheduled session warming",
            { sessionID: event.sessionID, interval: decision.settings.interval, expires },
          )
        yield* FiberMap.run(
          loops,
          event.sessionID,
          loop(event.sessionID, decision.settings, now, expires).pipe(
            Effect.catchDefect((defect) =>
              Effect.logError("session warming loop failed", { sessionID: event.sessionID, defect }).pipe(
                Effect.andThen(Effect.sync(() => sessions.delete(event.sessionID))),
              ),
            ),
          ),
        )
      })

    // A turn always ends with an execution event, and a compaction with its own, so a request that ends without its
    // own event can't stay running past them.
    yield* ctx.event
      .subscribe({
        types: [
          "session.step.streamed",
          "session.step.failed",
          "session.compaction.ended",
          "session.compaction.failed",
          "session.execution.succeeded",
          "session.execution.failed",
          "session.execution.interrupted",
          "session.deleted",
        ],
      })
      .pipe(
        Stream.runForEach((event) =>
          Effect.gen(function* () {
            const sessionID = event.data.sessionID
            // The interval still counts from when the request was sent, because that is when it touched the cache.
            const request = running.get(sessionID)
            running.delete(sessionID)
            if (request) yield* Deferred.succeed(request, undefined)
            if (event.type === "session.deleted") yield* stop(sessionID)
          }),
        ),
        Effect.forkScoped({ startImmediately: true }),
      )

    // Steps of one turn share an entry, so the next end event wakes a waiting loop even if a step ended silently.
    const begin = (sessionID: Session.ID) =>
      Effect.gen(function* () {
        if (!running.has(sessionID)) running.set(sessionID, yield* Deferred.make<void>())
      })
    yield* ctx.session.hook("context", (event) => begin(event.sessionID).pipe(Effect.andThen(hook(event))))
    yield* ctx.session.hook("compaction", (event) => begin(event.sessionID).pipe(Effect.andThen(hook(event))))
    yield* ctx.session.hook("generate", hook)
  }),
})

function isPrompt(event: SessionHooks["context"], prompt: string) {
  const message = event.messages.at(-1)
  return (
    message?.role === "user" &&
    message.content.length === 1 &&
    message.content[0]?.type === "text" &&
    message.content[0].text === prompt
  )
}

const units = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }

function parseTTL(ttl: Provider.CacheTTL | undefined) {
  const match = ttl?.match(/^([\d.]+)(ms|s|m|h|d)$/)
  if (match) return Duration.millis(Number(match[1]) * units[match[2] as keyof typeof units])
}
