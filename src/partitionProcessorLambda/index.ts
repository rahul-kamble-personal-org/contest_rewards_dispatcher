const AWS = require('aws-sdk');
const { DynamoDBClient, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const winston = require('winston');

const dynamodb = new DynamoDBClient({ region: "eu-central-1" });
const lambda = new AWS.Lambda();

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

exports.handler = async (event: { contestId: any; winningSelectionId: any; partitionId: any; }) => {
  logger.info('Received event', { event });
  const { contestId, winningSelectionId, partitionId } = event;
  
  let lastEvaluatedKey = null;
  let batchNumber = 0;
  const processingPromises = [];

  try {
    do {
      logger.debug('Fetching partition batch', { contestId, winningSelectionId, partitionId, batchNumber });
      const { Items, LastEvaluatedKey } = await fetchPartitionBatch(contestId, winningSelectionId, partitionId, lastEvaluatedKey);
      lastEvaluatedKey = LastEvaluatedKey;
      const batchRecords = Items.map((item: any) => unmarshall(item));
      
      logger.info('Invoking batch processor', { batchSize: batchRecords.length, batchNumber });
      processingPromises.push(invokeBatchProcessor(batchRecords, contestId, winningSelectionId, partitionId, batchNumber));
      batchNumber++;
    } while (lastEvaluatedKey);

    await Promise.all(processingPromises);
    
    logger.info('Partition processing completed', { batchesProcessed: batchNumber });
    return { status: 'Partition processing completed', batchesProcessed: batchNumber };
  } catch (error: any) {
    logger.error('Error processing partition', { error: error.message, stack: error.stack });
    throw error;
  }
};

async function fetchPartitionBatch(contestId: any, winningSelectionId: any, partitionId: any, exclusiveStartKey: any) {
  const params = {
    TableName: "ContestParticipants",
    KeyConditionExpression: "contestId = :cid AND partitionId = :pid",
    FilterExpression: "selectionId = :sid",
    ExpressionAttributeValues: marshall({
      ":cid": contestId,
      ":pid": partitionId,
      ":sid": winningSelectionId
    }),
    ExclusiveStartKey: exclusiveStartKey,
    Limit: 20 // Fetch in batches of 20
  };

  try {
    logger.debug('Querying DynamoDB', { params });
    const result = await dynamodb.send(new QueryCommand(params));
    logger.debug('DynamoDB query result', { itemCount: result.Items.length, hasMoreResults: !!result.LastEvaluatedKey });
    return result;
  } catch (error : any) {
    logger.error('Error querying DynamoDB', { error: error.message, params });
    throw error;
  }
}

async function invokeBatchProcessor(batch: any, contestId: any, winningSelectionId: any, partitionId: any, batchNumber: number) {
  const params = {
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
    await lambda.invoke(params).promise();
    logger.debug('Batch processor Lambda invoked successfully', { batchNumber });
  } catch (error: any) {
    logger.error('Error invoking batch processor Lambda', { error: error.message, params });
    throw error;
  }
}