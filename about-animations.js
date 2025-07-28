// About Altie Reality Section Animations
document.addEventListener('DOMContentLoaded', function() {
    // Recognition Badge Animations
    const recognitionBadges = document.querySelectorAll('.recognition-badge');
    let activeBadge = null;

    recognitionBadges.forEach(badge => {
        badge.addEventListener('click', function(e) {
            // Remove active class from previously active badge
            if (activeBadge && activeBadge !== this) {
                activeBadge.classList.remove('active');
            }

            // Toggle active state for clicked badge
            this.classList.toggle('active');
            
            // Add ripple effect
            this.classList.add('ripple');
            
            // Remove ripple class after animation
            setTimeout(() => {
                this.classList.remove('ripple');
            }, 600);

            // Update active badge reference
            if (this.classList.contains('active')) {
                activeBadge = this;
            } else {
                activeBadge = null;
            }

            // Prevent event bubbling
            e.stopPropagation();
        });

        // Add hover sound effect (optional)
        badge.addEventListener('mouseenter', function() {
            // You can add hover sound effects here if needed
            this.style.transform = 'scale(1.05)';
        });

        badge.addEventListener('mouseleave', function() {
            if (!this.classList.contains('active')) {
                this.style.transform = 'scale(1)';
            }
        });
    });

    // Team Card Animations
    const teamCards = document.querySelectorAll('.team-card');

    teamCards.forEach(card => {
        // Add click animation
        card.addEventListener('click', function(e) {
            // Add a subtle click effect
            this.style.transform = 'scale(1.08) rotateY(1deg)';
            
            setTimeout(() => {
                this.style.transform = '';
            }, 150);

            // Prevent event bubbling
            e.stopPropagation();
        });

        // Enhanced hover effects
        card.addEventListener('mouseenter', function() {
            // Add subtle glow effect
            this.style.boxShadow = '0 20px 40px rgba(126, 35, 207, 0.2)';
        });

        card.addEventListener('mouseleave', function() {
            // Reset shadow
            this.style.boxShadow = '';
        });

        // Avatar container animations
        const avatarContainer = card.querySelector('.avatar-container');
        if (avatarContainer) {
            card.addEventListener('mouseenter', function() {
                avatarContainer.style.transform = 'scale(1.1) rotateY(5deg)';
                avatarContainer.style.boxShadow = '0 10px 30px rgba(126, 35, 207, 0.3)';
            });

            card.addEventListener('mouseleave', function() {
                avatarContainer.style.transform = '';
                avatarContainer.style.boxShadow = '';
            });
        }
    });

    // Add keyboard navigation for accessibility
    recognitionBadges.forEach(badge => {
        badge.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
    });

    teamCards.forEach(card => {
        card.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
    });

    // Add smooth scroll reveal animation for the section
    const aboutSection = document.getElementById('page4-1');
    if (aboutSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, { threshold: 0.1 });

        // Add initial styles for animation
        aboutSection.style.opacity = '0';
        aboutSection.style.transform = 'translateY(30px)';
        aboutSection.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';

        observer.observe(aboutSection);
    }
});

// Utility function to reset all badge states
function resetAllBadges() {
    const recognitionBadges = document.querySelectorAll('.recognition-badge');
    recognitionBadges.forEach(badge => {
        badge.classList.remove('active');
    });
}

// Export functions for potential external use
window.aboutAnimations = {
    resetAllBadges: resetAllBadges
}; 