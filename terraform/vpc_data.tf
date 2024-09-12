# # Data block to fetch the VPC
# data "aws_vpc" "main" {
#   filter {
#     name   = "tag:Name"
#     values = ["main-vpc"]
#   }
# }

# # Data block to fetch the private subnet
# data "aws_subnet" "private" {
#   filter {
#     name   = "tag:Name"
#     values = ["Private Subnet"]
#   }
#   vpc_id = data.aws_vpc.main.id
# }

# # Data block to fetch the security group
# data "aws_security_group" "allow_internal" {
#   name   = "allow_internal"
#   vpc_id = data.aws_vpc.main.id
# }