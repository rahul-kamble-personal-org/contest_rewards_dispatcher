variable "repo_name" {
  type        = string
  description = "Name of the repository"
}

variable "lambda_artifacts_bucket_name" {
  type        = string
  description = "Name of the S3 bucket containing Lambda artifacts"
}

resource "aws_lambda_function" "partition_processor" {
  function_name = "partitionProcessorLambda"
  s3_bucket     = var.lambda_artifacts_bucket_name
  s3_key        = "${var.repo_name}/partitionProcessorLambda.zip"
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
}

resource "aws_lambda_function" "batch_processor" {
  function_name = "batchProcessorLambda"
  s3_bucket     = var.lambda_artifacts_bucket_name
  s3_key        = "${var.repo_name}/batchProcessorLambda.zip"
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
}

# Create a specific security group for Lambda functions
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
}

# Update the IAM role to allow Lambda to access VPC resources
resource "aws_iam_role_policy_attachment" "lambda_vpc_access" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}