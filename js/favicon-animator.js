// js/favicon-animator.js
// Animated favicon: Lock morphs into a smiley with wagging "no" finger + title marquee

(function () {
    let favicon = document.querySelector("link[rel*='icon']");
    if (!favicon) {
        favicon = document.createElement('link');
        favicon.rel = 'icon';
        document.head.appendChild(favicon);
    }
    favicon.type = 'image/png';

    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    let frame = 0;
    // Total cycle: 120 frames
    // 0-30:   Lock displayed
    // 30-45:  Fade lock out, fade smiley in
    // 45-90:  Smiley with wagging finger
    // 90-105: Fade smiley out, fade lock in
    // 105-120: Lock displayed again

    function roundRect(x, y, w, h, r) {
        if (ctx.roundRect) {
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, r);
        } else {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        }
    }

    function drawBg() {
        ctx.fillStyle = '#111111';
        roundRect(0, 0, 32, 32, 6);
        ctx.fill();
    }

    function drawLock(alpha) {
        ctx.globalAlpha = alpha;

        // Lock body
        ctx.fillStyle = '#ffffff';
        roundRect(6, 16, 20, 13, 3);
        ctx.fill();

        // Shackle
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(16, 14, 6, Math.PI, 0, false);
        ctx.stroke();

        // Keyhole
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(16, 22, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(14.8, 23, 2.4, 3);

        ctx.globalAlpha = 1;
    }

    function drawSmiley(alpha, fingerAngle) {
        ctx.globalAlpha = alpha;

        // Face circle
        ctx.fillStyle = '#FFD93D';
        ctx.beginPath();
        ctx.arc(16, 17, 11, 0, Math.PI * 2);
        ctx.fill();

        // Left eye
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(12, 15, 1.8, 0, Math.PI * 2);
        ctx.fill();

        // Right eye — winking
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#111111';
        ctx.beginPath();
        ctx.arc(20, 15, 1.8, 0.2, Math.PI - 0.2, true);
        ctx.stroke();

        // Smirk mouth
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#111111';
        ctx.beginPath();
        ctx.arc(16, 19, 5, 0.3, Math.PI - 0.3, false);
        ctx.stroke();

        // Wagging finger — drawn as a small hand to the right
        ctx.save();
        ctx.translate(27, 10);
        ctx.rotate(fingerAngle);

        // Finger stick
        ctx.strokeStyle = '#FFD93D';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -8);
        ctx.stroke();

        // Fingertip circle
        ctx.fillStyle = '#FFD93D';
        ctx.beginPath();
        ctx.arc(0, -8, 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();

        ctx.globalAlpha = 1;
    }

    function render() {
        ctx.clearRect(0, 0, 32, 32);
        drawBg();

        const f = frame % 120;

        if (f < 30) {
            // Show lock
            drawLock(1);
        } else if (f < 45) {
            // Crossfade: lock out, smiley in
            const t = (f - 30) / 15;
            drawLock(1 - t);
            drawSmiley(t, 0);
        } else if (f < 90) {
            // Smiley with wagging finger
            const wagFrame = f - 45;
            const fingerAngle = Math.sin(wagFrame * 0.7) * 0.4;
            drawSmiley(1, fingerAngle);
        } else if (f < 105) {
            // Crossfade: smiley out, lock in
            const t = (f - 90) / 15;
            const fingerAngle = Math.sin((f - 45) * 0.7) * 0.4;
            drawSmiley(1 - t, fingerAngle);
            drawLock(t);
        } else {
            // Show lock
            drawLock(1);
        }

        favicon.href = canvas.toDataURL('image/png');
        frame++;
    }

    // 12 FPS
    setInterval(render, 83);

    // Title marquee with dot separators
    const baseTitle = document.title || 'Vault';
    const marqueeStr = baseTitle + '  \u00B7  Secure  \u00B7  Zero Knowledge Encrypted  \u00B7  ';
    const len = marqueeStr.length;
    let pos = 0;
    let titleTimer = null;

    function startMarquee() {
        if (titleTimer) clearInterval(titleTimer);
        titleTimer = setInterval(() => {
            document.title = marqueeStr.substring(pos) + marqueeStr.substring(0, pos);
            pos = (pos + 1) % len;
        }, 300);
    }

    startMarquee();

    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (titleTimer) clearInterval(titleTimer);
            document.title = baseTitle;
        } else {
            pos = 0;
            startMarquee();
        }
    });
})();
