import type { MessageRouterOptions } from "./core/types";
import type { Logger } from "./lib/logger";
import type {
	ClientMessage,
	ErrorMsg,
	InputReading,
	InputType,
	RawDevice,
	ServerInfo,
	ServerMessage,
} from "./protocol/schema";
import type { DeviceMessageSender, SensorCallback } from "./protocol/types";
import type { ButtplugClientOptions, ClientEventMap } from "./types";

import Emittery from "emittery";

import { reconcileDevices } from "./core/device-reconciler";
import { performHandshake } from "./core/handshake";
import { MessageRouter } from "./core/message-router";
import { SensorHandler } from "./core/sensor-handler";
import { raceTimeout } from "./core/utils";
import { Device } from "./device";
import { ConnectionError, ErrorCode, formatError, ProtocolError } from "./lib/errors";
import { noopLogger } from "./lib/logger";
import { DEFAULT_CLIENT_NAME } from "./protocol/constants";
import {
	createDisconnect,
	createPing,
	createRequestDeviceList,
	createStartScanning,
	createStopCmd,
	createStopScanning,
} from "./protocol/messages";
import { getDeviceList, isDeviceList } from "./protocol/parser";
import { WebSocketTransport } from "./transport/connection";
import { PingManager } from "./transport/ping";
import { ReconnectHandler } from "./transport/reconnect";

/** Grace period for stopping all devices before disconnecting. */
const STOP_DEVICES_TIMEOUT_MS = 2000;
/** Grace period for the disconnect handshake message. */
const DISCONNECT_TIMEOUT_MS = 3000;

/**
 * High-level client for communicating with a Buttplug server over WebSocket.
 *
 * Manages the full connection lifecycle including handshake, device discovery,
 * ping keep-alive, sensor subscriptions, and optional automatic reconnection.
 * Emits events defined in {@link ClientEventMap}.
 */
export class ButtplugClient extends Emittery<ClientEventMap> implements DeviceMessageSender {
	readonly #url: string;
	readonly #clientName: string;
	readonly #baseLogger: Logger;
	readonly #logger: Logger;
	readonly #transport: WebSocketTransport;
	readonly #messageRouter: MessageRouter;
	readonly #pingManager: PingManager;
	readonly #sensorHandler: SensorHandler;
	readonly #reconnectHandler: ReconnectHandler | null;
	readonly #devices = new Map<number, Device>();
	#scanning = false;
	#serverInfo: ServerInfo | null = null;
	#connectPromise: Promise<void> | null = null;
	#isHandshaking = false;
	#disconnecting = false;

	constructor(url: string, options: ButtplugClientOptions = {}) {
		super();
		this.#url = url;
		this.#clientName = options.clientName ?? DEFAULT_CLIENT_NAME;
		this.#baseLogger = options.logger ?? noopLogger;
		this.#logger = this.#baseLogger.child("client");

		this.#transport = new WebSocketTransport({ logger: this.#baseLogger });

		this.#transport.on("message", (data: string) => {
			this.#messageRouter.handleMessage(data);
		});

		this.#transport.on("close", (_code: number, reason: string) => {
			// Server-side safety: the Buttplug spec requires servers to stop all
			// devices when a client disconnects, so no client-side stop is needed.
			this.#pingManager.stop();
			if (!this.#disconnecting) {
				this.emit("disconnected", { reason });
			}
		});

		this.#transport.on("error", (error: Error) => {
			this.emit("error", { error });
		});

		const routerOpts: MessageRouterOptions = {
			send: (data: string) => this.#transport.send(data),
			timeout: options.requestTimeout,
			logger: this.#baseLogger,
			onDeviceList: (devices: RawDevice[]) =>
				reconcileDevices({
					currentDevices: this.#devices,
					incomingRaw: devices,
					createDevice: (raw) => new Device({ client: this, raw, logger: this.#baseLogger }),
					logger: this.#logger,
					callbacks: {
						onAdded: (d) => this.emit("deviceAdded", { device: d }),
						onRemoved: (d) => this.emit("deviceRemoved", { device: d }),
						onUpdated: (d, old) => this.emit("deviceUpdated", { device: d, previousDevice: old }),
						onList: (list) => this.emit("deviceList", { devices: list }),
					},
				}),
			onScanningFinished: () => {
				this.#scanning = false;
				this.emit("scanningFinished", undefined);
			},
			onInputReading: (reading: InputReading) => {
				this.#sensorHandler.handleReading(reading, (r) => this.emit("inputReading", { reading: r }));
			},
			onError: (error: ErrorMsg) => {
				this.#logger.warn(`System error from server: [${error.ErrorCode}] ${error.ErrorMessage}`);
				this.emit("error", { error: new ProtocolError(error.ErrorCode, error.ErrorMessage) });
				if (error.ErrorCode === ErrorCode.PING) {
					this.#logger.error("Server ping timeout — server will halt devices and disconnect");
					this.disconnect("Server ping timeout");
				}
			},
		};
		this.#messageRouter = new MessageRouter(routerOpts);
		this.#pingManager = new PingManager({
			sendPing: async () => {
				await this.#messageRouter.send(createPing(this.#messageRouter.nextId()));
			},
			cancelPing: (error: Error) => this.#messageRouter.cancelAll(error),
			logger: this.#baseLogger,
			autoPing: options.autoPing ?? true,
			onError: (error) => this.emit("error", { error }),
			onDisconnect: (reason) => this.disconnect(reason),
			isConnected: () => this.connected,
		});
		this.#sensorHandler = new SensorHandler(this.#baseLogger);

		if (options.autoReconnect) {
			this.#reconnectHandler = new ReconnectHandler({
				url: this.#url,
				transport: this.#transport,
				reconnectDelay: options.reconnectDelay,
				maxReconnectDelay: options.maxReconnectDelay,
				maxReconnectAttempts: options.maxReconnectAttempts,
				logger: this.#baseLogger,
				onReconnecting: (attempt) => {
					this.#pingManager.stop();
					this.emit("reconnecting", { attempt });
				},
				onReconnected: () => this.#handleReconnected(),
				onFailed: (reason) => {
					this.#logger.error(`Reconnection failed: ${reason}`);
					this.emit("error", { error: new ConnectionError(reason) });
				},
			});
		} else {
			this.#reconnectHandler = null;
		}

		this.on("disconnected", () => {
			this.#scanning = false;
			this.#serverInfo = null;
			this.#sensorHandler.clear();
			// Emit deviceRemoved for each device before clearing
			for (const device of this.#devices.values()) {
				this.emit("deviceRemoved", { device });
			}
			this.#devices.clear();

			if (this.#reconnectHandler) {
				this.#reconnectHandler.start();
			}
		});
		this.on("deviceRemoved", ({ device }) => {
			this.#sensorHandler.unsubscribeDevice({
				deviceIndex: device.index,
				router: this.#messageRouter,
				connected: this.#serverInfo !== null && this.connected,
			});
		});
	}

	/**
	 * Opens a WebSocket connection and performs the Buttplug handshake.
	 *
	 * @throws ConnectionError if the transport fails to connect
	 * @throws HandshakeError if the server rejects the handshake
	 */
	async connect(): Promise<void> {
		if (this.connected && this.#serverInfo) {
			return;
		}
		if (this.#connectPromise) {
			return this.#connectPromise;
		}

		this.#connectPromise = this.#performConnect();
		try {
			await this.#connectPromise;
		} finally {
			this.#connectPromise = null;
		}
	}

	/**
	 * Gracefully disconnects from the server.
	 *
	 * Stops all devices, sends a protocol-level disconnect message, then closes
	 * the WebSocket. Both stop and disconnect steps are time-bounded so the
	 * method does not hang indefinitely.
	 *
	 * @param reason - Optional human-readable reason for the disconnection
	 */
	async disconnect(reason?: string): Promise<void> {
		this.#disconnecting = true;
		try {
			const disconnectReason = reason ?? "Client disconnected";
			let emitted = false;

			// Always cancel reconnect attempts, even if the transport is not connected
			if (this.#reconnectHandler?.active) {
				this.#reconnectHandler.cancel();
				this.#pingManager.stop();
				this.emit("disconnected", { reason: disconnectReason });
				emitted = true;
			}

			if (!this.connected) {
				return;
			}

			this.#logger.info(`Disconnecting${reason ? `: ${reason}` : ""}`);
			this.#pingManager.stop();
			this.#reconnectHandler?.cancel();

			// Skip stop/disconnect messages if the handshake hasn't completed yet
			if (this.#serverInfo !== null && !this.#isHandshaking) {
				try {
					await raceTimeout(this.stopAll(), STOP_DEVICES_TIMEOUT_MS);
				} catch {
					this.#logger.warn("Stop all devices timed out during disconnect");
				}
				try {
					await raceTimeout(
						this.#messageRouter.send(createDisconnect(this.#messageRouter.nextId())),
						DISCONNECT_TIMEOUT_MS
					);
				} catch {
					this.#logger.warn("Disconnect message failed or timed out");
				}
			}

			this.#messageRouter.cancelAll(new ConnectionError("Client disconnected"));
			await this.#transport.disconnect();

			// The close handler's emit is suppressed by #disconnecting, so emit
			// here if it wasn't already emitted by the reconnect-cancel path above.
			if (!emitted) {
				this.emit("disconnected", { reason: disconnectReason });
			}
		} finally {
			this.#disconnecting = false;
		}
	}

	/**
	 * Begins scanning for devices on the server.
	 *
	 * @throws ConnectionError if the client is not connected
	 */
	async startScanning(): Promise<void> {
		this.#requireConnection("start scanning");
		await this.#messageRouter.send(createStartScanning(this.#messageRouter.nextId()));
		this.#scanning = true;
	}
	/**
	 * Stops an active device scan on the server.
	 *
	 * @throws ConnectionError if the client is not connected
	 */
	async stopScanning(): Promise<void> {
		this.#requireConnection("stop scanning");
		await this.#messageRouter.send(createStopScanning(this.#messageRouter.nextId()));
		this.#scanning = false;
	}

	/**
	 * Sends a global stop command to halt all devices on the server.
	 *
	 * @throws ConnectionError if the client is not connected
	 */
	async stopAll(): Promise<void> {
		this.#requireConnection("stop devices");
		await this.#messageRouter.send(createStopCmd(this.#messageRouter.nextId()));
	}
	/**
	 * Requests the current device list from the server.
	 *
	 * The response triggers device reconciliation and emits
	 * `deviceAdded`, `deviceRemoved`, `deviceUpdated`, and `deviceList` events.
	 *
	 * @throws ConnectionError if the client is not connected
	 */
	async requestDeviceList(): Promise<void> {
		this.#requireConnection("request device list");
		const responses = await this.#messageRouter.send(createRequestDeviceList(this.#messageRouter.nextId()));
		// Solicited DeviceList responses are resolved via the promise but not
		// dispatched to the onDeviceList callback, so reconciliation must run here.
		for (const response of responses) {
			if (isDeviceList(response)) {
				const deviceList = getDeviceList(response);
				reconcileDevices({
					currentDevices: this.#devices,
					incomingRaw: Object.values(deviceList.Devices),
					createDevice: (raw) => new Device({ client: this, raw, logger: this.#baseLogger }),
					logger: this.#logger,
					callbacks: {
						onAdded: (d) => this.emit("deviceAdded", { device: d }),
						onRemoved: (d) => this.emit("deviceRemoved", { device: d }),
						onUpdated: (d, old) => this.emit("deviceUpdated", { device: d, previousDevice: old }),
						onList: (list) => this.emit("deviceList", { devices: list }),
					},
				});
			}
		}
	}

	/**
	 * Sends one or more raw protocol messages to the server.
	 *
	 * @param messages - A single message or array of messages to send
	 * @returns Server response messages
	 * @throws ConnectionError if the client is not connected
	 */
	async send(messages: ClientMessage | ClientMessage[]): Promise<ServerMessage[]> {
		this.#requireConnection("send message");
		return await this.#messageRouter.send(messages);
	}
	/**
	 * Returns the next monotonically increasing message ID.
	 *
	 * @returns A unique message ID for the next outgoing message
	 */
	nextId(): number {
		return this.#messageRouter.nextId();
	}

	/**
	 * Registers a callback for incoming sensor readings.
	 *
	 * @param key - Unique subscription key (typically from `sensorKey()`)
	 * @param callback - Function invoked when a matching reading arrives
	 * @param info - Device, feature, and input type identifying the subscription
	 */
	registerSensorSubscription(
		key: string,
		callback: SensorCallback,
		info: { deviceIndex: number; featureIndex: number; type: InputType }
	): void {
		this.#sensorHandler.register(key, callback, info);
	}
	/**
	 * Removes a previously registered sensor subscription.
	 *
	 * @param key - The subscription key to remove
	 */
	unregisterSensorSubscription(key: string): void {
		this.#sensorHandler.unregister(key);
	}

	/**
	 * Retrieves a device by its server-assigned index.
	 *
	 * @param index - The device index
	 * @returns The {@link Device} instance, or `undefined` if not found
	 */
	getDevice(index: number): Device | undefined {
		return this.#devices.get(index);
	}

	/** Whether the WebSocket transport is currently connected. */
	get connected(): boolean {
		return this.#transport.state === "connected";
	}
	/** Whether a device scan is currently in progress. */
	get scanning(): boolean {
		return this.#scanning;
	}
	/** Server information received during handshake, or `null` if not connected. */
	get serverInfo(): ServerInfo | null {
		return this.#serverInfo;
	}
	/** Snapshot of all currently known {@link Device} instances. */
	get devices(): Device[] {
		return Array.from(this.#devices.values());
	}

	/**
	 * Disposes the client, clearing all event listeners and internal state.
	 *
	 * Callers should {@link disconnect} first if still connected.
	 * Subsequent usage of the client after disposal is undefined behavior.
	 */
	dispose(): void {
		this.clearListeners();
		this.#pingManager.stop();
		this.#sensorHandler.clear();
		this.#reconnectHandler?.cancel();
		this.#devices.clear();
	}

	/**
	 * Validates connection state before performing an action.
	 *
	 * @throws ConnectionError if not connected
	 */
	#requireConnection(action: string): void {
		if (!this.connected) {
			throw new ConnectionError(`Cannot ${action}: not connected`);
		}
	}

	/** Executes the transport connection and protocol handshake. */
	async #performConnect(): Promise<void> {
		this.#logger.info(`Connecting to ${this.#url}`);
		await this.#transport.connect(this.#url);
		this.#isHandshaking = true;
		try {
			this.#serverInfo = await performHandshake({
				router: this.#messageRouter,
				clientName: this.#clientName,
				pingManager: this.#pingManager,
				logger: this.#logger,
			});
		} finally {
			this.#isHandshaking = false;
		}
		this.#logger.info(`Connected to server: ${this.#serverInfo?.ServerName ?? "unknown"}`);
		this.emit("connected", undefined);
	}

	/**
	 * Re-handshakes and reconciles device state after reconnection.
	 *
	 * Resets all client state, performs a new handshake, and requests the device list.
	 * Emits an error and disconnects if the handshake fails.
	 */
	async #handleReconnected(): Promise<void> {
		this.#logger.info("Reconnected, performing handshake");
		this.#messageRouter.cancelAll(new ConnectionError("Reconnecting"));
		this.#messageRouter.resetId();
		this.#serverInfo = null;
		this.#scanning = false;
		// Don't clear devices here — let reconcileDevices() handle the diff
		// after requestDeviceList() returns, avoiding spurious remove/add churn
		this.#sensorHandler.clear();
		try {
			this.#serverInfo = await performHandshake({
				router: this.#messageRouter,
				clientName: this.#clientName,
				pingManager: this.#pingManager,
				logger: this.#logger,
			});
			this.emit("reconnected", undefined);
			await this.requestDeviceList();
		} catch (err) {
			this.#logger.error(`Handshake failed after reconnect: ${formatError(err)}`);
			this.emit("error", { error: err instanceof Error ? err : new Error(String(err)) });
			await this.disconnect("Handshake failed after reconnect");
		}
	}
}
