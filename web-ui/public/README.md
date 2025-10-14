# AI Security Scanner - Web UI Dashboard

Modern, responsive web dashboard for managing all 18 plugins of the AI Security Scanner.

## Features

### 🎨 Modern Design
- Clean, professional interface
- Responsive layout (desktop, tablet, mobile)
- Smooth animations and transitions
- Consistent color scheme and typography

### 📊 Dashboard Overview
- System statistics at a glance
- Recent scans and activity
- System health monitoring
- Quick action buttons

### 🔌 Plugin Integration
All 18 plugins accessible through organized menu:

**Dashboard**
- Overview - System stats and quick actions
- Analytics - Performance metrics

**Security** (5 plugins)
- Scanner - Security scanning
- Policies - Custom scanning policies
- VPN - VPN integration
- Rate Limiting - DDoS protection
- Security Services - CSRF, encryption, headers

**Access Management** (3 plugins)
- Authentication - Login, MFA, OAuth, LDAP
- Users - User management (SQLite)
- Tenants - Multi-tenancy management

**Monitoring** (4 plugins)
- Audit Logs - Compliance reporting
- API Analytics - API usage tracking
- System Info - System information
- Multi-Server - Multi-server management

**Reports & Data** (3 plugins)
- Reporting - PDF/HTML report generation
- Storage - File storage
- Backup & Recovery - Backup management

**Integrations** (2 plugins)
- Webhooks - Webhook management
- Notifications - Alert system

**System** (1 plugin)
- Updates - System updates

### ⚡ Key Features
- **Grouped Side Menu** - Organized into logical sections
- **Collapsible Menu** - Save screen space
- **Global Search** - Find anything quickly
- **Connection Status** - Real-time connection monitoring
- **User Menu** - Profile, settings, logout
- **Toast Notifications** - Non-intrusive alerts
- **Dynamic Content** - Load views on demand
- **API Client** - Full REST API integration

## Files

```
web-ui/public/
├── dashboard.html          # Main dashboard interface
├── login.html              # Login page (existing)
├── css/
│   └── dashboard.css       # Dashboard styles
├── js/
│   ├── dashboard.js        # Main dashboard logic
│   ├── api-client.js       # API client for all plugins
│   └── views.js            # Plugin-specific views (to be created)
└── README.md               # This file
```

## Usage

### Accessing the Dashboard

1. Start the server:
```bash
cd /home/ubuntu/ai-security-scanner
npm start
```

2. Open browser and navigate to:
```
http://localhost:3000/dashboard.html
```

### Menu Structure

The side menu is organized into 6 sections with 18 total items:
- Dashboard (2 items)
- Security (5 items)
- Access Management (3 items)
- Monitoring (4 items)
- Reports & Data (3 items)
- Integrations (2 items)
- System (1 item)

### Navigation

- Click any menu item to load that plugin's view
- Use the hamburger menu (☰) to collapse/expand the sidebar
- Search bar for quick navigation
- User menu for profile and settings

## API Integration

The `api-client.js` provides methods for all 18 plugins:

```javascript
// Example: Get users
const users = await api.getUsers({ page: 1, limit: 50 });

// Example: Start scan
const scan = await api.startScan({
    target: '192.168.1.1',
    type: 'full'
});

// Example: Generate report
const report = await api.generateReport({
    name: 'Security Report',
    format: 'pdf'
});
```

## Customization

### Adding Plugin Views

Create plugin-specific views in `js/views.js`:

```javascript
// Example: Custom scanner view
const scannerView = {
    title: 'Security Scanner',
    html: renderScannerForm(),
    init: initializeScanner
};
```

### Styling

Modify `css/dashboard.css`:
- CSS variables for colors and sizes at `:root`
- Responsive breakpoints for mobile
- Component-specific styles

### API Endpoints

Modify `js/api-client.js` to add/update API methods.

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers

## Responsive Design

- Desktop: Full sidebar, all features visible
- Tablet: Collapsible sidebar
- Mobile: Off-canvas menu, optimized layout

## Security

- Token-based authentication
- Automatic logout on 401
- Secure API communication
- CSRF protection (via security plugin)

## Development

### Adding New Features

1. Update HTML in `dashboard.html`
2. Add styles in `css/dashboard.css`
3. Add logic in `js/dashboard.js`
4. Add API methods in `js/api-client.js`

### Testing

Test all plugin integrations:
```bash
# Run integration tests
node test-v4-complete-integration.js
```

## Next Steps

1. **Plugin-Specific Views** - Detailed interfaces for each plugin
2. **Charts & Graphs** - Visualize data with Chart.js
3. **Real-time Updates** - WebSocket integration
4. **User Preferences** - Customizable dashboard
5. **Dark Mode** - Theme switching
6. **Mobile App** - Progressive Web App (PWA)

## Version

**v4.11.0** - Initial Web UI Release
- Modern dashboard interface
- All 18 plugins accessible
- Responsive design
- Complete API integration

## Support

For issues or questions:
- Check the main project README
- Review plugin documentation
- Check API endpoints

---

**Status:** ✅ Ready for use
**Last Updated:** 2025-10-14
**Maintainer:** AI Security Scanner Team
