import { DynamoDBClient, QueryCommand, QueryCommandInput } from "@aws-sdk/client-dynamodb";
import { LambdaClient, InvokeCommand, InvokeCommandInput } from "@aws-sdk/client-lambda";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import * as winston from 'winston';

const dynamodb = new DynamoDBClient({ region: "eu-central-1" });
const lambda = new LambdaClient({ region: "eu-central-1" });

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
  const processingPromises = [];

  try {
    const allItems = await getWinnersFromPartition(contestId, winningSelectionId, partitionId);
    
    // Process items in batches of 20
    for (let i = 0; i < allItems.length; i += 20) {
      const batchRecords = allItems.slice(i, i + 20);
      
      logger.info('Invoking batch processor', { batchSize: batchRecords.length, batchNumber });
      processingPromises.push(invokeBatchProcessor(batchRecords, contestId, winningSelectionId, partitionId, batchNumber));
      batchNumber++;
    }

    await Promise.all(processingPromises);
    
    logger.info('Partition processing completed', { batchesProcessed: batchNumber });
    return { status: 'Partition processing completed', batchesProcessed: batchNumber };
  } catch (error: any) {
    logger.error('Error processing partition', { error: error.message, stack: error.stack });
    throw error;
  }
};

async function getWinnersFromPartition(contestId: string, winningSelectionId: string, partitionId: string) {
  let lastEvaluatedKey: Record<string, any> | undefined = undefined;
  const allItems: any[] = [];

  do {
    const params: QueryCommandInput = {
      TableName: "ContestParticipants",
      IndexName: "SelectionPartitionIndex",
      KeyConditionExpression: "contestId = :cid AND selectionId = :sid",
      FilterExpression: "partitionId = :pid",
      ExpressionAttributeValues: marshall({
        ":cid": contestId,
        ":sid": winningSelectionId,
        ":pid": partitionId
      }),
      ExclusiveStartKey: lastEvaluatedKey,
      Limit: 20
    };

    try {
      logger.debug('Querying DynamoDB', { params });
      const data = await dynamodb.send(new QueryCommand(params));
      allItems.push(...(data.Items ?? []).map(item => unmarshall(item)));
      lastEvaluatedKey = data.LastEvaluatedKey;

      logger.debug('DynamoDB query result', { 
        itemCount: data.Items?.length ?? 0, 
        totalItems: allItems.length, 
        hasMoreResults: !!lastEvaluatedKey 
      });

      // Optional: Add a delay to avoid exceeding read capacity
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error: any) {
      logger.error('Error querying DynamoDB', { error: error.message, params });
      throw error;
    }
  } while (lastEvaluatedKey);

  return allItems;
}

async function invokeBatchProcessor(batch: any, contestId: string, winningSelectionId: string, partitionId: string, batchNumber: number) {
  const params: InvokeCommandInput = {
    FunctionName: 'batchProcessorLambda',
    InvocationType: 'Event',
    Payload: JSON.stringify({ 
      batch, 
      contestId, 
      winningSelectionId, 
      partitionId,
      batchNumber
    })
  };

  try {
    logger.debug('Invoking batch processor Lambda', { params });
    await lambda.send(new InvokeCommand(params));
    logger.debug('Batch processor Lambda invoked successfully', { batchNumber });
  } catch (error: any) {
    logger.error('Error invoking batch processor Lambda', { error: error.message, params });
    throw error;
  }
}