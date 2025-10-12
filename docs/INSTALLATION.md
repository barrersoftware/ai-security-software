# Installation Guide

Complete installation instructions for AI Security Scanner.

## System Requirements

### Minimum Requirements
- **OS:** Linux, BSD, or macOS
- **RAM:** 8GB (for small models)
- **Disk:** 10GB free space
- **CPU:** 2+ cores

### Recommended Requirements
- **RAM:** 32GB (for 70B model)
- **Disk:** 50GB free space
- **CPU:** 8+ cores
- **SSD:** Recommended for better performance

## Quick Installation

```bash
git clone https://github.com/ssfdre38/ai-security-scanner.git
cd ai-security-scanner
sudo ./install.sh
```

The installer will:
1. Check and install dependencies (curl, jq)
2. Install Ollama if not present
3. Download your chosen AI model
4. Set up scripts and directories
5. Configure command-line tools

## Manual Installation

### 1. Install Dependencies

**Debian/Ubuntu:**
```bash
sudo apt-get update
sudo apt-get install curl jq
```

**CentOS/RHEL:**
```bash
sudo yum install curl jq
```

**Fedora:**
```bash
sudo dnf install curl jq
```

**macOS:**
```bash
brew install curl jq
```

**FreeBSD:**
```bash
sudo pkg install curl jq
```

### 2. Install Ollama

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**macOS:**
```bash
brew install ollama
```

Or download from [ollama.com](https://ollama.com/download)

### 3. Start Ollama Service

**Linux (systemd):**
```bash
sudo systemctl enable ollama
sudo systemctl start ollama
```

**Linux (without systemd) / macOS:**
```bash
ollama serve &
```

### 4. Install AI Model

Choose based on your RAM:

**For 8GB RAM:**
```bash
ollama pull llama3.2:3b
```

**For 16GB RAM:**
```bash
ollama pull llama3.1:8b
```

**For 32GB+ RAM:**
```bash
ollama pull llama3.1:70b
```

### 5. Install Scripts

```bash
git clone https://github.com/ssfdre38/ai-security-scanner.git
cd ai-security-scanner
chmod +x scripts/*.sh install.sh

# System-wide installation (requires root)
sudo mkdir -p /opt/ai-security-scanner
sudo cp -r scripts/* /opt/ai-security-scanner/
sudo ln -s /opt/ai-security-scanner/security-scanner.sh /usr/local/bin/ai-security-scan
sudo ln -s /opt/ai-security-scanner/security-monitor.sh /usr/local/bin/ai-security-monitor
sudo ln -s /opt/ai-security-scanner/code-review.sh /usr/local/bin/ai-code-review
sudo ln -s /opt/ai-security-scanner/security-chat.sh /usr/local/bin/ai-security-chat

# OR user installation (no root needed)
mkdir -p ~/.local/bin
mkdir -p ~/.ai-security-scanner
cp -r scripts/* ~/.ai-security-scanner/
ln -s ~/.ai-security-scanner/security-scanner.sh ~/.local/bin/ai-security-scan
ln -s ~/.ai-security-scanner/security-monitor.sh ~/.local/bin/ai-security-monitor
ln -s ~/.ai-security-scanner/code-review.sh ~/.local/bin/ai-code-review
ln -s ~/.ai-security-scanner/security-chat.sh ~/.local/bin/ai-security-chat

# Add to PATH
echo 'export PATH="$PATH:~/.local/bin"' >> ~/.bashrc
source ~/.bashrc
```

### 6. Create Report Directory

```bash
mkdir -p ~/security-reports
```

## Verification

Test the installation:

```bash
# Check Ollama is running
ollama ps

# Test AI model
ollama run llama3.1:8b "Hello"

# Run first scan
ai-security-scan

# Check report was created
ls -l ~/security-reports/
```

## Troubleshooting

### Ollama won't start
```bash
# Check logs
journalctl -u ollama -f

# Or manually run to see errors
ollama serve
```

### Model download fails
- Check internet connection
- Verify disk space: `df -h`
- Try smaller model first
- Check Ollama status: `systemctl status ollama`

### Command not found
Add to PATH:
```bash
echo 'export PATH="$PATH:/usr/local/bin:~/.local/bin"' >> ~/.bashrc
source ~/.bashrc
```

### Permission denied
```bash
chmod +x ~/.ai-security-scanner/*.sh
# Or for system-wide:
sudo chmod +x /opt/ai-security-scanner/*.sh
```

## Updating

```bash
cd ai-security-scanner
git pull
chmod +x scripts/*.sh
# Re-run installer or manually copy scripts
```

## Uninstallation

```bash
# Remove scripts
sudo rm -rf /opt/ai-security-scanner
sudo rm /usr/local/bin/ai-security-*

# Or for user installation
rm -rf ~/.ai-security-scanner
rm ~/.local/bin/ai-security-*

# Remove Ollama (optional)
sudo systemctl stop ollama
sudo systemctl disable ollama
sudo rm -rf /usr/local/bin/ollama
sudo rm -rf /usr/share/ollama
sudo rm /etc/systemd/system/ollama.service

# Remove models and data (optional - will delete all models!)
rm -rf ~/.ollama

# Remove reports (optional)
rm -rf ~/security-reports
```

## Next Steps

1. [Run your first scan](../README.md#quick-start)
2. [Configure automated scans](CONFIGURATION.md#automated-scanning)
3. [Customize for your environment](CONFIGURATION.md)
