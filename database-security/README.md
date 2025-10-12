# Database Security Scanner 🗄️

Security auditing for MySQL, PostgreSQL, MongoDB, and Redis.

## Quick Start

```bash
cd database-security

# Scan all databases
./scan-databases.sh --all

# Scan specific database
./scan-databases.sh --mysql
```

## Features

- 🔍 Connection security analysis
- 🔐 Authentication configuration
- 🔒 Encryption status
- 🌐 Public exposure check
- 📊 Configuration review

## Supported Databases

- MySQL/MariaDB
- PostgreSQL
- MongoDB
- Redis

## Usage

```bash
# Scan all
./scan-databases.sh --all

# Specific databases
./scan-databases.sh --mysql --postgresql

# Individual
./scan-databases.sh --mongodb
```

Report: `~/security-reports/database_security_YYYYMMDD_HHMMSS.md`
