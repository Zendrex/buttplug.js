import Emittery from "emittery";

import { reconcileDevices } from "./core/device-reconciler";
import { performHandshake } from "./core/handshake";
import { MessageRouter } from "./core/message-router";
import { SensorHandler } from "./core/sensor-handler";
import { Device } from "./device";
import { ConnectionError, ErrorCode, formatError, ProtocolError } from "./lib/errors";
import { resolveDiagnosticsLogger } from "./lib/logger";
import { raceTimeout } from "./lib/promise";
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
import type { MessageRouterOptions } from "./core/message-router";
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
import type { Transport } from "./transport/types";

export interface ClientEventMap {
	"connection.connected": undefined;
	"connection.connecting": undefined;
	"connection.disconnected": { reason?: string };
	"connection.error": { error: Error };
	"connection.reconnected": undefined;
	"connection.reconnecting": { attempt: number };
	"device.added": { device: Device };
	"device.error": { error: ProtocolError };
	"device.list": { devices: Device[] };
	"device.removed": { device: Device };
	"device.updated": { device: Device; previousDevice: Device };
	"input.reading": { reading: InputReading };
	"scan.finished": undefined;
	"scan.started": undefined;
}

export interface ButtplugClientOptions {
	autoPing?: boolean;
	autoReconnect?: boolean;
	clientName?: string;
	/**
	 * Injectable sink for internal diagnostics (transport, router, reconnect, ping). Silent by default.
	 */
	logger?: Logger;
	maxReconnectAttempts?: number;
	maxReconnectDelay?: number;
	reconnectDelay?: number;
	requestTimeout?: number;
	/**
	 * When `true` and `logger` is omitted, attaches the library's prefixed `consoleLogger`. Explicit `logger` wins.
	 */
	verbose?: boolean;
}

const STOP_DEVICES_TIMEOUT_MS = 2000;
const DISCONNECT_TIMEOUT_MS = 3000;

export class ButtplugClient extends Emittery<ClientEventMap> implements DeviceMessageSender {
	private readonly clientName: string;
	private readonly baseLogger: Logger;
	private readonly logger: Logger;
	private readonly transport: Transport;
	private readonly messageRouter: MessageRouter;
	private readonly pingManager: PingManager;
	private readonly sensorHandler: SensorHandler;
	private readonly reconnectHandler: ReconnectHandler | null;
	private readonly _devices = new Map<number, Device>();
	private _scanning = false;
	private _serverInfo: ServerInfo | null = null;
	private connectPromise: Promise<void> | null = null;
	private isHandshaking = false;
	private disconnecting = false;

	constructor(target: string | Transport, options: ButtplugClientOptions = {}) {
		super();
		this.clientName = options.clientName ?? DEFAULT_CLIENT_NAME;
		this.baseLogger = resolveDiagnosticsLogger({
			logger: options.logger,
			verbose: options.verbose,
		});
		this.logger = this.baseLogger.child("client");

		this.transport =
			typeof target === "string" ? new WebSocketTransport(target, { logger: this.baseLogger }) : target;
		this.messageRouter = new MessageRouter(this.createRouterOptions(options));
		this.pingManager = new PingManager({
			sendPing: async () => {
				await this.messageRouter.send(createPing(this.messageRouter.nextId()));
			},
			cancelPing: (error: Error) => this.messageRouter.cancelAll(error),
			logger: this.baseLogger,
			autoPing: options.autoPing ?? true,
			onError: (error) => this.emit("connection.error", { error }),
			onDisconnect: (reason) => this.disconnect(reason),
			isConnected: () => this.connected,
		});
		this.sensorHandler = new SensorHandler(this.baseLogger);

		if (options.autoReconnect) {
			this.reconnectHandler = new ReconnectHandler({
				transport: this.transport,
				reconnectDelay: options.reconnectDelay,
				maxReconnectDelay: options.maxReconnectDelay,
				maxReconnectAttempts: options.maxReconnectAttempts,
				logger: this.baseLogger,
				onReconnecting: (attempt) => {
					this.pingManager.stop();
					this.emit("connection.reconnecting", { attempt });
				},
				onReconnected: () => this.handleReconnected(),
				onFailed: (reason) => {
					this.logger.error(`Reconnection failed: ${reason}`);
					this.emit("connection.error", { error: new ConnectionError(reason) });
				},
			});
		} else {
			this.reconnectHandler = null;
		}

		this.bindTransportHandlers();
		this.bindEmitterHandlers();
	}

	async connect(): Promise<void> {
		if (this.connected && this._serverInfo) {
			return;
		}
		if (this.connectPromise) {
			return this.connectPromise;
		}

		this.connectPromise = this.performConnect();
		try {
			await this.connectPromise;
		} finally {
			this.connectPromise = null;
		}
	}

	async disconnect(reason?: string): Promise<void> {
		this.disconnecting = true;
		try {
			const disconnectReason = reason ?? "Client disconnected";
			let emitted = false;

			if (this.reconnectHandler?.active) {
				this.reconnectHandler.cancel();
				this.pingManager.stop();
				this.emit("connection.disconnected", { reason: disconnectReason });
				emitted = true;
			}

			if (!this.connected) {
				return;
			}

			this.logger.info(`Disconnecting${reason ? `: ${reason}` : ""}`);
			this.pingManager.stop();
			this.reconnectHandler?.cancel();

			if (this._serverInfo !== null && !this.isHandshaking) {
				try {
					await raceTimeout(this.stopAll(), STOP_DEVICES_TIMEOUT_MS);
				} catch {
					this.logger.warn("Stop all devices timed out during disconnect");
				}
				try {
					await raceTimeout(
						this.messageRouter.send(createDisconnect(this.messageRouter.nextId())),
						DISCONNECT_TIMEOUT_MS
					);
				} catch {
					this.logger.warn("Disconnect message failed or timed out");
				}
			}

			this.messageRouter.cancelAll(new ConnectionError("Client disconnected"));
			await this.transport.disconnect();

			if (!emitted) {
				this.emit("connection.disconnected", { reason: disconnectReason });
			}
		} finally {
			this.disconnecting = false;
		}
	}

	dispose(): void {
		this.clearListeners();
		this.pingManager.stop();
		this.sensorHandler.clear();
		this.reconnectHandler?.cancel();
		this._devices.clear();
	}

	async startScanning(): Promise<void> {
		this.requireConnection("start scanning");
		await this.messageRouter.send(createStartScanning(this.messageRouter.nextId()));
		this._scanning = true;
		this.emit("scan.started", undefined);
	}

	async stopScanning(): Promise<void> {
		this.requireConnection("stop scanning");
		await this.messageRouter.send(createStopScanning(this.messageRouter.nextId()));
		this._scanning = false;
	}

	async stopAll(): Promise<void> {
		this.requireConnection("stop devices");
		await this.messageRouter.send(createStopCmd(this.messageRouter.nextId()));
	}

	async requestDeviceList(): Promise<void> {
		this.requireConnection("request device list");
		const responses = await this.messageRouter.send(createRequestDeviceList(this.messageRouter.nextId()));
		for (const response of responses) {
			if (isDeviceList(response)) {
				const deviceList = getDeviceList(response);
				reconcileDevices({
					currentDevices: this._devices,
					incomingRaw: Object.values(deviceList.Devices),
					createDevice: (raw) => new Device({ client: this, raw, logger: this.baseLogger }),
					logger: this.logger,
					callbacks: this.deviceReconcileCallbacks(),
				});
			}
		}
	}

	nextId(): number {
		return this.messageRouter.nextId();
	}

	registerSensorSubscription(
		key: string,
		callback: SensorCallback,
		info: { deviceIndex: number; featureIndex: number; type: InputType }
	): void {
		this.sensorHandler.register(key, callback, info);
	}

	async send(messages: ClientMessage | ClientMessage[]): Promise<ServerMessage[]> {
		this.requireConnection("send message");
		return await this.messageRouter.send(messages);
	}

	unregisterSensorSubscription(key: string): void {
		this.sensorHandler.unregister(key);
	}

	getDevice(index: number): Device | undefined {
		return this._devices.get(index);
	}

	get connected(): boolean {
		return this.transport.state === "connected";
	}

	get scanning(): boolean {
		return this._scanning;
	}

	get serverInfo(): ServerInfo | null {
		return this._serverInfo;
	}

	get devices(): Device[] {
		return Array.from(this._devices.values());
	}

	private requireConnection(action: string): void {
		if (!this.connected) {
			throw new ConnectionError(`Cannot ${action}: not connected`);
		}
	}

	private async finishScanning(): Promise<void> {
		try {
			if (this.connected) {
				await this.requestDeviceList();
			}
		} catch (error) {
			this.logger.warn(`Device list refresh after scan failed: ${formatError(error)}`);
		}
		this._scanning = false;
		this.emit("scan.finished", undefined);
	}

	private deviceReconcileCallbacks() {
		return {
			onAdded: (device: Device) => this.emit("device.added", { device }),
			onRemoved: (device: Device) => this.emit("device.removed", { device }),
			onUpdated: (device: Device, previousDevice: Device) =>
				this.emit("device.updated", { device, previousDevice }),
			onList: (devices: Device[]) => this.emit("device.list", { devices }),
		};
	}

	private createRouterOptions(options: ButtplugClientOptions): MessageRouterOptions {
		return {
			send: (data: string) => this.transport.send(data),
			timeout: options.requestTimeout,
			logger: this.baseLogger,
			onDeviceList: (devices: RawDevice[]) =>
				reconcileDevices({
					currentDevices: this._devices,
					incomingRaw: devices,
					createDevice: (raw) => new Device({ client: this, raw, logger: this.baseLogger }),
					logger: this.logger,
					callbacks: this.deviceReconcileCallbacks(),
				}),
			onScanningFinished: () => {
				this.finishScanning().catch(() => undefined);
			},
			onInputReading: (reading: InputReading) => {
				this.sensorHandler.handleReading(reading, (r) => this.emit("input.reading", { reading: r }));
			},
			onError: (error: ErrorMsg) => {
				this.logger.warn(`System error from server: [${error.ErrorCode}] ${error.ErrorMessage}`);
				const protocolError = new ProtocolError(error.ErrorCode, error.ErrorMessage);
				if (error.ErrorCode === ErrorCode.DEVICE) {
					this.emit("device.error", { error: protocolError });
				} else {
					this.emit("connection.error", { error: protocolError });
				}
				if (error.ErrorCode === ErrorCode.PING) {
					this.logger.error("Server ping timeout — server will halt devices and disconnect");
					this.disconnect("Server ping timeout");
				}
			},
		};
	}

	private bindTransportHandlers(): void {
		this.transport.on("message", (data: string) => {
			this.messageRouter.handleMessage(data);
		});

		this.transport.on("close", (_code: number, reason: string) => {
			this.pingManager.stop();
			if (!this.disconnecting) {
				this.emit("connection.disconnected", { reason });
			}
		});

		this.transport.on("error", (error: Error) => {
			this.emit("connection.error", { error });
		});
	}

	private bindEmitterHandlers(): void {
		this.on("connection.disconnected", () => {
			this._scanning = false;
			this._serverInfo = null;
			this.sensorHandler.clear();
			for (const device of this._devices.values()) {
				this.emit("device.removed", { device });
			}
			this._devices.clear();

			if (this.reconnectHandler) {
				this.reconnectHandler.start();
			}
		});
		this.on("device.removed", ({ data: { device } }) => {
			this.sensorHandler.unsubscribeDevice({
				deviceIndex: device.index,
				router: this.messageRouter,
				connected: this._serverInfo !== null && this.connected,
			});
		});
	}

	private async performConnect(): Promise<void> {
		this.logger.info("Connecting transport");
		this.emit("connection.connecting", undefined);
		await this.transport.connect();
		this.isHandshaking = true;
		try {
			this._serverInfo = await performHandshake({
				router: this.messageRouter,
				clientName: this.clientName,
				pingManager: this.pingManager,
				logger: this.logger,
			});
		} finally {
			this.isHandshaking = false;
		}
		this.logger.info(`Connected to server: ${this._serverInfo?.ServerName ?? "unknown"}`);
		this.emit("connection.connected", undefined);
	}

	private async handleReconnected(): Promise<void> {
		this.logger.info("Reconnected, performing handshake");
		this.messageRouter.cancelAll(new ConnectionError("Reconnecting"));
		this.messageRouter.resetId();
		this._serverInfo = null;
		this._scanning = false;
		this.sensorHandler.clear();
		try {
			this._serverInfo = await performHandshake({
				router: this.messageRouter,
				clientName: this.clientName,
				pingManager: this.pingManager,
				logger: this.logger,
			});
			this.emit("connection.reconnected", undefined);
			await this.requestDeviceList();
		} catch (err) {
			this.logger.error(`Handshake failed after reconnect: ${formatError(err)}`);
			this.emit("connection.error", { error: err instanceof Error ? err : new Error(String(err)) });
			await this.disconnect("Handshake failed after reconnect");
		}
	}
}
