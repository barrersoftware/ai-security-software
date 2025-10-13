/**
 * Platform Detection and Utilities
 * Cross-platform support for Windows, Linux, macOS, BSD
 */

const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

class Platform {
  constructor() {
    this.platform = os.platform();
    this.arch = os.arch();
    this.type = os.type();
    this.release = os.release();
    this.homedir = os.homedir();
    
    // Detect specific OS details
    this.details = this.detectPlatformDetails();
  }
  
  /**
   * Detect detailed platform information
   */
  detectPlatformDetails() {
    const details = {
      platform: this.platform,
      type: this.type,
      arch: this.arch,
      isWindows: this.isWindows(),
      isLinux: this.isLinux(),
      isMacOS: this.isMacOS(),
      isBSD: this.isBSD(),
      isUnix: this.isUnix(),
      shell: this.getShell(),
      scriptExtension: this.getScriptExtension(),
      pathSeparator: path.sep,
      lineEnding: this.isWindows() ? '\r\n' : '\n'
    };
    
    // Get distribution info for Linux
    if (this.isLinux()) {
      details.distro = this.getLinuxDistro();
    }
    
    // Get Windows version
    if (this.isWindows()) {
      details.windowsVersion = this.getWindowsVersion();
    }
    
    return details;
  }
  
  /**
   * Check if running on Windows
   */
  isWindows() {
    return this.platform === 'win32';
  }
  
  /**
   * Check if running on Linux
   */
  isLinux() {
    return this.platform === 'linux';
  }
  
  /**
   * Check if running on macOS
   */
  isMacOS() {
    return this.platform === 'darwin';
  }
  
  /**
   * Check if running on BSD (FreeBSD, OpenBSD, etc.)
   */
  isBSD() {
    return this.platform === 'freebsd' || 
           this.platform === 'openbsd' || 
           this.platform === 'netbsd';
  }
  
  /**
   * Check if running on Unix-like system
   */
  isUnix() {
    return !this.isWindows();
  }
  
  /**
   * Get appropriate shell for the platform
   */
  getShell() {
    if (this.isWindows()) {
      return process.env.COMSPEC || 'cmd.exe';
    }
    return process.env.SHELL || '/bin/bash';
  }
  
  /**
   * Get script file extension
   */
  getScriptExtension() {
    if (this.isWindows()) {
      return '.ps1'; // PowerShell
    }
    return '.sh'; // Bash
  }
  
  /**
   * Get Linux distribution information
   */
  getLinuxDistro() {
    if (!this.isLinux()) return null;
    
    try {
      // Try to read /etc/os-release
      const fs = require('fs');
      if (fs.existsSync('/etc/os-release')) {
        const content = fs.readFileSync('/etc/os-release', 'utf8');
        const lines = content.split('\n');
        const distro = {};
        
        for (const line of lines) {
          const [key, ...valueParts] = line.split('=');
          if (key && valueParts.length > 0) {
            const value = valueParts.join('=').replace(/^"|"$/g, '');
            distro[key] = value;
          }
        }
        
        return {
          id: distro.ID,
          name: distro.NAME,
          version: distro.VERSION_ID,
          versionName: distro.VERSION,
          prettyName: distro.PRETTY_NAME,
          codename: distro.VERSION_CODENAME
        };
      }
      
      // Fallback to lsb_release
      const lsb = execSync('lsb_release -a 2>/dev/null || echo "Unknown"', { encoding: 'utf8' });
      return { raw: lsb.trim() };
      
    } catch (err) {
      return { error: err.message };
    }
  }
  
  /**
   * Get Windows version
   */
  getWindowsVersion() {
    if (!this.isWindows()) return null;
    
    try {
      const version = execSync('ver', { encoding: 'utf8' }).trim();
      
      // Parse Windows version
      const match = version.match(/Version (\d+\.\d+\.\d+)/);
      if (match) {
        const [major, minor, build] = match[1].split('.').map(Number);
        
        // Determine Windows name
        let name = 'Windows';
        if (major === 10 && build >= 22000) {
          name = 'Windows 11';
        } else if (major === 10) {
          name = 'Windows 10';
        } else if (major === 6) {
          if (minor === 3) name = 'Windows 8.1';
          else if (minor === 2) name = 'Windows 8';
          else if (minor === 1) name = 'Windows 7';
        }
        
        return {
          name,
          version: match[1],
          major,
          minor,
          build,
          raw: version
        };
      }
      
      return { raw: version };
      
    } catch (err) {
      return { error: err.message };
    }
  }
  
  /**
   * Get script directory path (cross-platform)
   */
  getScriptsDir() {
    // Get the root ai-security-scanner directory
    const webUiDir = path.join(__dirname, '..');
    const rootDir = path.join(webUiDir, '..');
    
    if (this.isWindows()) {
      return path.join(rootDir, 'windows', 'scripts');
    }
    
    return path.join(rootDir, 'scripts');
  }
  
  /**
   * Get appropriate script path
   */
  getScriptPath(scriptName) {
    const scriptsDir = this.getScriptsDir();
    
    if (this.isWindows()) {
      // Look for PowerShell script
      if (!scriptName.endsWith('.ps1')) {
        scriptName = scriptName.replace(/\.(sh|bash)$/, '') + '.ps1';
      }
    } else {
      // Look for bash script
      if (!scriptName.endsWith('.sh')) {
        scriptName = scriptName.replace(/\.ps1$/, '') + '.sh';
      }
    }
    
    return path.join(scriptsDir, scriptName);
  }
  
  /**
   * Execute command with platform-appropriate shell
   */
  executeCommand(command, options = {}) {
    const { spawn } = require('child_process');
    
    let shell, args;
    
    if (this.isWindows()) {
      // Use PowerShell on Windows
      shell = 'powershell.exe';
      args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command];
    } else {
      // Use bash on Unix
      shell = '/bin/bash';
      args = ['-c', command];
    }
    
    return spawn(shell, args, {
      ...options,
      shell: false // We're handling the shell ourselves
    });
  }
  
  /**
   * Execute script with platform-appropriate interpreter
   */
  executeScript(scriptPath, args = [], options = {}) {
    const { spawn } = require('child_process');
    
    let command, commandArgs;
    
    if (this.isWindows()) {
      // PowerShell script
      command = 'powershell.exe';
      commandArgs = [
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', scriptPath,
        ...args
      ];
    } else {
      // Bash script
      command = '/bin/bash';
      commandArgs = [scriptPath, ...args];
    }
    
    return spawn(command, commandArgs, options);
  }
  
  /**
   * Get temp directory
   */
  getTempDir() {
    return os.tmpdir();
  }
  
  /**
   * Get config directory
   */
  getConfigDir() {
    if (this.isWindows()) {
      return path.join(process.env.APPDATA || this.homedir, 'ai-security-scanner');
    }
    
    return path.join(this.homedir, '.ai-security-scanner');
  }
  
  /**
   * Get data directory
   */
  getDataDir() {
    if (this.isWindows()) {
      return path.join(process.env.LOCALAPPDATA || this.homedir, 'ai-security-scanner');
    }
    
    return path.join(this.homedir, '.local', 'share', 'ai-security-scanner');
  }
  
  /**
   * Get logs directory
   */
  getLogsDir() {
    if (this.isWindows()) {
      return path.join(this.getDataDir(), 'logs');
    }
    
    // Follow XDG spec on Linux
    const xdgStateHome = process.env.XDG_STATE_HOME;
    if (xdgStateHome) {
      return path.join(xdgStateHome, 'ai-security-scanner', 'logs');
    }
    
    return path.join(this.homedir, '.local', 'state', 'ai-security-scanner', 'logs');
  }
  
  /**
   * Check if command exists
   */
  commandExists(command) {
    try {
      if (this.isWindows()) {
        execSync(`where ${command}`, { stdio: 'ignore' });
      } else {
        execSync(`which ${command}`, { stdio: 'ignore' });
      }
      return true;
    } catch (err) {
      return false;
    }
  }
  
  /**
   * Get system information
   */
  getSystemInfo() {
    return {
      platform: this.details,
      hostname: os.hostname(),
      uptime: os.uptime(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus().length,
      cpuModel: os.cpus()[0]?.model || 'Unknown',
      nodeVersion: process.version,
      userInfo: os.userInfo()
    };
  }
  
  /**
   * Format system info for display
   */
  formatSystemInfo() {
    const info = this.getSystemInfo();
    const details = this.details;
    
    let output = `System Information:\n`;
    output += `─`.repeat(60) + '\n';
    
    // Platform
    if (details.isWindows) {
      output += `Platform: ${details.windowsVersion?.name || 'Windows'}\n`;
      output += `Version:  ${details.windowsVersion?.version || details.type}\n`;
    } else if (details.isLinux) {
      output += `Platform: ${details.distro?.prettyName || 'Linux'}\n`;
      output += `Distro:   ${details.distro?.name || 'Unknown'} ${details.distro?.version || ''}\n`;
    } else if (details.isMacOS) {
      output += `Platform: macOS\n`;
      output += `Version:  ${details.type} ${details.release}\n`;
    } else {
      output += `Platform: ${details.type}\n`;
    }
    
    // System details
    output += `Hostname: ${info.hostname}\n`;
    output += `Arch:     ${details.arch}\n`;
    output += `CPUs:     ${info.cpus}x ${info.cpuModel}\n`;
    output += `Memory:   ${Math.round(info.totalMemory / 1024 / 1024 / 1024)}GB total, `;
    output += `${Math.round(info.freeMemory / 1024 / 1024 / 1024)}GB free\n`;
    output += `Uptime:   ${Math.floor(info.uptime / 86400)}d ${Math.floor((info.uptime % 86400) / 3600)}h\n`;
    output += `Node:     ${info.nodeVersion}\n`;
    output += `Shell:    ${details.shell}\n`;
    output += `─`.repeat(60) + '\n';
    
    return output;
  }
}

// Export singleton instance
module.exports = new Platform();
