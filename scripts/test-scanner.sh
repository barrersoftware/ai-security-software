#!/bin/bash
# Test script for scanner plugin
echo "=== Test Scanner Started ==="
echo "Timestamp: $(date)"
echo "Platform: $(uname -s)"
echo "Hostname: $(hostname)"
echo "User: $(whoami)"
sleep 2
echo "Running simulated scan..."
sleep 1
echo "Progress: 25%"
sleep 1
echo "Progress: 50%"
sleep 1
echo "Progress: 75%"
sleep 1
echo "Progress: 100%"
echo "=== Test Scanner Complete ==="
exit 0
