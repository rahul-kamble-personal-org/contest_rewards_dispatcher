import { Context } from 'aws-lambda';
import * as winston from 'winston';

// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'batch-processor' },
  transports: [
    new winston.transports.Console()
  ]
});

// Define the event interface based on what the partition processor sends
interface BatchProcessorEvent {
  batch: any[];
  contestId: string;
  winningSelectionId: string;
  partitionId: string;
  batchNumber: number;
}

export const handler = async (event: BatchProcessorEvent, context: Context): Promise<void> => {
  try {
    // Log the entire event
    logger.info('Received batch for processing', { event });

    // Log specific details from the event
    const { batch, contestId, winningSelectionId, partitionId, batchNumber } = event;
    
    logger.info('Processing batch', {
      batchSize: batch.length,
      contestId,
      winningSelectionId,
      partitionId,
      batchNumber
    });

    // Here you would normally process the batch
    // For now, we're just logging it

    logger.info('Batch processing completed successfully');

    // No need to return anything for an asynchronous Lambda invocation
  } catch (error: any) {
    logger.error('Error processing batch', { 
      error: error.message, 
      stack: error.stack,
      batchNumber: event.batchNumber 
    });
    
    // Optionally, you could throw the error here if you want the Lambda to fail
    // throw error;
  }
};