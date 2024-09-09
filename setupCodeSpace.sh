#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# Update package list
sudo apt update

# Install Node.js
echo "Installing Node.js..."
sudo apt install -y nodejs npm
node --version
npm --version

# Install Terraform
echo "Installing Terraform..."
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install -y terraform
terraform --version

echo "Installation complete!"