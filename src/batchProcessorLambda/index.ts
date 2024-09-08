import { Context } from 'aws-lambda';
import * as winston from 'winston';

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'user-service' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

export const handler = async (event: any, context: Context): Promise<any> => {
    // Log the event and context
    logger.info('Event received', { event });
    logger.info('Context', { context });

    // Log a simple message
    logger.info('Hello from Lambda!');

    // Example of different log levels
    logger.error('This is an error log');
    logger.warn('This is a warning log');
    logger.debug('This is a debug log');

    // Return a simple response
    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Lambda function executed successfully',
        }),
    };
};