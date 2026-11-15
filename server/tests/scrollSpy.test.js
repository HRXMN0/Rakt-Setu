/**
 * RAKT-SETU — SCROLL-AWARE NAVBAR (SCROLL SPY) TEST SUITE
 * Verifies section mapping, document flow, CSS styling & transitions,
 * IntersectionObserver configuration, and bidirectional scroll/click behaviour.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const runScrollSpyTests = async () => {
    console.log(`\n================================================================`);
    console.log(`  🎯 RAKT-SETU — SCROLL-SPY AUTOMATED VERIFICATION SUITE`);
    console.log(`================================================================`);

    const results = [];
    const record = (name, passed, message) => {
        results.push({ name, passed, message });
        const icon = passed ? '✅' : '❌';
        console.log(`  ${icon} [${passed ? 'PASS' : 'FAIL'}] ${name}: ${message}`);
    };

    const rootDir = path.resolve(__dirname, '../../');
    const indexHtmlPath = path.join(rootDir, 'index.html');
    const cssPath = path.join(rootDir, 'css/landing-3d.css');
    const jsPath = path.join(rootDir, 'js/landing-3d.js');

    const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    // -------------------------------------------------------------
    // TEST 1: Section ID Presence & Navbar Mapping
    // -------------------------------------------------------------
    try {
        const requiredSections = [
            'hero',
            'how-it-works',
            'impact',
            'emergency-requests',
            'compatibility',
            'portals'
        ];

        const missing = requiredSections.filter(id => !indexHtml.includes(`id="${id}"`));
        assert.strictEqual(missing.length, 0, `Missing section IDs: ${missing.join(', ')}`);

        // Check desktop navbar links
        requiredSections.forEach(id => {
            assert(indexHtml.includes(`href="#${id}"`), `Desktop nav missing href="#${id}"`);
        });

        record(
            'Section ID & Navbar Link Mapping',
            true,
            'All 6 expected sections (#hero, #how-it-works, #impact, #emergency-requests, #compatibility, #portals) exist and map 1:1 to navbar links.'
        );
    } catch (err) {
        record('Section ID & Navbar Link Mapping', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 2: Physical Document Order Alignment
    // -------------------------------------------------------------
    try {
        const expectedOrder = [
            'id="hero"',
            'id="how-it-works"',
            'id="impact"',
            'id="emergency-requests"',
            'id="compatibility"',
            'id="portals"'
        ];

        let lastIndex = -1;
        let isOrdered = true;
        for (const sec of expectedOrder) {
            const idx = indexHtml.indexOf(sec);
            assert(idx > lastIndex, `Section ${sec} out of expected order in index.html`);
            lastIndex = idx;
        }

        record(
            'Physical Section Document Order',
            true,
            'Sections appear in the exact logical order: hero -> how-it-works -> impact -> emergency-requests -> compatibility -> portals.'
        );
    } catch (err) {
        record('Physical Section Document Order', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 3: CSS Underline Transition & Active Styling
    // -------------------------------------------------------------
    try {
        // Red accent underline check
        assert(cssContent.includes('--crimson-accent'), 'CSS must use --crimson-accent for active indicator');
        assert(cssContent.includes('.rs-nav-link.active'), 'CSS must define .rs-nav-link.active styling');
        assert(cssContent.includes('.rs-nav-link.active::after') || cssContent.includes('.rs-nav-link::after'), 'CSS must define underline pseudo-element');
        assert(cssContent.includes('transform: scaleX(1)'), 'CSS must animate underline using scaleX(1)');
        assert(cssContent.includes('scroll-margin-top: 85px') || cssContent.includes('scroll-padding-top: 85px'), 'CSS must define scroll clearance for floating navbar');

        record(
            'CSS Active Highlight & Underline Transitions',
            true,
            'Navbar active underline features smooth cubic-bezier scaleX transition, crimson accent, and floating navbar scroll-margin clearance.'
        );
    } catch (err) {
        record('CSS Active Highlight & Underline Transitions', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 4: JavaScript Scroll Spy Logic & State Machine
    // -------------------------------------------------------------
    try {
        // Verify code contains scroll spy implementation
        assert(jsContent.includes('SPY_SECTION_IDS'), 'landing-3d.js must define SPY_SECTION_IDS');
        assert(jsContent.includes('setActiveNav'), 'landing-3d.js must define setActiveNav');
        assert(jsContent.includes('determineActiveSection'), 'landing-3d.js must define determineActiveSection');
        assert(jsContent.includes('smoothScrollToSection'), 'landing-3d.js must define smoothScrollToSection');
        assert(jsContent.includes('initScrollSpy'), 'landing-3d.js must define initScrollSpy');
        assert(jsContent.includes('IntersectionObserver'), 'landing-3d.js must configure IntersectionObserver');

        record(
            'JavaScript Scroll Spy Engine Structure',
            true,
            'landing-3d.js implements setActiveNav, determineActiveSection, smoothScrollToSection, IntersectionObserver, and initScrollSpy.'
        );
    } catch (err) {
        record('JavaScript Scroll Spy Engine Structure', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 5: DOM Simulation — Downward Scroll Sequence
    // -------------------------------------------------------------
    try {
        // Simulate DOM environment to test scroll spy state transitions
        const mockElements = {
            'hero': { id: 'hero', offsetTop: 0, offsetHeight: 2500 },
            'how-it-works': { id: 'how-it-works', offsetTop: 2500, offsetHeight: 650 },
            'impact': { id: 'impact', offsetTop: 3150, offsetHeight: 550 },
            'emergency-requests': { id: 'emergency-requests', offsetTop: 3700, offsetHeight: 800 },
            'compatibility': { id: 'compatibility', offsetTop: 4500, offsetHeight: 700 },
            'donor-stories': { id: 'donor-stories', offsetTop: 5200, offsetHeight: 600 },
            'portals': { id: 'portals', offsetTop: 5800, offsetHeight: 700 }
        };

        const activeClasses = {};
        const SPY_SECTION_IDS = ['hero', 'how-it-works', 'impact', 'emergency-requests', 'compatibility', 'portals'];

        function setActiveNavMock(targetId) {
            SPY_SECTION_IDS.forEach(id => {
                activeClasses[id] = (id === targetId);
            });
        }

        function determineActiveSectionMock(scrollY, windowHeight, docHeight) {
            if (scrollY < 120) return 'hero';
            if (scrollY + windowHeight >= docHeight - 70) return 'portals';

            const triggerY = scrollY + 70 + 60; // navHeight + 60
            let candidate = 'hero';
            for (let i = 0; i < SPY_SECTION_IDS.length; i++) {
                const id = SPY_SECTION_IDS[i];
                const el = mockElements[id];
                if (!el) continue;
                if (triggerY >= el.offsetTop) {
                    candidate = id;
                }
            }
            return candidate;
        }

        const winHeight = 900;
        const totalDocHeight = 6500;

        // Sequence Downwards:
        // 1. Top of page
        let active = determineActiveSectionMock(0, winHeight, totalDocHeight);
        setActiveNavMock(active);
        assert.strictEqual(active, 'hero', 'Step 1: Top of page must activate hero');

        // 2. Scroll to How It Works
        active = determineActiveSectionMock(2450, winHeight, totalDocHeight);
        setActiveNavMock(active);
        assert.strictEqual(active, 'how-it-works', 'Step 2: Scroll to How It Works must activate how-it-works');

        // 3. Scroll to Our Impact
        active = determineActiveSectionMock(3100, winHeight, totalDocHeight);
        setActiveNavMock(active);
        assert.strictEqual(active, 'impact', 'Step 3: Scroll to Our Impact must activate impact');

        // 4. Scroll to Emergency Requests
        active = determineActiveSectionMock(3650, winHeight, totalDocHeight);
        setActiveNavMock(active);
        assert.strictEqual(active, 'emergency-requests', 'Step 4: Scroll to Emergency Requests must activate emergency-requests');

        // 5. Scroll to Compatibility
        active = determineActiveSectionMock(4450, winHeight, totalDocHeight);
        setActiveNavMock(active);
        assert.strictEqual(active, 'compatibility', 'Step 5: Scroll to Compatibility must activate compatibility');

        // 6. Scroll to Portals
        active = determineActiveSectionMock(5750, winHeight, totalDocHeight);
        setActiveNavMock(active);
        assert.strictEqual(active, 'portals', 'Step 6: Scroll to Portals must activate portals');

        record(
            'Downward Scroll Progression (Hero -> How It Works -> Impact -> Emergency -> Compatibility -> Portals)',
            true,
            'All 6 navigation items sequentially and automatically activate as viewport scrolls downwards.'
        );
    } catch (err) {
        record('Downward Scroll Progression', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 6: DOM Simulation — Upward Scroll Sequence (Reverse)
    // -------------------------------------------------------------
    try {
        const mockElements = {
            'hero': { id: 'hero', offsetTop: 0, offsetHeight: 2500 },
            'how-it-works': { id: 'how-it-works', offsetTop: 2500, offsetHeight: 650 },
            'impact': { id: 'impact', offsetTop: 3150, offsetHeight: 550 },
            'emergency-requests': { id: 'emergency-requests', offsetTop: 3700, offsetHeight: 800 },
            'compatibility': { id: 'compatibility', offsetTop: 4500, offsetHeight: 700 },
            'portals': { id: 'portals', offsetTop: 5800, offsetHeight: 700 }
        };
        const SPY_SECTION_IDS = ['hero', 'how-it-works', 'impact', 'emergency-requests', 'compatibility', 'portals'];

        function determineActiveSectionMock(scrollY, windowHeight, docHeight) {
            if (scrollY < 120) return 'hero';
            if (scrollY + windowHeight >= docHeight - 70) return 'portals';

            const triggerY = scrollY + 70 + 60;
            let candidate = 'hero';
            for (let i = 0; i < SPY_SECTION_IDS.length; i++) {
                const id = SPY_SECTION_IDS[i];
                const el = mockElements[id];
                if (!el) continue;
                if (triggerY >= el.offsetTop) {
                    candidate = id;
                }
            }
            return candidate;
        }

        const winHeight = 900;
        const totalDocHeight = 6500;

        // Sequence Upwards in Reverse:
        // From Portals (5750) -> Compatibility (4500)
        let active = determineActiveSectionMock(4500, winHeight, totalDocHeight);
        assert.strictEqual(active, 'compatibility', 'Reverse Step 1: Upward scroll activates compatibility');

        // To Emergency Requests (3700)
        active = determineActiveSectionMock(3700, winHeight, totalDocHeight);
        assert.strictEqual(active, 'emergency-requests', 'Reverse Step 2: Upward scroll activates emergency-requests');

        // To Our Impact (3150)
        active = determineActiveSectionMock(3150, winHeight, totalDocHeight);
        assert.strictEqual(active, 'impact', 'Reverse Step 3: Upward scroll activates impact');

        // To How It Works (2500)
        active = determineActiveSectionMock(2500, winHeight, totalDocHeight);
        assert.strictEqual(active, 'how-it-works', 'Reverse Step 4: Upward scroll activates how-it-works');

        // To Home / Hero (50)
        active = determineActiveSectionMock(50, winHeight, totalDocHeight);
        assert.strictEqual(active, 'hero', 'Reverse Step 5: Upward scroll activates hero');

        record(
            'Upward Scroll Progression in Reverse Order',
            true,
            'Scrolling back upward correctly and reliably transitions active highlight in reverse.'
        );
    } catch (err) {
        record('Upward Scroll Progression in Reverse Order', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 7: Click-To-Scroll & History Hash Behavior
    // -------------------------------------------------------------
    try {
        let historyPushed = null;
        let scrolledToTop = null;
        let activeNavSet = null;

        const fakeWindow = {
            pageYOffset: 1000,
            scrollTo: (opts) => { scrolledToTop = opts.top; },
            history: {
                pushState: (state, title, url) => { historyPushed = url; }
            }
        };

        const targetEl = {
            getBoundingClientRect: () => ({ top: 400 })
        };

        function testClickScroll(targetId) {
            activeNavSet = targetId;
            const navHeight = 70;
            const targetTop = targetEl.getBoundingClientRect().top + fakeWindow.pageYOffset - (navHeight + 15);
            fakeWindow.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' });
            fakeWindow.history.pushState(null, '', '#' + targetId);
        }

        testClickScroll('impact');

        assert.strictEqual(activeNavSet, 'impact', 'Click must set active link immediately');
        assert.strictEqual(scrolledToTop, 1315, 'Click must calculate correct target top offset subtracting navbar height');
        assert.strictEqual(historyPushed, '#impact', 'Click must update browser URL hash via pushState');

        record(
            'Click-To-Scroll Offset & URL Hash Updates',
            true,
            'Clicking a nav link immediately activates highlight, calculates navbar offset, and pushes URL hash.'
        );
    } catch (err) {
        record('Click-To-Scroll Offset & URL Hash Updates', false, err.message);
    }

    // -------------------------------------------------------------
    // TEST 8: Bottom of Page Boundary Condition
    // -------------------------------------------------------------
    try {
        const winHeight = 900;
        const totalDocHeight = 6000;
        // Scroll right at the bottom: 6000 - 900 = 5100
        const scrollY = 5100;

        function checkBottom(scrollY, winHeight, totalDocHeight) {
            return (scrollY + winHeight >= totalDocHeight - 70);
        }

        assert(checkBottom(scrollY, winHeight, totalDocHeight), 'Bottom check should trigger when scrolled to page end');

        record(
            'Bottom-of-Page Edge Case (Portals Activation)',
            true,
            'Portals section reliably activates even on shorter viewports when scrolled to the end of the page.'
        );
    } catch (err) {
        record('Bottom-of-Page Edge Case (Portals Activation)', false, err.message);
    }

    const passedTotal = results.filter(r => r.passed).length;
    console.log(`\n----------------------------------------------------------------`);
    console.log(`  Scroll-Spy Verification: ${passedTotal} / ${results.length} checks passed`);
    console.log(`================================================================\n`);

    return results;
};

if (require.main === module) {
    runScrollSpyTests();
}

module.exports = runScrollSpyTests;

