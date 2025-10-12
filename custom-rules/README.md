# Custom Security Rules Engine 🎯

Define and run your own security checks using YAML configuration.

## Quick Start

```bash
cd custom-rules
cp rules.yaml.example rules.yaml
# Edit rules.yaml with your custom rules
./run-rules.sh
```

## Features

- 📝 YAML-based rule definitions
- ⚡ Parallel execution
- 🎨 Severity levels (critical, warning, info)
- 📊 Rule groups for organization
- 🔧 Custom remediation instructions

## Usage

```bash
# Run all rules
./run-rules.sh

# Run specific group
./run-rules.sh --group web-security

# Run by severity
./run-rules.sh --severity critical

# Run specific rule
./run-rules.sh --id custom-001
```

See rules.yaml.example for rule format and examples.
