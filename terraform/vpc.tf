# VPC
data "aws_vpc" "main" {
  filter {
    name   = "tag:Name"
    values = ["main-vpc"]
  }
}

# Public Subnets
data "aws_subnets" "public" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }

  filter {
    name   = "tag:Name"
    values = ["Public Subnet 1", "Public Subnet 2"]
  }
}

# Private Subnets
data "aws_subnets" "private" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.main.id]
  }

  filter {
    name   = "tag:Name"
    values = ["Private Subnet 1", "Private Subnet 2"]
  }
}

# Internet Gateway
data "aws_internet_gateway" "main" {
  filter {
    name   = "attachment.vpc-id"
    values = [data.aws_vpc.main.id]
  }
}

# Route Tables
data "aws_route_table" "public" {
  vpc_id = data.aws_vpc.main.id

  filter {
    name   = "tag:Name"
    values = ["Public Route Table"]
  }
}

data "aws_route_table" "private" {
  vpc_id = data.aws_vpc.main.id

  filter {
    name   = "tag:Name"
    values = ["Private Route Table"]
  }
}

# Security Group
data "aws_security_group" "allow_ssh" {
  vpc_id = data.aws_vpc.main.id

  filter {
    name   = "group-name"
    values = ["allow_ssh"]
  }
}