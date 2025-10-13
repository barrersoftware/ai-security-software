#!/bin/bash
# Quick launcher for AI Security Scanner test container

echo "🚀 Starting AI Security Scanner Test Container..."
echo ""
echo "This will:"
echo "  - Start a fresh Ubuntu 22.04 container"
echo "  - Clone the v4 branch"
echo "  - Run automated tests"
echo ""

docker run -it --privileged --rm --name ai-scanner-test ai-scanner-test:latest bash -c "
  echo '=== AI Security Scanner v4.0.0 Test ==='
  echo ''
  ./test-scanner.sh
  echo ''
  echo '=== Test Complete ==='
  echo ''
  echo 'Container will remain open for manual testing.'
  echo 'Type exit to quit.'
  echo ''
  bash
"
