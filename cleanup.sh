#!/bin/bash

# Script to find and delete all node_modules folders in the current directory and subdirectories

echo "Searching for node_modules folders..."

# Find and delete all node_modules directories
found_dirs=$(find . -name "node_modules" -type d)

# Check if any directories were found
if [ -z "$found_dirs" ]; then
    echo "No node_modules folders found."
    exit 0
fi

# Count the number of directories found
dir_count=$(echo "$found_dirs" | wc -l)
echo "Found $dir_count node_modules folder(s)."

# Delete the directories
echo "$found_dirs" | while IFS= read -r dir; do
    echo "Deleting: $dir"
    rm -rf "$dir"
done

echo "Deletion complete. Removed $dir_count node_modules folder(s)."