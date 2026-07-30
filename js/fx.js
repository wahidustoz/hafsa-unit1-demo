const CONFETTI_COLORS = ['var(--celebration)', 'var(--reward)', 'var(--success)', 'var(--primary)'];

function reducedMotion() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function confetti(host) {
  if (!host || reducedMotion()) return;

  const hostStyle = getComputedStyle(host);
  if (hostStyle.position === 'static') {
    host.style.position = 'relative';
  }

  const layer = document.createElement('div');
  layer.className = 'fx-confetti';
  layer.setAttribute('aria-hidden', 'true');

  const count = 90;
  for (let i = 0; i < count; i++) {
    const bit = document.createElement('span');
    const roll = Math.random();
    let variant = '';
    if (roll < 0.34) variant = ' fx-confetti__bit--square';
    else if (roll < 0.52) variant = ' fx-confetti__bit--strip';
    bit.className = 'fx-confetti__bit' + variant;

    const size = 7 + Math.random() * 13;
    bit.style.setProperty('--x', (Math.random() * 100).toFixed(2) + '%');
    bit.style.setProperty('--sz', size.toFixed(1) + 'px');
    bit.style.setProperty('--c', CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
    bit.style.setProperty('--t', (1.3 + Math.random() * 1.1).toFixed(2) + 's');
    bit.style.setProperty('--dl', (Math.random() * 0.5).toFixed(2) + 's');

    layer.appendChild(bit);
  }

  host.appendChild(layer);
  setTimeout(() => layer.remove(), 2500);
}

export function pointerHand(host, targetEl) {
  if (!host || !targetEl) return () => {};

  const hostStyle = getComputedStyle(host);
  if (hostStyle.position === 'static') {
    host.style.position = 'relative';
  }

  const hand = document.createElement('img');
  hand.className = 'fx-pointer-hand' + (reducedMotion() ? ' fx-pointer-hand--still' : '');
  hand.src = './assets/images/pointer.png';
  hand.alt = '';
  hand.setAttribute('aria-hidden', 'true');
  host.appendChild(hand);

  function place() {
    const hostRect = host.getBoundingClientRect();
    const targetRect = targetEl.getBoundingClientRect();
    const handRect = hand.getBoundingClientRect();
    const x = targetRect.right - hostRect.left - handRect.width * 0.35;
    const y = targetRect.bottom - hostRect.top - handRect.height * 0.55;
    hand.style.left = Math.max(0, x) + 'px';
    hand.style.top = Math.max(0, y) + 'px';
  }

  place();
  const onResize = () => place();
  window.addEventListener('resize', onResize);

  return function removePointerHand() {
    window.removeEventListener('resize', onResize);
    hand.remove();
  };
}
