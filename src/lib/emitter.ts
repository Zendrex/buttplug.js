import type Emittery from "emittery";

/** Constraint for event maps used with {@link TypedEmitter}. */
export type EventMap = Record<string, unknown>;

/**
 * A strongly-typed event emitter backed by Emittery.
 *
 * @typeParam T - An {@link EventMap} defining event names and their payload types
 */
export type TypedEmitter<T extends EventMap> = Emittery<T>;
