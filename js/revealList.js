function buildArt(object) {
  if (object.src) {
    const img = document.createElement('img');
    img.className = 'reveal__art reveal__art--img';
    img.src = object.src;
    img.alt = '';
    img.decoding = 'async';
    return img;
  }
  const glyph = document.createElement('span');
  glyph.className = 'reveal__art reveal__art--glyph';
  glyph.textContent = object.glyph;
  return glyph;
}

function buildItem(item) {
  const section = document.createElement('section');
  section.className = 'reveal__item';
  if (item.tone) section.classList.add('reveal__item--' + item.tone);

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'reveal__card';
  card.setAttribute('aria-label', item.ariaLabel);
  card.addEventListener('click', item.onSelect);

  const headline = document.createElement('span');
  headline.className = 'reveal__headline';
  headline.setAttribute('aria-hidden', 'true');
  headline.textContent = item.headline;

  const object = document.createElement('span');
  object.className = 'reveal__object';
  object.setAttribute('aria-hidden', 'true');
  object.appendChild(buildArt(item.object));

  const caption = document.createElement('span');
  caption.className = 'reveal__caption';
  caption.setAttribute('aria-hidden', 'true');
  const captionText = document.createElement('span');
  captionText.className = 'pill reveal__captionText';
  captionText.textContent = item.caption;
  caption.appendChild(captionText);

  card.append(headline, object, caption);
  section.appendChild(card);
  return section;
}

export function mountRevealList(host, { items, ariaLabel, initialIndex = 0, onCommit }) {
  const scroller = document.createElement('div');
  scroller.className = 'reveal';
  scroller.setAttribute('role', 'group');
  scroller.setAttribute('aria-label', ariaLabel);
  items.forEach((item) => scroller.appendChild(buildItem(item)));
  host.appendChild(scroller);

  const start = Math.min(Math.max(initialIndex, 0), items.length - 1);
  if (start > 0) scroller.scrollTop = start * scroller.clientHeight;
  scroller.children[start].classList.add('is-landed');

  if (!('onscrollsnapchange' in document.documentElement)) return () => {};

  const onSnap = (event) => {
    const landed = event.snapTargetBlock;
    if (!landed) return;
    const index = Array.prototype.indexOf.call(scroller.children, landed);
    if (index !== Math.round(scroller.scrollTop / scroller.clientHeight)) return;
    Array.from(scroller.children).forEach((section) => section.classList.remove('is-landed'));
    void landed.offsetWidth;
    landed.classList.add('is-landed');
    if (onCommit) onCommit(index);
  };

  scroller.addEventListener('scrollsnapchange', onSnap);
  return () => scroller.removeEventListener('scrollsnapchange', onSnap);
}
