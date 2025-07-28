// Testimonials Carousel with Auto-Scroll
class TestimonialsCarousel {
    constructor() {
        this.currentIndex = 0;
        this.totalTestimonials = 5;
        this.autoScrollInterval = null;
        this.scrollDelay = 4000; // 4 seconds
        this.isHovered = false;
        
        this.track = document.getElementById('testimonialsTrack');
        this.dots = document.querySelectorAll('#testimonialDots button');
        this.cards = document.querySelectorAll('.testimonial-card');
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.startAutoScroll();
        this.updateDots();
        this.centerActiveCard();
    }
    
    setupEventListeners() {
        // Dot navigation
        this.dots.forEach((dot, index) => {
            dot.addEventListener('click', () => {
                this.goToSlide(index);
            });
        });
        
        // Hover pause functionality
        const container = document.querySelector('.testimonials-container');
        container.addEventListener('mouseenter', () => {
            this.pauseAutoScroll();
        });
        
        container.addEventListener('mouseleave', () => {
            this.startAutoScroll();
        });
        
        // Touch/swipe support for mobile
        let startX = 0;
        let endX = 0;
        
        container.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
        });
        
        container.addEventListener('touchend', (e) => {
            endX = e.changedTouches[0].clientX;
            this.handleSwipe(startX, endX);
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') {
                this.previousSlide();
            } else if (e.key === 'ArrowRight') {
                this.nextSlide();
            }
        });
    }
    
    handleSwipe(startX, endX) {
        const swipeThreshold = 50;
        const diff = startX - endX;
        
        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                this.nextSlide();
            } else {
                this.previousSlide();
            }
        }
    }
    
    goToSlide(index) {
        this.currentIndex = index;
        this.updateTrack();
        this.updateDots();
        this.centerActiveCard();
        this.resetAutoScroll();
    }
    
    nextSlide() {
        this.currentIndex = (this.currentIndex + 1) % this.totalTestimonials;
        this.goToSlide(this.currentIndex);
    }
    
    previousSlide() {
        this.currentIndex = (this.currentIndex - 1 + this.totalTestimonials) % this.totalTestimonials;
        this.goToSlide(this.currentIndex);
    }
    
    updateTrack() {
        const translateX = -this.currentIndex * (100 / 3); // Show 3 cards at once
        this.track.style.transform = `translateX(${translateX}%)`;
    }
    
    updateDots() {
        this.dots.forEach((dot, index) => {
            if (index === this.currentIndex) {
                dot.classList.remove('bg-gray-300');
                dot.classList.add('bg-blue-400');
            } else {
                dot.classList.remove('bg-blue-400');
                dot.classList.add('bg-gray-300');
            }
        });
    }
    
    centerActiveCard() {
        this.cards.forEach((card, index) => {
            const cardContent = card.querySelector('div');
            if (index === this.currentIndex) {
                cardContent.classList.add('transform', 'scale-105');
                cardContent.classList.remove('shadow-lg');
                cardContent.classList.add('shadow-xl');
            } else {
                cardContent.classList.remove('transform', 'scale-105');
                cardContent.classList.remove('shadow-xl');
                cardContent.classList.add('shadow-lg');
            }
        });
    }
    
    startAutoScroll() {
        if (this.autoScrollInterval) {
            clearInterval(this.autoScrollInterval);
        }
        
        this.autoScrollInterval = setInterval(() => {
            if (!this.isHovered) {
                this.nextSlide();
            }
        }, this.scrollDelay);
    }
    
    pauseAutoScroll() {
        this.isHovered = true;
        if (this.autoScrollInterval) {
            clearInterval(this.autoScrollInterval);
        }
    }
    
    resetAutoScroll() {
        this.isHovered = false;
        this.startAutoScroll();
    }
    
    // Responsive handling
    handleResize() {
        const isMobile = window.innerWidth < 768;
        if (isMobile) {
            // On mobile, show one card at a time
            this.cards.forEach(card => {
                card.classList.remove('md:w-1/3');
                card.classList.add('w-full');
            });
        } else {
            // On desktop, show three cards
            this.cards.forEach(card => {
                card.classList.remove('w-full');
                card.classList.add('md:w-1/3');
            });
        }
        this.updateTrack();
    }
}

// Initialize the carousel when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const carousel = new TestimonialsCarousel();
    
    // Handle window resize
    window.addEventListener('resize', () => {
        carousel.handleResize();
    });
    
    // Initial resize call
    carousel.handleResize();
});

// Add smooth scroll behavior for better UX
document.addEventListener('DOMContentLoaded', function() {
    const testimonialsSection = document.getElementById('page5');
    if (testimonialsSection) {
        // Add intersection observer for animation on scroll
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('animate-fade-in');
                }
            });
        }, { threshold: 0.1 });
        
        observer.observe(testimonialsSection);
    }
}); 