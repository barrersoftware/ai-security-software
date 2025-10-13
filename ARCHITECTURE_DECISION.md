# Architecture Decision: Core vs Web UI

**Date:** October 13, 2025  
**Decision:** Keep scanner core separate, rebuild Web UI with plugin system

---

## 🔍 Current Architecture Analysis

### What We Have:

```
ai-security-scanner/
├── scripts/                    # Scanner Core (Bash scripts)
│   ├── security-scanner.sh     # Main scanner - STANDALONE
│   ├── malware-scanner.sh      # Malware detection - STANDALONE
│   ├── code-review.sh          # Code review - STANDALONE
│   └── ...
│
├── compliance/                 # Compliance scanners - STANDALONE
├── cloud-security/            # Cloud scanners - STANDALONE
├── multi-server/              # Multi-server tools - STANDALONE
│
└── web-ui/                    # Web Interface (Node.js)
    ├── server.js              # Express server
    ├── routes/                # API routes
    │   └── scanner.js         # Spawns shell scripts
    └── public/                # Frontend HTML/CSS/JS
```

**Key Finding:** The scanner core (bash scripts) is ALREADY separate and standalone!

### How It Works Now:

1. **Standalone Usage:**
   ```bash
   cd /home/ubuntu/ai-security-scanner/scripts
   ./security-scanner.sh
   # Works perfectly, generates reports
   ```

2. **Web UI Usage:**
   ```javascript
   // web-ui/routes/scanner.js
   const proc = spawn('bash', ['../../scripts/security-scanner.sh']);
   // Web UI just spawns the script and displays output
   ```

**This is actually good architecture!** The scanner is decoupled.

---

## 🎯 Architecture Decision

### Option A: Full Microservices (Overkill)
```
Scanner Service (Node.js wrapper around scripts)
    ↓ HTTP
Web UI Service (Frontend + API)
```
❌ Too complex for current needs  
❌ Extra HTTP overhead  
❌ More moving parts  

### Option B: Monolithic (Current, but messy)
```
Web UI (everything in one server.js)
    ↓ spawns
Shell Scripts
```
⚠️ Current approach but server.js is bloated  
✅ Scripts are separate  
⚠️ Web UI needs cleanup  

### Option C: Plugin-based Web UI (RECOMMENDED) ✅
```
Core Web Server (minimal, plugin-aware)
    ├── Plugin: Auth
    ├── Plugin: Scanner (spawns scripts)
    ├── Plugin: Storage
    ├── Plugin: Admin
    └── Plugin: VPN (future)
        ↓ spawns
Shell Scripts (unchanged)
```
✅ Clean Web UI with plugin system  
✅ Scripts stay independent  
✅ Easy to add features (VPN, etc.)  
✅ Doesn't over-engineer  

---

## 📋 Final Architecture

### Scanner Core (No Changes Needed!)
**Location:** `/scripts`, `/compliance`, `/cloud-security`, etc.  
**Technology:** Bash scripts + Ollama  
**Purpose:** Perform security scans  
**Interface:** Command-line + file output  

**Remains completely standalone and unchanged!**

### Web UI (Rebuild with Plugins)
**Location:** `/web-ui`  
**Technology:** Node.js + Express + Plugin System  
**Purpose:** Provide web interface, API, and orchestration  
**Interface:** HTTP REST API + WebSocket  

**Structure:**
```
web-ui/
├── core/                      # Core system
│   ├── server.js              # Minimal core
│   ├── plugin-manager.js      # Plugin loader
│   ├── service-registry.js    # Service discovery
│   └── config.js              # Configuration
│
├── plugins/                   # Feature plugins
│   ├── auth/                  # Authentication
│   ├── scanner/               # Scanner orchestration
│   │   └── scanner.js         # Spawns ../scripts/*.sh
│   ├── storage/               # Reports & backups
│   ├── admin/                 # Admin features
│   └── [vpn]/                 # Future: VPN plugin
│
├── shared/                    # Shared utilities
│   ├── logger.js
│   └── utils.js
│
├── public/                    # Frontend (unchanged for now)
│
└── server.js                  # Entry point (10 lines)
```

---

## 🔄 Scanner-WebUI Integration

### How Scanner Plugin Works:

```javascript
// plugins/scanner/index.js
const { spawn } = require('child_process');
const path = require('path');

module.exports = {
  name: 'scanner',
  
  async init(core) {
    this.core = core;
    this.scriptsDir = path.join(__dirname, '../../..', 'scripts');
    this.activeScans = new Map();
  },
  
  routes() {
    const router = require('express').Router();
    
    // Start scan - spawns the bash script
    router.post('/start', (req, res) => {
      const scanId = Date.now().toString();
      const scriptPath = path.join(this.scriptsDir, 'security-scanner.sh');
      
      const proc = spawn('bash', [scriptPath]);
      this.activeScans.set(scanId, { proc, output: [] });
      
      res.json({ scanId, status: 'started' });
    });
    
    // Get scan status
    router.get('/status/:id', (req, res) => {
      const scan = this.activeScans.get(req.params.id);
      res.json(scan || { error: 'Scan not found' });
    });
    
    return router;
  },
  
  services() {
    return {
      startScan: (scriptName) => {
        // Service for other plugins to start scans
        const scriptPath = path.join(this.scriptsDir, scriptName);
        return spawn('bash', [scriptPath]);
      }
    };
  }
};
```

**The scanner scripts remain completely unchanged!**

---

## 🎯 Implementation Strategy

### Phase 1: Rebuild Web UI Core (This Session)
1. Create `web-ui/core/` with plugin system
2. Create `web-ui/plugins/` structure
3. Migrate one feature to test (auth or scanner)
4. Test that it works

**Scanner scripts:** NOT TOUCHED

### Phase 2: Migrate Web UI Features to Plugins
1. Auth plugin (auth, mfa, oauth, ids)
2. Scanner plugin (orchestrates script execution)
3. Storage plugin (reports, backups)
4. Admin plugin (admin features)
5. Compliance plugin (compliance scanners)

**Scanner scripts:** STILL NOT TOUCHED

### Phase 3: Add VPN as New Plugin
1. Create `plugins/vpn/` 
2. VPN server management
3. Connect to scanner for analysis

**Scanner scripts:** YOU GUESSED IT - NOT TOUCHED

---

## ✅ Benefits of This Approach

### For Scanner Core:
- ✅ Scripts remain standalone (can use without Web UI)
- ✅ No changes needed to existing scripts
- ✅ Easy to test scripts independently
- ✅ Can run from command line or cron
- ✅ Web UI is optional, not required

### For Web UI:
- ✅ Clean plugin-based architecture
- ✅ Easy to add features (just add plugin)
- ✅ Each feature isolated and testable
- ✅ Doesn't over-engineer what works
- ✅ Future-proof for microservices if needed

### For Development:
- ✅ Work on Web UI without affecting scanner
- ✅ Work on scanner without affecting Web UI
- ✅ Test each independently
- ✅ Clear separation of concerns

### For Users:
- ✅ Can use scanner without Web UI (CLI only)
- ✅ Can use Web UI for convenience
- ✅ Scripts work the same either way
- ✅ More flexibility in deployment

---

## 🚀 Next Steps

### Immediate (This Session):
1. ✅ Create ARCHITECTURE_DECISION.md (this file)
2. Create `web-ui/core/` system
3. Create `web-ui/plugins/` structure
4. Build first plugin (scanner or auth)
5. Test that it works

### Keep Unchanged:
- ❌ Don't touch `/scripts` directory
- ❌ Don't touch `/compliance` directory  
- ❌ Don't touch `/cloud-security` directory
- ❌ Don't touch any scanner-related bash scripts

### Future:
- Add more plugins as needed
- Keep scanner core independent
- Web UI becomes more powerful
- Everyone's happy! 🎉

---

## 💡 Key Insight

**The scanner is already well-architected!** 

The bash scripts are:
- Standalone
- Well-documented
- Can run independently
- Generate reports to files
- Work with or without Web UI

**We don't need to fix what isn't broken.**

We just need to clean up the Web UI to make it:
- More modular (plugins)
- Easier to extend (VPN, etc.)
- Better organized

---

## 📝 Summary

**Decision:** Rebuild Web UI with plugin system, leave scanner core alone.

**Why:** 
- Scanner core is already good
- Web UI needs cleanup
- Plugin system makes adding VPN easy
- Doesn't over-engineer

**Result:**
- Clean, maintainable Web UI
- Unchanged, proven scanner core
- Easy to add new features
- Everyone wins! 🏆

---

**Approved:** Ready to implement!
