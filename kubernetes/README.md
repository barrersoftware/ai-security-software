# Kubernetes Security Scanner ☸️

Comprehensive security auditing for Kubernetes clusters.

## Quick Start

```bash
cd kubernetes
./scan-k8s.sh
```

## Features

- 🔍 Pod security analysis
- 🔐 RBAC configuration check
- 🛡️ Network policies audit
- �� Secrets management review
- 📊 Resource quotas verification
- 🖼️ Container image security

## Prerequisites

- kubectl configured and connected to cluster
- Cluster access with read permissions

## What It Scans

- Privileged pods
- Pods running as root
- Missing resource limits
- Network policy configuration
- RBAC bindings
- Service account usage
- Container image tags

Report: `~/security-reports/kubernetes_security_YYYYMMDD_HHMMSS.md`
