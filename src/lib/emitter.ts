import type Emittery from "emittery";

export type EventMap = Record<string, unknown>;

export type TypedEmitter<T extends EventMap> = Emittery<T>;
