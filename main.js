import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import * as THREE from "three";
import vertexShader from "./shaders/vertex.glsl";
import fragmentShader from "./shaders/fragment.glsl";
import atmosphereVertexShader from "./shaders/atmosphereVertex.glsl";
import atmosphereFragmentShader from "./shaders/atmosphereFragment.glsl";


gsap.registerPlugin(ScrollTrigger);

const canvasContainer = document.querySelector("#canvasContainer");
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  canvasContainer.offsetWidth / canvasContainer.offsetHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  canvas: document.querySelector("canvas"),
});

renderer.setSize(canvasContainer.offsetWidth, canvasContainer.offsetHeight);
renderer.setPixelRatio(window.devicePixelRatio);

const sphere = new THREE.Mesh(
  new THREE.SphereGeometry(5, 50, 50),
  new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      globeTexture: {
        value: new THREE.TextureLoader().load("./img/earth.jpg"),
      },
    },
  })
);

const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(5, 50, 50),
  new THREE.ShaderMaterial({
    vertexShader: atmosphereVertexShader,
    fragmentShader: atmosphereFragmentShader,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
  })
);
atmosphere.scale.set(1.1, 1.1, 1.1);

scene.add(atmosphere);
const group = new THREE.Group();
group.add(sphere);
scene.add(group);

const starGeometry = new THREE.BufferGeometry();
const starMaterial = new THREE.PointsMaterial({
  color: `0xffffff`,
});

const starVertices = [];
for (let i = 0; i < 10000; i++) {
  const x = (Math.random() - 0.5) * 1000;
  const y = (Math.random() - 0.5) * 1000;
  const z = -Math.random() * 10000;
  starVertices.push(x, y, z);
}
starGeometry.setAttribute(
  "position",
  new THREE.Float32BufferAttribute(starVertices, 3)
);

const stars = new THREE.Points(starGeometry, starMaterial);
scene.add(stars);

camera.position.z = 10;

const mouse = {
  x: 0,
  y: 0,
};

function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
  sphere.rotation.y += 0.001;
  gsap.to(group.rotation, {
    x: -mouse.y * 0.1,
    y: mouse.x * 0.1,
    duration: 3,
  });
}

animate();

addEventListener("mousemove", (event) => {
  mouse.x = (event.clientX / innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / innerHeight) * 2 + 1;
});

// Scroll animation to change camera.position.z with markers enabled
gsap.to(camera.position, {
  z: 10,
  scrollTrigger: {
    trigger: "#main",
    scroller: "#main",
    start: "0% 0%",
    end: "0% 10%",
    scrub: true,
    markers: true, // Enable markers for debugging
  },
});

document.addEventListener('DOMContentLoaded', function() {
  // Partner logo click tracking and keyboard accessibility
  document.querySelectorAll('.carousel-track a').forEach(function(card) {
    card.addEventListener('click', function(e) {
      const partner = card.getAttribute('data-partner');
      const url = card.getAttribute('href');
      console.log(`Partner clicked: ${partner} (${url})`);
    });
    card.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') {
        card.click();
      }
    });
    card.setAttribute('tabindex', '0');
  });

  // Partnership Carousel Logic
  const track = document.getElementById('carouselTrack');
  const dotsContainer = document.getElementById('carouselDots');
  const items = Array.from(track.querySelectorAll('a'));
  let visibleCount = 5;
  let currentIndex = 0;

  function updateVisibleCount() {
    if (window.innerWidth < 500) visibleCount = 2;
    else if (window.innerWidth < 768) visibleCount = 3;
    else if (window.innerWidth < 1024) visibleCount = 4;
    else visibleCount = 5;
  }

  function renderDots() {
    if (!dotsContainer) return; // Guard clause to prevent null reference
    dotsContainer.innerHTML = '';
    const dotCount = Math.max(1, items.length - visibleCount + 1);
    for (let i = 0; i < dotCount; i++) {
      const dot = document.createElement('span');
      dot.className = 'carousel-dot' + (i === currentIndex ? ' active' : '');
      dot.setAttribute('tabindex', '0');
      dot.setAttribute('aria-label', `Go to logos ${i+1} to ${i+visibleCount}`);
      dot.addEventListener('click', () => scrollToIndex(i));
      dot.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') scrollToIndex(i);
      });
      dotsContainer.appendChild(dot);
    }
  }

  function scrollToIndex(idx) {
    currentIndex = idx;
    const item = items[idx];
    if (item) {
      item.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
    }
    updateDotsActive();
  }

  function updateDotsActive() {
    if (!dotsContainer) return; // Guard clause to prevent null reference
    const dots = dotsContainer.querySelectorAll('.carousel-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentIndex);
    });
  }

  function updateCurrentIndexOnScroll() {
    if (!track) return; // Guard clause to prevent null reference
    // Find the leftmost fully visible item
    let minDiff = Infinity;
    let idx = 0;
    const trackRect = track.getBoundingClientRect();
    items.forEach((item, i) => {
      const rect = item.getBoundingClientRect();
      const diff = Math.abs(rect.left - trackRect.left);
      if (diff < minDiff) {
        minDiff = diff;
        idx = i;
      }
    });
    if (currentIndex !== idx) {
      currentIndex = idx;
      updateDotsActive();
    }
  }

  // Touch/swipe support
  let startX = 0;
  if (track) {
    track.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
    });
    track.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0].clientX;
      const diff = startX - endX;
      if (Math.abs(diff) > 30) {
        if (diff > 0 && currentIndex < items.length - visibleCount) {
          scrollToIndex(currentIndex + 1);
        } else if (diff < 0 && currentIndex > 0) {
          scrollToIndex(currentIndex - 1);
        }
      }
    });

    // Listen for scroll to update active dot
    track.addEventListener('scroll', () => {
      updateCurrentIndexOnScroll();
    });
  }

  // Responsive: update visibleCount and dots on resize
  function handleResize() {
    updateVisibleCount();
    renderDots();
  }
  window.addEventListener('resize', handleResize);
  updateVisibleCount();
  renderDots();
});
