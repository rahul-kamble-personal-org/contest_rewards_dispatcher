# Variables
variable "repo_name" {
  type        = string
  description = "Name of the repository"
}

variable "lambda_artifacts_bucket_name" {
  type        = string
  description = "Name of the S3 bucket containing Lambda artifacts"
}

variable "commit_sha" {
  type        = string
  description = "Short SHA of the Git commit"
}

# IAM Role for Lambda functions
resource "aws_iam_role" "lambda_role" {
  name = "lambda_execution_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
  tags = merge(local.default_tags, {
    Name = "LambdaExecutionRole"
  })
}

# IAM Policy attachment for Lambda VPC access
resource "aws_iam_role_policy_attachment" "lambda_vpc_access" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

# IAM Policy for Lambda to invoke other Lambda functions
resource "aws_iam_role_policy" "lambda_invoke_policy" {
  name = "lambda_invoke_policy"
  role = aws_iam_role.lambda_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          aws_lambda_function.batch_processor.arn
        ]
      }
    ]
  })
}

# Lambda function: Partition Processor
resource "aws_lambda_function" "partition_processor" {
  function_name = "partitionProcessorLambda"
  s3_bucket     = var.lambda_artifacts_bucket_name
  s3_key        = "${var.repo_name}/partitionProcessorLambda_${var.commit_sha}.zip"
  handler       = "dist/index.handler"
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_role.arn
  vpc_config {
    subnet_ids         = data.aws_subnets.private.ids
    security_group_ids = [aws_security_group.lambda_sg.id]
  }
  environment {
    variables = {
      BATCH_PROCESSOR_FUNCTION_NAME = aws_lambda_function.batch_processor.function_name
    }
  }
  tags = merge(local.default_tags, {
    Name = "PartitionProcessorLambda"
  })
}

# Lambda function: Batch Processor
resource "aws_lambda_function" "batch_processor" {
  function_name = "batchProcessorLambda"
  s3_bucket     = var.lambda_artifacts_bucket_name
  s3_key        = "${var.repo_name}/batchProcessorLambda_${var.commit_sha}.zip"
  handler       = "dist/index.handler"
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_role.arn
  vpc_config {
    subnet_ids         = data.aws_subnets.private.ids
    security_group_ids = [aws_security_group.lambda_sg.id]
  }
  tags = merge(local.default_tags, {
    Name = "BatchProcessorLambda"
  })
}

# Security group for Lambda functions
resource "aws_security_group" "lambda_sg" {
  name        = "lambda-security-group"
  description = "Security group for Lambda functions"
  vpc_id      = data.aws_vpc.main.id
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
  tags = merge(local.default_tags, {
    Name = "LambdaSecurityGroup"
  })
}

# Step Functions State Machine
# Step Functions State Machine
resource "aws_sfn_state_machine" "contest_processor" {
  name     = "ContestProcessor"
  role_arn = aws_iam_role.step_functions_role.arn

  definition = jsonencode({
    "Comment" = "Process contest participants across partitions with memory-efficient batch processing"
    "StartAt" = "InitializePartitions"
    "States" = {
      "InitializePartitions" = {
        "Type" = "Pass"
        "Result" = {
          "partitions" = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        }
        "ResultPath" = "$.partitions"
        "Next"       = "ProcessPartitions"
      }
      "ProcessPartitions" = {
        "Type"      = "Map"
        "InputPath" = "$"
        "ItemsPath" = "$.partitions"
        "Parameters" = {
          "contestId.$" : "$.contestId"
          "winningSelectionId.$" : "$.winningSelectionId"
          "metadata.$" : "$.metadata"
          "processingConfig.$" : "$.processingConfig"
          "partitionId.$" : "$$.Map.Item.Value"
        }
        "MaxConcurrency" = 10
        "Iterator" = {
          "StartAt" = "FetchAndProcessPartition"
          "States" = {
            "FetchAndProcessPartition" = {
              "Type"     = "Task"
              "Resource" = "arn:aws:states:::lambda:invoke"
              "Parameters" = {
                "FunctionName" = aws_lambda_function.partition_processor.arn
                "Payload.$"    = "$"
              }
              "End" = true
            }
          }
        }
        "Next" = "FinalizeProcessing"
      }
      "FinalizeProcessing" = {
        "Type" = "Pass"
        "Result" = {
          "status" = "completed"
        }
        "End" = true
      }
    }
  })

  tags = merge(local.default_tags, {
    Name = "ContestProcessorStateMachine"
  })
}

# IAM Role for Step Functions
resource "aws_iam_role" "step_functions_role" {
  name = "step_functions_execution_role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "states.amazonaws.com"
        }
      }
    ]
  })
  tags = merge(local.default_tags, {
    Name = "StepFunctionsExecutionRole"
  })
}

# IAM Policy for Step Functions to invoke Lambda
resource "aws_iam_role_policy" "step_functions_lambda_invoke" {
  name = "step_functions_lambda_invoke_policy"
  role = aws_iam_role.step_functions_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "lambda:InvokeFunction"
        ]
        Resource = [
          aws_lambda_function.partition_processor.arn,
          aws_lambda_function.batch_processor.arn
        ]
      }
    ]
  })
}