// Frontend authentication handler

class AuthManager {
    constructor() {
        this.token = localStorage.getItem('authToken');
        this.user = JSON.parse(localStorage.getItem('user') || 'null');
    }

    isAuthenticated() {
        return this.token !== null;
    }

    getToken() {
        return this.token;
    }

    getUser() {
        return this.user;
    }

    isAdmin() {
        return this.user && this.user.role === 'admin';
    }

    async checkAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = '/login.html';
            return false;
        }

        // Verify token is still valid
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                this.logout();
                return false;
            }

            const data = await response.json();
            this.user = data.user;
            localStorage.setItem('user', JSON.stringify(this.user));
            return true;
        } catch (error) {
            console.error('Auth check failed:', error);
            this.logout();
            return false;
        }
    }

    async logout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }

        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    }

    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    async apiCall(url, options = {}) {
        options.headers = {
            ...this.getAuthHeaders(),
            ...options.headers
        };

        const response = await fetch(url, options);

        if (response.status === 401) {
            this.logout();
            throw new Error('Unauthorized');
        }

        return response;
    }
}

// Global auth manager instance
const authManager = new AuthManager();

// Check auth on page load
document.addEventListener('DOMContentLoaded', async () => {
    const isAuth = await authManager.checkAuth();
    if (isAuth) {
        initializeApp();
    }
});

function initializeApp() {
    // Display user info
    const user = authManager.getUser();
    if (user) {
        // Add user info to header
        const headerStatus = document.querySelector('.header-status');
        if (headerStatus) {
            const userInfo = document.createElement('div');
            userInfo.className = 'user-info';
            userInfo.innerHTML = `
                <span class="user-name">👤 ${user.username}</span>
                ${user.role === 'admin' ? '<span class="admin-badge">Admin</span>' : ''}
                <button class="btn-logout" onclick="authManager.logout()">Logout</button>
            `;
            headerStatus.appendChild(userInfo);
        }

        // Show admin features if admin
        if (authManager.isAdmin()) {
            document.querySelectorAll('.admin-only').forEach(el => {
                el.style.display = 'block';
            });
        }
    }
}
