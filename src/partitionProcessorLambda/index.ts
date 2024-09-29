import { DynamoDBClient, QueryCommand, QueryCommandInput } from "@aws-sdk/client-dynamodb";
import { LambdaClient, InvokeCommand, InvokeCommandInput } from "@aws-sdk/client-lambda";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import * as winston from 'winston';

const dynamodb = new DynamoDBClient({ region: "eu-central-1" });
const lambda = new LambdaClient({ 
  region: "eu-central-1",
  maxAttempts: 5,
  retryMode: "adaptive"
});
// Configure Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'partition-processor' },
  transports: [
    new winston.transports.Console()
  ]
});

export const handler = async (event: { contestId: string; winningSelectionId: string; partitionId: string; }) => {
  logger.info('Received event', { event });
  const { contestId, winningSelectionId, partitionId } = event;
  
  let batchNumber = 0;
  const processingPromises: any[] = [];

  try {
    await processPartitionInBatches(contestId, winningSelectionId, partitionId, (batch) => {
      logger.info('Invoking batch processor', { batchSize: batch.length, batchNumber });
      processingPromises.push(
        invokeBatchProcessor(batch, contestId, winningSelectionId, partitionId, batchNumber)
          .catch(error => {
            logger.error('Batch processing failed', { batchNumber, error: error.message });
            return { status: 'failed', batchNumber, error: error.message };
          })
      );
      batchNumber++;
    });

    const results = await Promise.all(processingPromises);
    
    const failedBatches = results.filter(result => result && result.status === 'failed');
    
    logger.info('Partition processing completed', { 
      batchesProcessed: batchNumber,
      failedBatches: failedBatches.length
    });
    
    return { 
      status: failedBatches.length > 0 ? 'Partial completion' : 'Complete',
      batchesProcessed: batchNumber,
      failedBatches: failedBatches.length,
      failedBatchDetails: failedBatches
    };
  } catch (error: any) {
    logger.error('Error processing partition', { error: error.message, stack: error.stack });
    throw error;
  }
};

async function processPartitionInBatches(
  contestId: string, 
  winningSelectionId: string, 
  partitionId: string,
  processBatch: (batch: any[]) => void
) {
  let lastEvaluatedKey: Record<string, any> | undefined = undefined;
  let accumulatedItems: any[] = [];

  do {
    // const params: QueryCommandInput = {
    //   TableName: "ContestParticipants",
    //   IndexName: "SelectionPartitionIndex",
    //   KeyConditionExpression: "contestId = :cid AND selectionId = :sid",
    //   FilterExpression: "partitionId = :pid",
    //   ExpressionAttributeValues: marshall({
    //     ":cid": contestId,
    //     ":sid": winningSelectionId,
    //     ":pid": partitionId
    //   }),
    //   ExclusiveStartKey: lastEvaluatedKey,
    //   Limit: 40 // Fetch more items per query to reduce API calls
    // };

    const params: QueryCommandInput = {
      TableName: "ContestParticipants2",
      IndexName: "SelectionPartitionIndex",
      KeyConditionExpression: 
      "contestId = :cid AND selectionPartitionId = :spid",
      ExpressionAttributeValues: marshall({
        ":cid": contestId,
        ":spid":  `${winningSelectionId}#${partitionId}`
      }),
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: 80
    };

    try {
      logger.debug('Querying DynamoDB', { params });
      const data = await dynamodb.send(new QueryCommand(params));
      const fetchedItems = (data.Items ?? []).map((item: any) => unmarshall(item));
      
      for (const item of fetchedItems) {
        accumulatedItems.push(item);
        if (accumulatedItems.length === 80) {
          processBatch([...accumulatedItems]);
          accumulatedItems = [];
        }
      }

      lastEvaluatedKey = data.LastEvaluatedKey;

      logger.debug('DynamoDB query result', { 
        itemsFetched: fetchedItems.length, 
        itemsAccumulated: accumulatedItems.length, 
        hasMoreResults: !!lastEvaluatedKey 
      });

      // Optional: Add a delay to avoid exceeding read capacity
      //await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      logger.error('Error querying DynamoDB', { error: error.message, params });
      throw error;
    }
  } while (lastEvaluatedKey);

  // Process any remaining items
  if (accumulatedItems.length > 0) {
    processBatch(accumulatedItems);
  }
}

async function invokeBatchProcessor(batch: any[], contestId: string, winningSelectionId: string, partitionId: string, batchNumber: number) {
  const params: InvokeCommandInput = {
    FunctionName: process.env.BATCH_PROCESSOR_FUNCTION_NAME || 'batchProcessorLambda',
    InvocationType: 'Event',
    Payload: JSON.stringify({ 
      batch, 
      contestId, 
      winningSelectionId, 
      partitionId,
      batchNumber
    })
  };

  logger.info('Preparing to invoke batch processor Lambda', { 
    batchNumber, 
    batchSize: batch.length, 
    functionName: params.FunctionName 
  });

  const maxRetries = 5;
  const baseDelay = 1000; // 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug('Invoking batch processor Lambda', { 
        params: {
          ...params,
          Payload: `${batch.length} items` // Avoid logging full payload
        }, 
        attempt 
      });

      const startTime = Date.now();
      const command = new InvokeCommand(params);
      const response: any = await lambda.send(command);
      const duration = Date.now() - startTime;

      logger.info('Batch processor Lambda invoked successfully', { 
        batchNumber, 
        attempt,
        duration,
        statusCode: response.StatusCode,
        executedVersion: response.ExecutedVersion,
        logResult: response.LogResult ? 'Available' : 'Not available'
      });

      // If you want to check the response payload (be cautious with async invocations)
      if (response.Payload) {
        const payloadString = new TextDecoder().decode(response.Payload);
        logger.debug('Lambda response payload', { payloadString });
      }

      return; // Success, exit the function
    } catch (error: any) {
      const retryDelay = baseDelay * Math.pow(2, attempt - 1);
      
      logger.warn('Error invoking batch processor Lambda', { 
        error: error.message,
        errorCode: error.$metadata?.httpStatusCode,
        errorType: error.name,
        serviceError: error.$metadata?.serviceException,
        batchNumber,
        attempt,
        nextAttemptIn: attempt < maxRetries ? retryDelay : 'No more retries'
      });

      if (attempt === maxRetries) {
        logger.error('Failed to invoke batch processor Lambda after max retries', { 
          error: error.message, 
          batchNumber,
          attempts: maxRetries 
        });
        throw error;
      } else {
        logger.warn('Error invoking batch processor Lambda, retrying', { 
          error: error.message, 
          params, 
          attempt, 
          nextAttemptIn: retryDelay 
        });
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
}