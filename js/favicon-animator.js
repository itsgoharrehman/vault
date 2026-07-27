// js/favicon-animator.js
// Smooth animated favicon + butter-smooth title ticker

(function () {
    let favicon = document.querySelector("link[rel*='icon']");
    if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
    }
    favicon.type = 'image/png';

    const C = document.createElement('canvas');
    C.width = 32;
    C.height = 32;
    const X = C.getContext('2d');

    // Smooth easing
    function ease(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // Cycle phases (using normalized 0-1 time per phase)
    // Phase 0: Lock visible (2s)
    // Phase 1: Slide lock out, shield in (1s)
    // Phase 2: Shield visible (2s)
    // Phase 3: Slide shield out, lock in (1s)
    const phaseDurations = [2000, 1000, 2000, 1000]; // ms
    const totalDuration = 6000;
    let startTime = performance.now();

    function clip() {
        X.beginPath();
        if (X.roundRect) X.roundRect(0, 0, 32, 32, 6);
        else X.rect(0, 0, 32, 32);
        X.clip();
    }

    function bg() {
        X.fillStyle = '#0f0f0f';
        X.beginPath();
        if (X.roundRect) X.roundRect(0, 0, 32, 32, 6);
        else X.rect(0, 0, 32, 32);
        X.fill();
    }

    function drawLock(y) {
        X.fillStyle = '#ffffff';
        X.beginPath();
        if (X.roundRect) X.roundRect(7, 17 + y, 18, 12, 2.5);
        else X.rect(7, 17 + y, 18, 12);
        X.fill();

        X.strokeStyle = '#ffffff';
        X.lineWidth = 3;
        X.lineCap = 'round';
        X.beginPath();
        X.arc(16, 14 + y, 5.5, Math.PI, 0);
        X.stroke();

        X.fillStyle = '#0f0f0f';
        X.beginPath();
        X.arc(16, 22 + y, 2, 0, Math.PI * 2);
        X.fill();
        X.fillRect(15, 23.5 + y, 2, 2.5);
    }

    function drawShield(y) {
        X.fillStyle = '#ffffff';
        X.beginPath();
        X.moveTo(16, 4 + y);
        X.lineTo(6, 9 + y);
        X.lineTo(6, 17 + y);
        X.quadraticCurveTo(6, 28 + y, 16, 30 + y);
        X.quadraticCurveTo(26, 28 + y, 26, 17 + y);
        X.lineTo(26, 9 + y);
        X.closePath();
        X.fill();

        X.strokeStyle = '#0f0f0f';
        X.lineWidth = 3.5;
        X.lineCap = 'round';
        X.lineJoin = 'round';
        X.beginPath();
        X.moveTo(11, 17 + y);
        X.lineTo(14.5, 22 + y);
        X.lineTo(22, 12 + y);
        X.stroke();
    }

    // Throttle favicon data URL updates to ~20fps to avoid jank
    let lastFaviconUpdate = 0;
    const faviconInterval = 50; // 20fps

    function render(now) {
        requestAnimationFrame(render);

        if (now - lastFaviconUpdate < faviconInterval) return;
        lastFaviconUpdate = now;

        const elapsed = (now - startTime) % totalDuration;

        // Determine current phase and progress within it
        let phase = 0;
        let phaseTime = elapsed;
        for (let i = 0; i < phaseDurations.length; i++) {
            if (phaseTime < phaseDurations[i]) {
                phase = i;
                break;
            }
            phaseTime -= phaseDurations[i];
            phase = i + 1;
        }
        if (phase >= phaseDurations.length) phase = 0;

        const t = ease(phaseTime / phaseDurations[phase]);

        X.clearRect(0, 0, 32, 32);
        bg();
        X.save();
        clip();

        if (phase === 0) {
            drawLock(0);
        } else if (phase === 1) {
            drawLock(-t * 36);
            drawShield(36 - t * 36);
        } else if (phase === 2) {
            drawShield(0);
        } else {
            drawShield(-t * 36);
            drawLock(36 - t * 36);
        }

        X.restore();
        favicon.href = C.toDataURL('image/png');
    }

    requestAnimationFrame(render);

    // ─── Smooth Title Ticker ───
    // Uses a fast interval with 1-char steps for a fluid scroll feel
    const baseTitle = document.title || 'Vault';
    const gap = '    ';  // spacing between repeats
    const tickerSrc = baseTitle + gap + 'Secure' + gap + 'Zero Knowledge Encrypted' + gap;
    const len = tickerSrc.length;
    let pos = 0;
    let tickerTimer = null;

    function startTicker() {
        if (tickerTimer) clearInterval(tickerTimer);
        tickerTimer = setInterval(() => {
            document.title = tickerSrc.substring(pos) + tickerSrc.substring(0, pos);
            pos = (pos + 1) % len;
        }, 150);
    }

    startTicker();

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (tickerTimer) clearInterval(tickerTimer);
            document.title = baseTitle;
        } else {
            pos = 0;
            startTicker();
        }
    });
})();
