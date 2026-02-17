/**
 * Default values for {@link ReconnectHandler} configuration.
 *
 * - `DELAY` — Base delay in ms before the first reconnect attempt
 * - `MAX_DELAY` — Upper bound in ms for exponential backoff
 * - `MAX_ATTEMPTS` — Maximum number of reconnect attempts before giving up
 */
export const ReconnectDefaults = {
	DELAY: 1000,
	MAX_DELAY: 30_000,
	MAX_ATTEMPTS: 10,
} as const;
