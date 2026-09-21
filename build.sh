#!/usr/bin/env bash
# exit on error
set -o errexit

# Install Python backend dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Build React GIS Frontend
cd frontend
npm install
npm run build
cd ..
