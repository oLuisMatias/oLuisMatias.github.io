// ===================================
// SIMPLE PASSWORD PROTECTION
// ===================================

class Auth {
    constructor() {
        // Change this password to whatever you want
        this.password = 'abcdeabcde';
        this.sessionKey = 'isAuthenticated';
    }
    
    // Check if user is authenticated
    isAuthenticated() {
        return sessionStorage.getItem(this.sessionKey) === 'true';
    }
    
    // Authenticate user
    authenticate(inputPassword) {
        if (inputPassword === this.password) {
            sessionStorage.setItem(this.sessionKey, 'true');
            return true;
        }
        return false;
    }
    
    // Logout user
    logout() {
        sessionStorage.removeItem(this.sessionKey);
        window.location.href = 'login.html';
    }
    
    // Protect a page - redirect to login if not authenticated
    protectPage() {
        if (!this.isAuthenticated()) {
            // Store the current page to redirect back after login
            sessionStorage.setItem('redirectAfterLogin', window.location.pathname);
            window.location.href = 'login.html';
        }
    }
    
    // Redirect to intended page after login
    redirectAfterLogin() {
        const redirectTo = sessionStorage.getItem('redirectAfterLogin') || 'index.html';
        sessionStorage.removeItem('redirectAfterLogin');
        window.location.href = redirectTo;
    }
}

// Create global auth instance
window.auth = new Auth();
