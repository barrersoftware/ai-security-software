# AI Security Scanner Web UI 🖥️

Modern, real-time web dashboard for the AI Security Scanner. Monitor scans, view reports, and interact with your AI security assistant from your browser.

## Features

- 📊 **Real-time Dashboard** - Live system status and security metrics
- 🔍 **Scan Management** - Start and monitor security scans from the browser
- 📄 **Report Viewer** - Browse and view security reports with markdown rendering
- 💬 **AI Chat Assistant** - Interactive security consultation
- ⚙️ **System Monitor** - Track resources and AI model status
- 🔄 **Live Updates** - WebSocket-based real-time notifications
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile

## Quick Start

### Installation

```bash
cd web-ui
npm install
```

### Start the Dashboard

```bash
./start-web-ui.sh
```

Or manually:

```bash
npm start
```

The dashboard will be available at `http://localhost:3000`

### Custom Port

```bash
PORT=8080 ./start-web-ui.sh
```

## Usage

### Dashboard Tab

View system overview, security status, recent activity, and latest reports. The dashboard auto-refreshes every 30 seconds to keep you informed.

### Scanner Tab

- **Comprehensive Scan**: Full system security audit
- **Code Review**: Analyze specific code directories for vulnerabilities
- Monitor active scans in real-time
- View live scan output

### Reports Tab

- Browse all generated security reports
- Click any report to view full content
- Reports are automatically rendered from Markdown
- Filter by type (comprehensive, code-review, monitor)

### AI Assistant Tab

Interactive chat with your AI security expert. Ask questions about:
- Security best practices
- Threat analysis
- Configuration hardening
- Incident response
- Vulnerability assessment

Example questions:
```
"How do I secure my SSH configuration?"
"What are signs of a compromised server?"
"Analyze this suspicious IP: 45.135.194.73"
"Best practices for Docker security?"
```

### System Tab

View detailed system information:
- CPU, memory, and disk usage
- Installed AI models
- Service status (Ollama, firewall, fail2ban)
- System uptime and load average

## API Endpoints

### Scanner

- `POST /api/scanner/start` - Start comprehensive scan
- `POST /api/scanner/code-review` - Start code review
- `GET /api/scanner/status` - Get active scans
- `GET /api/scanner/:scanId` - Get scan details
- `POST /api/scanner/:scanId/stop` - Stop a scan

### Reports

- `GET /api/reports/` - List all reports
- `GET /api/reports/:filename` - Get report content
- `DELETE /api/reports/:filename` - Delete a report
- `GET /api/reports/stats/summary` - Get report statistics

### Chat

- `POST /api/chat/message` - Send message to AI assistant
- `GET /api/chat/status` - Check AI model availability

### System

- `GET /api/system/info` - Get system information
- `GET /api/system/disk` - Get disk usage
- `GET /api/system/ollama/status` - Check Ollama service
- `GET /api/system/security/summary` - Get security status

## WebSocket Events

The UI uses WebSockets for real-time updates:

- `new_report` - New report generated
- `report_updated` - Existing report updated
- `scan_progress` - Live scan output
- `scan_complete` - Scan finished

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

### Customization

Edit `public/css/style.css` to customize colors and styling. The CSS uses custom properties:

```css
:root {
    --primary-color: #2563eb;
    --secondary-color: #64748b;
    --success-color: #10b981;
    --danger-color: #ef4444;
    --warning-color: #f59e0b;
}
```

## Security

The Web UI runs locally and does not expose sensitive data externally. However:

- **Access Control**: Consider placing behind nginx with basic auth for production
- **Firewall**: Only expose port 3000 to trusted networks
- **HTTPS**: Use a reverse proxy for SSL/TLS in production
- **Permissions**: Runs scans with same permissions as the user

### Production Deployment

For production use, we recommend:

1. **Nginx Reverse Proxy**:
```nginx
location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

2. **Systemd Service**:
```ini
[Unit]
Description=AI Security Scanner Web UI
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/path/to/ai-security-scanner/web-ui
ExecStart=/usr/bin/node server.js
Restart=always
Environment=PORT=3000
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

3. **Basic Authentication**:
Install `express-basic-auth`:
```bash
npm install express-basic-auth
```

Add to `server.js`:
```javascript
const basicAuth = require('express-basic-auth');

app.use(basicAuth({
    users: { 'admin': 'your-secure-password' },
    challenge: true
}));
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 3000
lsof -i :3000

# Use a different port
PORT=8080 ./start-web-ui.sh
```

### WebSocket Connection Failed

- Check firewall allows port 3000
- Verify Ollama service is running: `systemctl status ollama`
- Check browser console for errors

### Scans Not Starting

- Verify scripts directory exists: `../scripts/`
- Check script permissions: `ls -la ../scripts/`
- View server logs for errors

### AI Chat Not Responding

- Ensure Ollama is running: `systemctl start ollama`
- Check model is installed: `ollama list`
- Install recommended model: `ollama pull llama3.1:8b`

## Development

### Project Structure

```
web-ui/
├── server.js           # Express server & WebSocket
├── package.json        # Dependencies
├── start-web-ui.sh     # Startup script
├── public/             # Frontend assets
│   ├── index.html      # Main HTML
│   ├── css/
│   │   └── style.css   # Styling
│   └── js/
│       └── app.js      # Frontend logic
└── routes/             # API routes
    ├── scanner.js      # Scan management
    ├── reports.js      # Report handling
    ├── chat.js         # AI assistant
    └── system.js       # System info
```

### Adding New Features

1. Add API route in `routes/`
2. Register route in `server.js`
3. Update frontend in `public/js/app.js`
4. Add UI elements in `public/index.html`
5. Style in `public/css/style.css`

### Testing

```bash
npm test
```

## Performance

- **Memory**: ~50-100MB for web server
- **CPU**: Minimal when idle, increases during scans
- **Connections**: Supports multiple simultaneous clients
- **Reports**: Efficiently handles thousands of reports

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Opera 76+

## License

MIT License - see LICENSE file for details

## Contributing

Contributions welcome! Areas for improvement:

- [ ] User authentication system
- [ ] Scheduled scan configuration UI
- [ ] Report comparison tool
- [ ] Export reports to PDF
- [ ] Dark/light theme toggle
- [ ] Notification system
- [ ] Multi-language support

---

**Need help?** Open an issue on GitHub or check the main README.md
