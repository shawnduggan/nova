/**
 * Centralized logging utility for Nova Plugin
 * Provides consistent logging with appropriate prefixes and levels
 */

/* eslint-disable no-console */

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

export class Logger {
    private static readonly PREFIX = '[Nova]';
    public static currentLevel: LogLevel = LogLevel.INFO;

    /**
     * Set the global log level
     */
    static setLevel(level: LogLevel): void {
        Logger.currentLevel = level;
    }

    /**
     * Log debug information (development only)
     */
    static debug(message: string, ...args: unknown[]): void {
        if (Logger.currentLevel <= LogLevel.DEBUG) {
            console.debug(`${Logger.PREFIX} ${message}`, ...args);
        }
    }

    /**
     * Log general information
     */
    static info(message: string, ...args: unknown[]): void {
        if (Logger.currentLevel <= LogLevel.INFO) {
            console.log(`${Logger.PREFIX} ${message}`, ...args);
        }
    }

    /**
     * Log warnings
     */
    static warn(message: string, ...args: unknown[]): void {
        if (Logger.currentLevel <= LogLevel.WARN) {
            console.warn(`${Logger.PREFIX} ${message}`, ...args);
        }
    }

    /**
     * Log errors
     */
    static error(message: string, ...args: unknown[]): void {
        if (Logger.currentLevel <= LogLevel.ERROR) {
            console.error(`${Logger.PREFIX} ${message}`, ...args);
        }
    }

    /**
     * Create a scoped logger for a specific component
     */
    static scope(component: string): ScopedLogger {
        return new ScopedLogger(component);
    }
}

/**
 * Scoped logger for specific components
 */
export class ScopedLogger {
    private prefix: string;

    constructor(component: string) {
        this.prefix = `[Nova:${component}]`;
    }

    debug(message: string, ...args: unknown[]): void {
        if (Logger.currentLevel <= LogLevel.DEBUG) {
            console.debug(`${this.prefix} ${message}`, ...args);
        }
    }

    info(message: string, ...args: unknown[]): void {
        if (Logger.currentLevel <= LogLevel.INFO) {
            console.log(`${this.prefix} ${message}`, ...args);
        }
    }

    warn(message: string, ...args: unknown[]): void {
        if (Logger.currentLevel <= LogLevel.WARN) {
            console.warn(`${this.prefix} ${message}`, ...args);
        }
    }

    error(message: string, ...args: unknown[]): void {
        if (Logger.currentLevel <= LogLevel.ERROR) {
            console.error(`${this.prefix} ${message}`, ...args);
        }
    }
}

/* eslint-enable no-console */