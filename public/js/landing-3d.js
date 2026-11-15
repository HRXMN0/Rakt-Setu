/**
 * RAKT-SETU — IMMERSIVE 3D PERSPECTIVE TUNNEL & LANDING ENGINE
 * Pure vanilla JavaScript, 60fps GPU-accelerated CSS 3D transforms,
 * native smooth scroll progression, and pointer parallax.
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. CONFIGURATION & SPATIAL CARD TARGETS (BALANCED 8-NODE MEDICAL MATRIX)
  // --------------------------------------------------------------------------
  // Symmetrically arranged around the central core with zero overlap,
  // filling the spatial viewport harmoniously with rich depth and high technical density.
  const TUNNEL_CARDS_CONFIG = [
    // Top Row Pair (Widely separated above the central core)
    {
      id: 'card-o-neg',
      targetX: -340,
      targetY: -210,
      targetZ: -90,
      rx: 8,
      ry: 10,
      rz: -2
    },
    {
      id: 'card-stat-trauma',
      targetX: 340,
      targetY: -210,
      targetZ: -90,
      rx: 8,
      ry: -10,
      rz: 2
    },
    // High-Mid Outer Flanks (Framing the left and right periphery)
    {
      id: 'card-apheresis-info',
      targetX: -560,
      targetY: -40,
      targetZ: -70,
      rx: 0,
      ry: 16,
      rz: -1
    },
    {
      id: 'card-hosp-rajindra',
      targetX: 560,
      targetY: -40,
      targetZ: -70,
      rx: 0,
      ry: -16,
      rz: 1
    },
    // Low-Mid Outer Flanks (Providing vertical visual rhythm)
    {
      id: 'card-a-pos',
      targetX: -530,
      targetY: 160,
      targetZ: -100,
      rx: -6,
      ry: 15,
      rz: -1
    },
    {
      id: 'card-ab-pos',
      targetX: 530,
      targetY: 160,
      targetZ: -100,
      rx: -6,
      ry: -15,
      rz: 1
    },
    // Bottom Row Pair (Widely separated beneath the central core)
    {
      id: 'card-depot-storage',
      targetX: -260,
      targetY: 310,
      targetZ: -120,
      rx: -10,
      ry: 8,
      rz: -1
    },
    {
      id: 'card-donor-aarav',
      targetX: 260,
      targetY: 310,
      targetZ: -120,
      rx: -10,
      ry: -8,
      rz: 1
    }
  ];

  // --------------------------------------------------------------------------
  // 2. DOM REFERENCES & STATE
  // --------------------------------------------------------------------------
  const heroTrack = document.getElementById('hero');
  const worldStage = document.getElementById('tunnel-world-stage');
  const heroContent = document.getElementById('tunnel-hero-content');
  const scrollCue = document.getElementById('hero-scroll-cue');
  const heartCore = document.getElementById('tunnel-heart-core');
  const heartSvg = document.querySelector('.heart-svg');
  const heartBpmText = document.getElementById('heart-telemetry-bpm');

  let mouseX = 0;
  let mouseY = 0;
  let targetMouseX = 0;
  let targetMouseY = 0;
  let currentProgress = 0;
  let targetProgress = 0;
  let heartTime = 0;

  // Track hover pop-out state per card
  const cardHoverMap = {};
  let activeHoveredId = null;

  TUNNEL_CARDS_CONFIG.forEach((cfg) => {
    cardHoverMap[cfg.id] = { current: 0, target: 0 };
    const el = document.getElementById(cfg.id);
    if (el) {
      el.addEventListener('mouseenter', () => {
        activeHoveredId = cfg.id;
        cardHoverMap[cfg.id].target = 1;
      });
      el.addEventListener('mouseleave', () => {
        if (activeHoveredId === cfg.id) activeHoveredId = null;
        cardHoverMap[cfg.id].target = 0;
      });
    }
  });

  // Track pointer movement for subtle perspective tilt on desktop
  window.addEventListener('mousemove', (e) => {
    const halfWidth = window.innerWidth / 2;
    const halfHeight = window.innerHeight / 2;
    targetMouseX = (e.clientX - halfWidth) / halfWidth; // -1 to 1
    targetMouseY = (e.clientY - halfHeight) / halfHeight; // -1 to 1
  }, { passive: true });

  // Native scroll progress calculation through hero track
  function getScrollProgress() {
    if (!heroTrack) return 0;
    const rect = heroTrack.getBoundingClientRect();
    const maxScroll = heroTrack.offsetHeight - window.innerHeight;
    if (maxScroll <= 0) return 0;
    const scrolled = -rect.top;
    return Math.max(0, Math.min(1, scrolled / maxScroll));
  }

  function onScroll() {
    targetProgress = getScrollProgress();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  // Initial calculation
  targetProgress = getScrollProgress();
  currentProgress = targetProgress;

  // --------------------------------------------------------------------------
  // 3. 60 FPS GPU-ACCELERATED 3D ANIMATION LOOP
  // --------------------------------------------------------------------------
  function render3DTunnel() {
    // Smooth spring lerp for pointer
    mouseX += (targetMouseX - mouseX) * 0.08;
    mouseY += (targetMouseY - mouseY) * 0.08;

    // Smooth spring lerp for scroll progress
    currentProgress += (targetProgress - currentProgress) * 0.12;
    const p = currentProgress;

    const isDesktop = window.innerWidth > 768;

    if (isDesktop && worldStage) {
      // Subtle world perspective tilt
      const tiltX = -mouseY * 6;
      const tiltY = mouseX * 8;
      worldStage.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;

      // Dynamic scale factor for narrower screens (laptops / tablets)
      const screenFactor = Math.max(0.68, Math.min(1.0, window.innerWidth / 1300));

      // ----------------------------------------------------------------------
      // HEADING & CENTRAL CONTENT LIFECYCLE
      // ----------------------------------------------------------------------
      if (heroContent) {
        if (p <= 0.08) {
          // Progress 0: Clean hero, 100% visible and interactive
          heroContent.style.opacity = '1';
          heroContent.style.transform = 'translate3d(0, 0, 0) scale(1)';
          heroContent.style.pointerEvents = 'auto';
        } else if (p <= 0.35) {
          // Progress 0.08 - 0.35: Gracefully fades and slightly scales away as cards emerge
          const tFade = (p - 0.08) / (0.35 - 0.08);
          const opacity = Math.max(0, 1 - tFade);
          const scale = 1 - tFade * 0.06;
          const translateY = -tFade * 40;
          heroContent.style.opacity = opacity.toFixed(3);
          heroContent.style.transform = `translate3d(0, ${translateY}px, 0) scale(${scale.toFixed(3)})`;
          heroContent.style.pointerEvents = opacity > 0.25 ? 'auto' : 'none';
        } else {
          // Progress > 0.35: Completely invisible so cards take the entire stage without clutter
          heroContent.style.opacity = '0';
          heroContent.style.pointerEvents = 'none';
        }
      }

      // Scroll Cue Fade
      if (scrollCue) {
        scrollCue.style.opacity = Math.max(0, 1 - p * 5).toFixed(3);
      }

      // ----------------------------------------------------------------------
      // CENTRAL ANIMATED BEATING HEART (BIO-TELEMETRY CORE)
      // ----------------------------------------------------------------------
      if (heartCore && heartSvg) {
        // Steady physiological human resting heartbeat: constant 72 BPM (no scroll acceleration)
        // 72 BPM = 1.2 Hz = 1.2 * 2 * PI rad/sec
        const cardiacCycle = (performance.now() / 1000) * (72 / 60) * Math.PI * 2;
        // Anatomical double-peak ("lub-dub" ventricular & atrial contraction)
        const lub = Math.pow(Math.max(0, Math.sin(cardiacCycle)), 8) * 0.13;
        const dub = Math.pow(Math.max(0, Math.sin(cardiacCycle - 0.52)), 12) * 0.20;
        const beatScale = 1.0 + lub + dub;

        if (heartBpmText) {
          heartBpmText.textContent = '72 BPM';
        }

        // Heart emergence: Travels forward from deep background (-2800px) with smooth fade
        let heartOpacity = 0;
        let heartZ = -2800;
        let heartScale = 0.08;
        let heartPointer = 'none';

        if (p <= 0.08) {
          // Strictly invisible, deep in background
          heartOpacity = 0;
          heartZ = -2800;
          heartScale = 0.08;
          heartPointer = 'none';
        } else if (p <= 0.38) {
          // Emerges from the deep back with fade and scale growth
          const t = (p - 0.08) / (0.38 - 0.08);
          const ease = t * t * (3 - 2 * t);
          heartOpacity = Math.min(1, t * 1.25);
          heartZ = -2800 + (-40 - (-2800)) * ease;
          heartScale = 0.08 + (1.0 - 0.08) * ease;
          heartPointer = heartOpacity > 0.4 ? 'auto' : 'none';
        } else if (p <= 0.72) {
          // Prominent foreground position
          heartOpacity = 1;
          heartZ = -40;
          heartScale = 1.0;
          heartPointer = 'auto';
        } else {
          // Gracefully dissolves as sticky container completes
          const tExit = (p - 0.72) / (1.0 - 0.72);
          heartOpacity = Math.max(0, 1 - tExit * 1.5);
          heartZ = -40 + tExit * 350;
          heartScale = 1.0 + tExit * 0.2;
          heartPointer = heartOpacity > 0.3 ? 'auto' : 'none';
        }

        // Add subtle mouse parallax offset
        const parallaxX = mouseX * -15;
        const parallaxY = mouseY * -12;

        // Apply heartbeat contraction and 3D translation + scale from deep space
        heartSvg.style.transform = `scale(${beatScale.toFixed(3)})`;
        heartCore.style.transform = `translate(-50%, -50%) translate3d(${(parallaxX * 0.4).toFixed(1)}px, ${(parallaxY * 0.4).toFixed(1)}px, ${heartZ.toFixed(1)}px) scale(${heartScale.toFixed(3)})`;
        heartCore.style.opacity = heartOpacity.toFixed(3);
        heartCore.style.pointerEvents = heartPointer;
      }

      // Tactical Corner Medical HUD Overlay Lifecycle
      const cornerHuds = document.querySelectorAll('.tunnel-corner-hud');
      if (cornerHuds.length > 0) {
        let hudOpacity = 0;
        if (p >= 0.14 && p <= 0.76) {
          const tIn = Math.min(1, (p - 0.14) / 0.14);
          const tOut = Math.min(1, (0.76 - p) / 0.12);
          hudOpacity = Math.min(tIn, tOut);
        }
        cornerHuds.forEach((hud) => {
          hud.style.opacity = hudOpacity.toFixed(2);
        });
      }

      // ----------------------------------------------------------------------
      // 3D TUNNEL CARDS LIFECYCLE
      // ----------------------------------------------------------------------
      TUNNEL_CARDS_CONFIG.forEach((cfg) => {
        const el = document.getElementById(cfg.id);
        if (!el || el.style.display === 'none') return;

        let opacity = 0;
        let scale = 0.08;
        let z = -4000;
        let x = cfg.targetX * screenFactor;
        let y = cfg.targetY * screenFactor;
        let rx = cfg.rx;
        let ry = cfg.ry;
        let rz = cfg.rz;
        let pointerEvents = 'none';

        if (p <= 0.08) {
          // PROGRESS 0 — INITIAL STATE:
          // Strictly invisible, scale 0.08, deep in background (-4000px)
          opacity = 0;
          scale = 0.08;
          z = -4000;
          pointerEvents = 'none';
        } else if (p <= 0.35) {
          // PROGRESS 0.08 - 0.35 — CARDS BEGIN APPEARING:
          // Cards fade in smoothly, scale increases from 0.08 to 0.55, moving forward
          const t = (p - 0.08) / (0.35 - 0.08);
          // Smoothstep
          const ease = t * t * (3 - 2 * t);
          opacity = Math.min(1, t * 1.15);
          scale = 0.08 + (0.55 - 0.08) * ease;
          z = -4000 + (-1000 - (-4000)) * ease;
          rx = cfg.rx * (0.6 + 0.4 * ease);
          ry = cfg.ry * (0.6 + 0.4 * ease);
          rz = cfg.rz * (0.6 + 0.4 * ease);
          pointerEvents = 'none';
        } else if (p <= 0.72) {
          // PROGRESS 0.35 - 0.72 — CARDS APPROACH & BECOME PROMINENT:
          // Full opacity, size grows from 0.55 to 1.0, reaching target foreground Z
          const t = (p - 0.35) / (0.72 - 0.35);
          const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          opacity = 1;
          scale = 0.55 + (1.0 - 0.55) * ease;
          z = -1000 + (cfg.targetZ - (-1000)) * ease;
          pointerEvents = 'auto';
        } else {
          // PROGRESS 0.72 - 1.0 — FOREGROUND EXIT & TRANSITION:
          // Cards gently expand outward and dissolve as sticky container reaches end
          const t = (p - 0.72) / (1.0 - 0.72);
          scale = 1.0 + t * 0.25;
          z = cfg.targetZ + t * 400;
          x = cfg.targetX * screenFactor * (1 + t * 0.2);
          y = cfg.targetY * screenFactor * (1 + t * 0.2);
          opacity = Math.max(0, 1 - t * 1.5);
          pointerEvents = opacity > 0.35 ? 'auto' : 'none';
        }

        // Add subtle mouse parallax offset
        const parallaxX = mouseX * -15;
        const parallaxY = mouseY * -12;

        // Hover Pop-Out Spring Engine
        const hState = cardHoverMap[cfg.id] || { current: 0, target: 0 };
        hState.current += (hState.target - hState.current) * 0.18;
        const h = hState.current;

        // When hovered: pop out towards camera (+220px on Z), scale up (+14%), and straighten rotation
        const popZ = z + h * 220;
        const popScale = scale + h * 0.14;
        const popRx = rx * (1 - h * 0.8);
        const popRy = ry * (1 - h * 0.8);

        // Dim non-hovered cards slightly when inspecting a single card
        let displayOpacity = opacity;
        if (activeHoveredId && activeHoveredId !== cfg.id) {
          displayOpacity = Math.max(0.38, opacity * 0.48);
          el.classList.add('is-dimmed');
        } else {
          el.classList.remove('is-dimmed');
        }

        // Stacking order: elevated to top (z-index: 120) when hovered
        if (h > 0.04) {
          el.classList.add('is-hovered');
          el.style.zIndex = '120';
        } else {
          el.classList.remove('is-hovered');
          el.style.zIndex = Math.max(1, Math.round(20 + z / 50));
        }

        // CRITICAL: translate(-50%, -50%) centers the card on (0,0) before 3D translation!
        el.style.transform = `translate(-50%, -50%) translate3d(${(x + parallaxX).toFixed(1)}px, ${(y + parallaxY).toFixed(1)}px, ${popZ.toFixed(1)}px) scale(${popScale.toFixed(3)}) rotateX(${popRx.toFixed(1)}deg) rotateY(${popRy.toFixed(1)}deg) rotateZ(${rz.toFixed(1)}deg)`;
        el.style.opacity = displayOpacity.toFixed(3);
        el.style.pointerEvents = pointerEvents;
      });
    }

    requestAnimationFrame(render3DTunnel);
  }

  // Start 3D loop if supported
  if (window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
    requestAnimationFrame(render3DTunnel);
  }

  // --------------------------------------------------------------------------
  // 4. FLOATING NAVBAR, MOBILE DRAWER & SCROLL SPY
  // --------------------------------------------------------------------------
  const navbar = document.getElementById('rs-nav-floating');
  const mobileToggle = document.getElementById('rs-mobile-toggle');
  const mobileDrawer = document.getElementById('rs-mobile-drawer');

  // Mapped sections for scroll spy
  const SPY_SECTION_IDS = [
    'hero',
    'how-it-works',
    'impact',
    'emergency-requests',
    'compatibility',
    'portals'
  ];

  let currentActiveId = 'hero';
  let isClickScrolling = false;
  let clickScrollTimeout = null;

  // Set active link class across desktop navbar and mobile drawer
  function setActiveNav(targetId) {
    if (!targetId) return;
    currentActiveId = targetId;

    // Desktop navbar links
    const desktopLinks = document.querySelectorAll('.rs-nav-links .rs-nav-link');
    desktopLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (href === '#' + targetId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Mobile drawer links
    const mobileLinks = document.querySelectorAll('.rs-mobile-drawer a[href^="#"]');
    mobileLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (href === '#' + targetId) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // Geometric viewport calculation for active section
  function determineActiveSection() {
    const scrollY = window.pageYOffset || window.scrollY || 0;
    const windowHeight = window.innerHeight;
    const docHeight = document.documentElement.scrollHeight;

    // Edge case 1: Top of page / inside hero
    if (scrollY < 120) {
      return 'hero';
    }

    // Edge case 2: Near bottom of page (Portals is the final target section)
    if (scrollY + windowHeight >= docHeight - 70) {
      return 'portals';
    }

    // Activation trigger line: just below the floating navbar
    const navHeight = navbar ? navbar.offsetHeight : 70;
    const triggerY = scrollY + navHeight + 60;

    let candidate = 'hero';
    for (let i = 0; i < SPY_SECTION_IDS.length; i++) {
      const id = SPY_SECTION_IDS[i];
      const el = document.getElementById(id);
      if (!el) continue;

      const top = el.offsetTop;
      if (triggerY >= top) {
        candidate = id;
      }
    }

    return candidate;
  }

  // Smooth scroll to section with navbar offset compensation
  function smoothScrollToSection(targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;

    // Update active highlight immediately for instant visual feedback
    setActiveNav(targetId);

    // Suppress scroll spy updates while smooth scrolling
    isClickScrolling = true;
    clearTimeout(clickScrollTimeout);

    const navHeight = navbar ? navbar.offsetHeight : 70;
    const targetTop = target.getBoundingClientRect().top + (window.pageYOffset || window.scrollY) - (navHeight + 15);

    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'smooth'
    });

    // Update URL hash without causing a browser jump
    if (window.history && window.history.pushState) {
      window.history.pushState(null, '', '#' + targetId);
    }

    // Re-enable scroll spy detection after smooth scroll completes
    clickScrollTimeout = setTimeout(() => {
      isClickScrolling = false;
      setActiveNav(determineActiveSection());
    }, 850);
  }

  // Navbar glass background scroll state
  window.addEventListener('scroll', () => {
    if (!navbar) return;
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  }, { passive: true });

  // Mobile menu drawer toggle
  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      mobileDrawer.classList.toggle('active');
    });
  }

  // Setup Scroll-Spy via IntersectionObserver + Scroll Event
  function initScrollSpy() {
    // 1. Setup IntersectionObserver
    if ('IntersectionObserver' in window) {
      const observerOptions = {
        root: null,
        rootMargin: '-15% 0px -60% 0px',
        threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0]
      };

      const sectionObserver = new IntersectionObserver((entries) => {
        if (isClickScrolling) return;

        // Check if we are near the very top
        const scrollY = window.pageYOffset || window.scrollY || 0;
        if (scrollY < 120) {
          setActiveNav('hero');
          return;
        }

        // Check if we are near the very bottom
        if (scrollY + window.innerHeight >= document.documentElement.scrollHeight - 70) {
          setActiveNav('portals');
          return;
        }

        const intersecting = entries.filter((e) => e.isIntersecting);
        if (intersecting.length > 0) {
          const navHeight = navbar ? navbar.offsetHeight : 70;
          let bestId = null;
          let minDistance = Infinity;

          intersecting.forEach((entry) => {
            const rect = entry.target.getBoundingClientRect();
            const distance = Math.abs(rect.top - navHeight);
            if (distance < minDistance) {
              minDistance = distance;
              bestId = entry.target.id;
            }
          });

          if (bestId && SPY_SECTION_IDS.includes(bestId)) {
            setActiveNav(bestId);
            return;
          }
        }

        // Fallback to geometric check
        const active = determineActiveSection();
        setActiveNav(active);
      }, observerOptions);

      SPY_SECTION_IDS.forEach((id) => {
        const el = document.getElementById(id);
        if (el) sectionObserver.observe(el);
      });
    }

    // 2. Continuous scroll listener with requestAnimationFrame for rapid scrolling and edge cases
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (!isClickScrolling) {
            const active = determineActiveSection();
            setActiveNav(active);
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    // 3. Bind click events on all navbar links, brand logo, and drawer links
    const navAnchors = document.querySelectorAll('.rs-nav-links .rs-nav-link, .rs-mobile-drawer a[href^="#"], a.rs-nav-brand[href^="#"]');
    navAnchors.forEach((anchor) => {
      anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (!href || !href.startsWith('#')) return;

        const targetId = href.substring(1);
        if (!targetId) return;

        const targetEl = document.getElementById(targetId);
        if (!targetEl) return;

        e.preventDefault();

        // Close mobile drawer if open
        if (mobileDrawer && mobileDrawer.classList.contains('active')) {
          mobileDrawer.classList.remove('active');
        }

        smoothScrollToSection(targetId);
      });
    });

    // 4. Initial sync based on current URL hash or scroll position
    const initialHash = window.location.hash ? window.location.hash.substring(1) : '';
    if (initialHash && SPY_SECTION_IDS.includes(initialHash)) {
      smoothScrollToSection(initialHash);
    } else {
      setActiveNav(determineActiveSection());
    }
  }

  // --------------------------------------------------------------------------
  // 5. SECTION A: ANIMATED METRICS COUNTERS
  // --------------------------------------------------------------------------
  function setupCounters() {
    const counterElements = document.querySelectorAll('.animate-counter');
    if (!counterElements.length) return;

    let hasAnimated = false;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasAnimated) {
          hasAnimated = true;
          counterElements.forEach((el) => {
            const target = parseInt(el.getAttribute('data-target'), 10) || 0;
            const suffix = el.getAttribute('data-suffix') || '';
            const duration = 1600;
            const startTime = performance.now();

            function updateCounter(now) {
              const elapsed = now - startTime;
              const progress = Math.min(1, elapsed / duration);
              // Ease Out Quart
              const ease = 1 - Math.pow(1 - progress, 4);
              const current = Math.floor(ease * target);
              el.textContent = current.toLocaleString('en-US') + suffix;

              if (progress < 1) {
                requestAnimationFrame(updateCounter);
              } else {
                el.textContent = target.toLocaleString('en-US') + suffix;
              }
            }

            requestAnimationFrame(updateCounter);
          });
        }
      });
    }, { threshold: 0.2 });

    const metricsSection = document.getElementById('impact');
    if (metricsSection) {
      observer.observe(metricsSection);
    }
  }

  // --------------------------------------------------------------------------
  // 6. SECTION C: BLOOD GROUP EXPLORER & COMPATIBILITY MATRIX
  // --------------------------------------------------------------------------
  const COMPATIBILITY_RULES = {
    'O-': {
      canGiveTo: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
      canReceiveFrom: ['O-'],
      note: 'Universal Red Cell Donor: O- red blood cells can be transfused to patients of all blood groups in emergency trauma situations.'
    },
    'O+': {
      canGiveTo: ['O+', 'A+', 'B+', 'AB+'],
      canReceiveFrom: ['O-', 'O+'],
      note: 'Most Requested Blood Type: O+ is the most prevalent blood type in Punjab. Can give to any Rh-positive recipient.'
    },
    'A-': {
      canGiveTo: ['A-', 'A+', 'AB-', 'AB+'],
      canReceiveFrom: ['O-', 'A-'],
      note: 'Critical Negative Blood: A- donors can safely support all A and AB patients across both negative and positive Rh types.'
    },
    'A+': {
      canGiveTo: ['A+', 'AB+'],
      canReceiveFrom: ['O-', 'O+', 'A-', 'A+'],
      note: 'High Hospital Utility: A+ red cells are widely used in scheduled cardiac surgeries and ongoing hematology therapies.'
    },
    'B-': {
      canGiveTo: ['B-', 'B+', 'AB-', 'AB+'],
      canReceiveFrom: ['O-', 'B-'],
      note: 'Rare Rh-Negative Type: High regional demand for pediatric surgery units and thalassemia patients requiring regular transfusions.'
    },
    'B+': {
      canGiveTo: ['B+', 'AB+'],
      canReceiveFrom: ['O-', 'O+', 'B-', 'B+'],
      note: 'Major Regional Reserve: Highly needed across emergency trauma departments in Patiala and Punjab healthcare facilities.'
    },
    'AB-': {
      canGiveTo: ['AB-', 'AB+'],
      canReceiveFrom: ['O-', 'A-', 'B-', 'AB-'],
      note: 'Rarest Blood Group: Less than 1% of the population. Universal recipient for all Rh-negative donor red cells.'
    },
    'AB+': {
      canGiveTo: ['AB+'],
      canReceiveFrom: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
      note: 'Universal Red Cell Recipient: Can receive red blood cells from any blood type. Also serves as the Universal Plasma Donor.'
    }
  };

  function selectBloodGroup(group) {
    const data = COMPATIBILITY_RULES[group] || COMPATIBILITY_RULES['O-'];
    const giveContainer = document.getElementById('compat-give-pills');
    const receiveContainer = document.getElementById('compat-receive-pills');
    const noteEl = document.getElementById('compat-clinical-note');

    // Update active button state
    document.querySelectorAll('.blood-type-card-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-group') === group);
    });

    // Render give badges
    if (giveContainer) {
      giveContainer.innerHTML = data.canGiveTo.map((t) => (
        `<span class="compat-badge-pill compat-badge-give">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
          ${t}
        </span>`
      )).join('');
    }

    // Render receive badges
    if (receiveContainer) {
      receiveContainer.innerHTML = data.canReceiveFrom.map((t) => (
        `<span class="compat-badge-pill compat-badge-receive">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ${t}
        </span>`
      )).join('');
    }

    // Update clinical note
    if (noteEl) {
      noteEl.textContent = data.note;
    }
  }

  // --------------------------------------------------------------------------
  // 7. INITIALIZATION & CARD SHORTCUTS
  // --------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    // Setup counters
    setupCounters();

    // Setup blood group buttons
    document.querySelectorAll('.blood-type-card-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const group = btn.getAttribute('data-group');
        selectBloodGroup(group);
      });
    });

    // Default selection
    selectBloodGroup('O-');

    // Connect 3D Card Clicks to Relevant Page Sections
    const cardONeg = document.getElementById('card-o-neg');
    if (cardONeg) {
      cardONeg.addEventListener('click', () => {
        smoothScrollToSection('compatibility');
        selectBloodGroup('O-');
      });
    }

    const cardAPos = document.getElementById('card-a-pos');
    if (cardAPos) {
      cardAPos.addEventListener('click', () => {
        smoothScrollToSection('compatibility');
        selectBloodGroup('A+');
      });
    }

    const cardStat = document.getElementById('card-stat-trauma');
    if (cardStat) {
      cardStat.addEventListener('click', () => {
        smoothScrollToSection('emergency-requests');
      });
    }

    const cardAarav = document.getElementById('card-donor-aarav');
    if (cardAarav) {
      cardAarav.addEventListener('click', () => {
        const el = document.getElementById('donor-stories');
        if (el) {
          const navHeight = navbar ? navbar.offsetHeight : 70;
          const top = el.getBoundingClientRect().top + (window.pageYOffset || window.scrollY) - (navHeight + 15);
          window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        }
      });
    }

    // Initialize Scroll Spy system
    initScrollSpy();
  });

})();
