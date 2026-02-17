/** Major version of the Buttplug protocol this library implements (v4). */
export const PROTOCOL_VERSION_MAJOR = 4;

/** Minor version of the Buttplug protocol this library implements. */
export const PROTOCOL_VERSION_MINOR = 0;

/** Default client name sent during the handshake with a Buttplug server. */
export const DEFAULT_CLIENT_NAME = "buttplug.js";

/** Default timeout in milliseconds for awaiting a server response to a request. */
export const DEFAULT_REQUEST_TIMEOUT = 10_000;

/** Default interval in milliseconds between keep-alive ping messages. */
export const DEFAULT_PING_INTERVAL = 1000;

/** Maximum allowed message ID value (32-bit unsigned integer ceiling). */
export const MAX_MESSAGE_ID = 0xff_ff_ff_ff;
