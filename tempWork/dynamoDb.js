const { DynamoDBClient, CreateTableCommand, PutItemCommand, QueryCommand } = require("@aws-sdk/client-dynamodb");
const { marshall, unmarshall } = require("@aws-sdk/util-dynamodb");
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: "eu-central-1" }); // Replace with your region

const TABLE_NAME = "ContestParticipants2";

// Create table
const createTable = async () => {
  const params = {
    TableName: TABLE_NAME,
    KeySchema: [
      { AttributeName: "contestId", KeyType: "HASH" },
      { AttributeName: "userId", KeyType: "RANGE" }
    ],
    AttributeDefinitions: [
      { AttributeName: "contestId", AttributeType: "S" },
      { AttributeName: "userId", AttributeType: "S" },
      { AttributeName: "selectionPartitionId", AttributeType: "S" }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    },
    GlobalSecondaryIndexes: [
      {
        IndexName: "SelectionPartitionIndex",
        KeySchema: [
          { AttributeName: "contestId", KeyType: "HASH" },
          { AttributeName: "selectionPartitionId", KeyType: "RANGE" }
        ],
        Projection: {
          ProjectionType: "ALL"
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5
        }
      }
    ]
  };

  try {
    const data = await client.send(new CreateTableCommand(params));
    console.log("Table created successfully:", data);
  } catch (err) {
    console.error("Error creating table:", err);
  }
};

// Insert records
const insertRecords = async () => {
  const contestId = "contest_123";
  const selectionId = "selection_winner";
  const partitionId = Math.floor(Math.random() * 3);

  for (let i = 0; i < 5000; i++) {
    const userId = uuidv4();
    const params = {
      TableName: TABLE_NAME,
      Item: marshall({
        contestId: contestId,
        userId: userId,
        selectionId: selectionId,
        partitionId: partitionId,
        selectionPartitionId: `${selectionId}#${partitionId}`
      })
    };

    try {
      await client.send(new PutItemCommand(params));
      console.log(`Inserted record for userId: ${userId}`);
    } catch (err) {
      console.error("Error inserting record:", err);
    }
  }
};

// Query records
const queryRecords = async () => {
  const params = {
    TableName: TABLE_NAME,
    IndexName: "SelectionPartitionIndex",
    KeyConditionExpression: "contestId = :cid AND selectionPartitionId = :spid",
    ExpressionAttributeValues: marshall({
      ":cid": "contest_123",
      ":spid": "selection_winner#2"
    })
  };

  try {
    const data = await client.send(new QueryCommand(params));
    console.log("Query successful. Items found:", data.Items.length);
    data.Items.forEach(item => console.log(unmarshall(item)));
  } catch (err) {
    console.error("Error querying records:", err);
  }
};

// Run the sandbox
const runSandbox = async () => {
  //await createTable();
  // Wait for table to be created (you might need to increase this in a real scenario)
  await new Promise(resolve => setTimeout(resolve, 10000));
 // await insertRecords();
  await queryRecords();
};

runSandbox();