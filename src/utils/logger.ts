/**
 * @file Logger - Centralized logging utility with levels
 */

 

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

function isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
}

function getLogPayload(
    prefix: string,
    severity: 'Warning' | 'Error',
    message: string,
    args: unknown[]
): [string, ...unknown[]] {
    return isProduction()
        ? [`${prefix} ${severity}`]
        : [`${prefix} ${message}`, ...args];
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
        if (!isProduction() && Logger.currentLevel <= LogLevel.DEBUG) {
            console.debug(`${Logger.PREFIX} ${message}`, ...args);
        }
    }

    /**
     * Log general information
     */
    static info(message: string, ...args: unknown[]): void {
        if (!isProduction() && Logger.currentLevel <= LogLevel.INFO) {
            console.debug(`${Logger.PREFIX} ${message}`, ...args);
        }
    }

    /**
     * Log warnings
     */
    static warn(message: string, ...args: unknown[]): void {
        if (Logger.currentLevel <= LogLevel.WARN) {
            console.warn(...getLogPayload(Logger.PREFIX, 'Warning', message, args));
        }
    }

    /**
     * Log errors
     */
    static error(message: string, ...args: unknown[]): void {
        if (Logger.currentLevel <= LogLevel.ERROR) {
            console.error(...getLogPayload(Logger.PREFIX, 'Error', message, args));
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
        if (!isProduction() && Logger.currentLevel <= LogLevel.DEBUG) {
            console.debug(`${this.prefix} ${message}`, ...args);
        }
    }

    info(message: string, ...args: unknown[]): void {
        if (!isProduction() && Logger.currentLevel <= LogLevel.INFO) {
            console.debug(`${this.prefix} ${message}`, ...args);
        }
    }

    warn(message: string, ...args: unknown[]): void {
        if (Logger.currentLevel <= LogLevel.WARN) {
            console.warn(...getLogPayload(this.prefix, 'Warning', message, args));
        }
    }

    error(message: string, ...args: unknown[]): void {
        if (Logger.currentLevel <= LogLevel.ERROR) {
            console.error(...getLogPayload(this.prefix, 'Error', message, args));
        }
    }
}
