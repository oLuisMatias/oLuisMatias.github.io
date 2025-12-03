// ===================================
// NAVIGATION AUTHENTICATION
// Hide protected links when not logged in
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is authenticated
    const isAuthenticated = sessionStorage.getItem('isAuthenticated') === 'true';
    
    // List of protected pages (without .html)
    const protectedPages = ['filaments', 'private'];
    
    // Get all navigation links
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        
        // Check if this link is to a protected page
        protectedPages.forEach(page => {
            if (href && href.includes(page + '.html')) {
                if (!isAuthenticated) {
                    // Hide the link if not authenticated
                    link.parentElement.style.display = 'none';
                } else {
                    // Show the link if authenticated
                    link.parentElement.style.display = 'block';
                }
            }
        });
    });
});
