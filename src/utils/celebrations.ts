import confetti from 'canvas-confetti';

const NV_COLORS = ['#b6ff2e', '#6fb300', '#ededed', '#ccff00', '#ffffff'];

/**
 * High-velocity electric spark fireworks radiating outwards when a stamp is awarded
 */
export function triggerStampSparks(originX = 0.5, originY = 0.4) {
  try {
    // 1. Core high-speed particle burst
    confetti({
      particleCount: 50,
      angle: 90,
      spread: 80,
      startVelocity: 35,
      decay: 0.92,
      origin: { x: originX, y: originY },
      colors: NV_COLORS,
      ticks: 200,
      gravity: 1.2,
      shapes: ['circle', 'square'],
      scalar: 0.9,
    });

    // 2. Micro sparks ring (radial fireworks pop)
    setTimeout(() => {
      confetti({
        particleCount: 30,
        spread: 360,
        startVelocity: 25,
        decay: 0.88,
        origin: { x: originX, y: originY },
        colors: ['#b6ff2e', '#ffffff'],
        ticks: 140,
        gravity: 0.8,
        scalar: 0.7,
      });
    }, 80);
  } catch (err) {
    console.warn('Confetti error:', err);
  }
}

/**
 * Grand full-screen fireworks show when reward is unlocked (all stamps collected)
 */
export function triggerGrandFireworks() {
  try {
    const duration = 2.5 * 1000;
    const end = Date.now() + duration;

    // Side cannons shooting fireworks diagonally
    const frame = () => {
      confetti({
        particleCount: 4,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: NV_COLORS,
      });
      confetti({
        particleCount: 4,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: NV_COLORS,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    // Central starburst explosion
    setTimeout(() => {
      confetti({
        particleCount: 90,
        spread: 100,
        startVelocity: 45,
        origin: { x: 0.5, y: 0.45 },
        colors: ['#b6ff2e', '#ffffff', '#6fb300'],
      });
    }, 400);
  } catch (err) {
    console.warn('Grand fireworks error:', err);
  }
}
