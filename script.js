// Typing Animation for Hero Section
const typingText = document.getElementById('typing-text');
const typingDesc = document.getElementById('typing-desc');
const heroText = "WELCOME TO MY HOSTEL";
const heroDesc = " Efficient, Digital, and Sustainable Hostel Management";

let i = 0;
let j = 0;

function typeWriter() {
  if (i < heroText.length) {
    typingText.innerHTML += heroText.charAt(i);
    i++;
    setTimeout(typeWriter, 50);
  } else {
    setTimeout(descWriter, 500);
  }
}

function descWriter() {
  if (j < heroDesc.length) {
    typingDesc.innerHTML += heroDesc.charAt(j);
    j++;
    setTimeout(descWriter, 20);
  }
}

// Start the typing animation when page loads
window.onload = typeWriter;

// Highlight active navigation link
const navLinks = document.querySelectorAll('nav ul li a');
navLinks.forEach(link => {
  link.addEventListener('click', function () {
    navLinks.forEach(link => link.classList.remove('active'));
    this.classList.add('active');
  });
});

// Scroll-triggered animations
const animateElements = document.querySelectorAll('[data-animate]');

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('animate');
    }
  });
}, { threshold: 0.2 });

animateElements.forEach((element) => {
  observer.observe(element);
});