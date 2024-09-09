import winston from 'winston';

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

exports.handler = async (event: { batch: any; contestId: any; winningSelectionId: any; partitionId: any; batchNumber: any; }) => {
  logger.info('Received batch processing event', { event });
  const { batch, contestId, winningSelectionId, partitionId, batchNumber } = event;
  
  try {
    for (const record of batch) {
      await processRecord(record);
    }
    
    logger.info('Batch processing completed', { 
      batchNumber, 
      processedCount: batch.length, 
      partitionId, 
      contestId 
    });

    return { 
      processedCount: batch.length, 
      batchNumber, 
      partitionId 
    };
  } catch (error: any) {
    logger.error('Error processing batch', { 
      error: error.message, 
      stack: error.stack,
      batchNumber,
      partitionId,
      contestId
    });
    throw error;
  }
};

async function processRecord(record: { id: any; }) {
  try {
    logger.debug('Processing record', { record });
    // Implement your record processing logic here
    // Add your business logic for processing each record

    // For demonstration purposes, let's log some info about the record
    logger.info('Record processed successfully', {
      recordId: record.id,  // Assuming each record has an id field
      // Add other relevant fields from the record
    });
  } catch (error: any) {
    logger.error('Error processing individual record', {
      error: error.message,
      record: record.id,  // Assuming each record has an id field
      // Be careful not to log sensitive information
    });
    // Depending on your error handling strategy, you might want to:
    // 1. Throw the error to stop processing the entire batch
    // throw error;
    // 2. Or, continue processing other records in the batch
    // In this example, we'll continue processing other records
  }
}