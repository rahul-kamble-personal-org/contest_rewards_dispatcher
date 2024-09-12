# resource "aws_dynamodb_table" "contest_participants" {
#   name           = "ContestParticipants"
#   billing_mode   = "PROVISIONED"
#   read_capacity  = 5
#   write_capacity = 5
#   hash_key       = "contestId"
#   range_key      = "userId"

#   attribute {
#     name = "contestId"
#     type = "S"
#   }

#   attribute {
#     name = "userId"
#     type = "S"
#   }

#   attribute {
#     name = "selectionId"
#     type = "S"
#   }

#   global_secondary_index {
#     name            = "SelectionPartitionIndex"
#     hash_key        = "contestId"
#     range_key       = "selectionId"
#     write_capacity  = 5
#     read_capacity   = 5
#     projection_type = "ALL"
#   }
# }