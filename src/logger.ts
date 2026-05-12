import winston from "winston";

const isProduction = process.env.NODE_ENV === "production";
const logLevel = process.env.LOG_LEVEL || (isProduction ? "info" : "debug");

// Custom format for production: JSON with timestamps
const productionFormat = winston.format.combine(
	winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
	winston.format.errors({ stack: true }),
	winston.format.json(),
);

// Custom format for development: colorized with simple layout
const developmentFormat = winston.format.combine(
	winston.format.timestamp({ format: "HH:mm:ss" }),
	winston.format.errors({ stack: true }),
	winston.format.colorize(),
	winston.format.printf(({ level, message, timestamp, ...meta }) => {
		const metaString = Object.keys(meta).length
			? JSON.stringify(meta, null, 2)
			: "";
		return `${timestamp} [${level}]: ${message} ${metaString}`;
	}),
);

// Configure transports — stdout only (Render/Railway capture stdout automatically)
const transports: winston.transport[] = [
	new winston.transports.Console({
		format: isProduction ? productionFormat : developmentFormat,
	}),
];

// Create the logger instance
const logger = winston.createLogger({
	level: logLevel,
	format: isProduction ? productionFormat : developmentFormat,
	transports,
	// Don't exit on handled exceptions
	exitOnError: false,
});

// Export logger with typed methods
export { logger };

// Utility function to create child logger with correlation ID
export function createRequestLogger(correlationId: string) {
	return logger.child({ correlationId });
}

// Log startup configuration
if (!isProduction) {
	logger.info("Logger initialized", {
		level: logLevel,
		environment: isProduction ? "production" : "development",
	});
}
