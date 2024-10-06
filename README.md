Youtube Video - https://youtu.be/lSXb3sRePMk?si=gO1Ovg-JF8CYKpho

This repo sets up an AWS infrastructure for a contest processing system. Here's an overview of the main components:

## Resources Created

1. **IAM Roles and Policies**
   - Lambda execution role with VPC access and specific permissions
   - Step Functions execution role with Lambda invocation permissions

2. **Lambda Functions**
   - Partition Processor: Handles processing for individual partitions
   - Batch Processor: Processes batches of data

3. **Step Functions State Machine**
   - Orchestrates the contest processing workflow
   - Iterates over partitions and invokes the Partition Processor Lambda

## Key Features

- VPC integration for Lambda functions
- Configurable concurrency for Lambda functions
- S3-based deployment for Lambda artifacts
- Parameterized setup with variables for flexibility
- Tagging strategy for resource management

## Variables

- Repository name
- Lambda artifact bucket name
- Git commit SHA for versioning
- AWS region
- Concurrency settings for Lambda functions

## Notes

- The Batch Processor Lambda has optional reserved concurrency
- The Step Functions State Machine processes partitions with a maximum concurrency of 2
- Both Lambda functions are deployed in a VPC for enhanced security

This configuration provides a scalable and secure foundation for processing contest data in AWS.
