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

# Lambda function: Partition Processor
resource "aws_lambda_function" "partition_processor" {
  function_name = "partitionProcessorLambda"
  s3_bucket     = var.lambda_artifacts_bucket_name
  s3_key        = "${var.repo_name}/partitionProcessorLambda_${var.commit_sha}.zip"
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_role.arn

  vpc_config {
    subnet_ids         = data.aws_subnets.private.ids
    security_group_ids = [aws_security_group.lambda_sg.id]
  }

  environment {
    variables = {
      # Add any environment variables needed for the function
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
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  role          = aws_iam_role.lambda_role.arn

  vpc_config {
    subnet_ids         = data.aws_subnets.private.ids
    security_group_ids = [aws_security_group.lambda_sg.id]
  }

  environment {
    variables = {
      # Add any environment variables needed for the function
    }
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

  # Add any necessary ingress rules here

  tags = merge(local.default_tags, {
    Name = "LambdaSecurityGroup"
  })
}