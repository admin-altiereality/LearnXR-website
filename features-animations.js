// Powerful Features Section Animations
document.addEventListener('DOMContentLoaded', function() {
    const featuresSection = document.getElementById('powerful-features');
    const featureCards = document.querySelectorAll('.feature-card');
    const featureTitle = document.querySelector('.feature-title');
    const featureSubtitle = document.querySelector('.feature-subtitle');
    const featureListItems = document.querySelectorAll('.feature-list-item');

    // Intersection Observer for scroll-triggered animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const featuresObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Trigger title and subtitle animations
                if (featureTitle) {
                    featureTitle.style.opacity = '1';
                    featureTitle.style.transform = 'translateY(0)';
                }
                
                if (featureSubtitle) {
                    featureSubtitle.style.opacity = '1';
                    featureSubtitle.style.transform = 'translateY(0)';
                }

                // Trigger staggered card animations
                featureCards.forEach((card, index) => {
                    setTimeout(() => {
                        card.style.opacity = '1';
                        card.style.transform = 'translateY(0)';
                    }, 300 + (index * 200));
                });

                // Stop observing after animation
                featuresObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe the features section
    if (featuresSection) {
        featuresObserver.observe(featuresSection);
    }

    // Enhanced hover effects for feature cards
    featureCards.forEach(card => {
        const icon = card.querySelector('.feature-icon');
        const listItems = card.querySelectorAll('.feature-list-item');
        const iconContainer = card.querySelector('.feature-icon-container');

        // Card hover effects
        card.addEventListener('mouseenter', function() {
            // Add subtle rotation and scale
            this.style.transform = 'translateY(-8px) scale(1.02) rotateY(2deg)';
            
            // Animate list items with staggered delay
            listItems.forEach((item, index) => {
                setTimeout(() => {
                    item.style.opacity = '1';
                    item.style.transform = 'translateX(0)';
                }, 100 + (index * 100));
            });

            // Icon animation
            if (icon) {
                icon.style.transform = 'scale(1.1)';
            }

            // Icon container glow effect
            if (iconContainer) {
                iconContainer.style.boxShadow = '0 10px 30px rgba(126, 35, 207, 0.3)';
            }
        });

        card.addEventListener('mouseleave', function() {
            // Reset card transform
            this.style.transform = '';
            
            // Reset list items
            listItems.forEach(item => {
                item.style.opacity = '0';
                item.style.transform = 'translateX(4px)';
            });

            // Reset icon
            if (icon) {
                icon.style.transform = '';
            }

            // Reset icon container
            if (iconContainer) {
                iconContainer.style.boxShadow = '';
            }
        });

        // Click effect
        card.addEventListener('click', function(e) {
            // Add click animation
            this.style.transform = 'scale(0.98) rotateY(1deg)';
            
            setTimeout(() => {
                this.style.transform = '';
            }, 150);

            // Prevent event bubbling
            e.stopPropagation();
        });

        // Keyboard navigation
        card.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });

        // Focus effects for accessibility
        card.addEventListener('focus', function() {
            this.style.outline = '2px solid rgba(126, 35, 207, 0.5)';
            this.style.outlineOffset = '2px';
        });

        card.addEventListener('blur', function() {
            this.style.outline = '';
            this.style.outlineOffset = '';
        });
    });

    // Floating elements animation
    const floatingElements = document.querySelectorAll('.floating-element');
    
    floatingElements.forEach((element, index) => {
        // Add random animation delays
        element.style.animationDelay = `${index * 0.5}s`;
        
        // Add parallax effect on scroll
        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const rate = scrolled * -0.5;
            element.style.transform = `translateY(${rate}px)`;
        });
    });

    // Add loading state simulation (optional)
    function simulateLoading() {
        featureCards.forEach(card => {
            card.classList.add('loading');
        });

        setTimeout(() => {
            featureCards.forEach(card => {
                card.classList.remove('loading');
            });
        }, 1500);
    }

    // Optional: Trigger loading animation on page load
    // simulateLoading();

    // Performance optimization: Throttle scroll events
    let ticking = false;
    
    function updateParallax() {
        if (!ticking) {
            requestAnimationFrame(() => {
                floatingElements.forEach((element, index) => {
                    const scrolled = window.pageYOffset;
                    const rate = scrolled * -0.3;
                    element.style.transform = `translateY(${rate}px)`;
                });
                ticking = false;
            });
            ticking = true;
        }
    }

    window.addEventListener('scroll', updateParallax);

    // Add micro-interactions for better UX
    featureCards.forEach(card => {
        // Add ripple effect on click
        card.addEventListener('click', function(e) {
            const ripple = document.createElement('div');
            ripple.style.position = 'absolute';
            ripple.style.borderRadius = '50%';
            ripple.style.background = 'rgba(255, 255, 255, 0.3)';
            ripple.style.transform = 'scale(0)';
            ripple.style.animation = 'ripple 0.6s linear';
            ripple.style.left = e.clientX - this.offsetLeft + 'px';
            ripple.style.top = e.clientY - this.offsetTop + 'px';
            ripple.style.width = ripple.style.height = '20px';
            ripple.style.pointerEvents = 'none';

            this.appendChild(ripple);

            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });

    // Add CSS for ripple animation if not already present
    if (!document.querySelector('#ripple-styles')) {
        const style = document.createElement('style');
        style.id = 'ripple-styles';
        style.textContent = `
            @keyframes ripple {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Export functions for external use
    window.featuresAnimations = {
        triggerAnimations: () => {
            featureCards.forEach((card, index) => {
                setTimeout(() => {
                    card.style.opacity = '1';
                    card.style.transform = 'translateY(0)';
                }, 300 + (index * 200));
            });
        },
        resetAnimations: () => {
            featureCards.forEach(card => {
                card.style.opacity = '0';
                card.style.transform = 'translateY(12px)';
            });
        }
    };
}); 