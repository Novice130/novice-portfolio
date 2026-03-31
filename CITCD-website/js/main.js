/* ================================================
   CITCD Website - Main JavaScript
   ================================================ */

// Mobile Menu Toggle
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const nav = document.querySelector('nav');
const body = document.body;

if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
        nav.classList.toggle('mobile-open');
        mobileMenuBtn.textContent = nav.classList.contains('mobile-open') ? '✕' : '☰';
        body.style.overflow = nav.classList.contains('mobile-open') ? 'hidden' : '';
    });

    // Close menu when clicking a link
    nav.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            nav.classList.remove('mobile-open');
            mobileMenuBtn.textContent = '☰';
            body.style.overflow = '';
        });
    });
}

// Scroll Animations - Fade in elements as they come into view
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const animateOnScroll = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            animateOnScroll.unobserve(entry.target);
        }
    });
}, observerOptions);

// Apply to elements
document.querySelectorAll('.door-card, .stat-card, .testimonial-card, .school-grid, .cemetery-grid, .section-header').forEach(el => {
    el.classList.add('animate-target');
    animateOnScroll.observe(el);
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Newsletter Form Handler
const newsletterForm = document.querySelector('.newsletter-form');
if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = newsletterForm.querySelector('input[type="email"]').value;
        if (email) {
            alert('Thank you for subscribing! We will keep you updated.');
            newsletterForm.reset();
        }
    });
}

// Lightbox for Gallery
function openLightbox(src, alt) {
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox';
    lightbox.innerHTML = `
        <div class="lightbox-content">
            <button class="lightbox-close">&times;</button>
            <img src="${src}" alt="${alt}">
            <p class="lightbox-caption">${alt}</p>
        </div>
    `;
    document.body.appendChild(lightbox);
    document.body.style.overflow = 'hidden';
    
    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.classList.contains('lightbox-close')) {
            lightbox.remove();
            document.body.style.overflow = '';
        }
    });
}

// Attach lightbox to gallery images
document.querySelectorAll('.gallery-item img').forEach(img => {
    img.addEventListener('click', () => {
        openLightbox(img.src, img.alt);
    });
});

// Header scroll effect
let lastScroll = 0;
window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    const currentScroll = window.pageYOffset;
    
    if (currentScroll > 100) {
        header.classList.add('header-scrolled');
    } else {
        header.classList.remove('header-scrolled');
    }
    
    lastScroll = currentScroll;
});
