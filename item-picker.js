// Popup item picker. Needs ITEMS (items.js) and the picker styles in style.css.
// Item names are stored as "oak boat". itemImg() and esc() come from app.js.

// "oak" -> everything with oak in it, "oak boat" -> needs both words, plurals are forgiven
function searchItems(q) {
  const words = q.toLowerCase().replace(/_/g, " ").split(/\s+/).filter(Boolean);
  if (!words.length) return ITEMS;
  const find = ws => ITEMS.filter(n => ws.every(w => n.includes(w)));
  let hits = find(words);
  if (!hits.length) {
    const singular = words.map(w => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));
    hits = find(singular);
  }
  // names starting with what you typed first, then whole-word matches, then the rest
  const w0 = words[0];
  const rank = n => (n.startsWith(w0) ? 0 : n.split(" ").includes(w0) ? 1 : 2);
  return hits.slice().sort((a, b) => rank(a) - rank(b));
}

function openItemPicker(onPick) {
  const overlay = document.createElement("div");
  overlay.className = "picker-overlay";
  overlay.innerHTML = `
    <div class="picker" role="dialog" aria-label="Pick an item">
      <input type="search" class="picker-search" placeholder="Search items (oak, oak boat, diamond...)" autocomplete="off">
      <div class="picker-grid"></div>
      <div class="picker-foot"></div>
    </div>`;
  document.body.appendChild(overlay);

  const input = overlay.querySelector(".picker-search");
  const grid = overlay.querySelector(".picker-grid");
  const foot = overlay.querySelector(".picker-foot");

  function close() {
    document.removeEventListener("keydown", onKey);
    overlay.remove();
  }
  function onKey(e) { if (e.key === "Escape") close(); }
  document.addEventListener("keydown", onKey);

  function draw() {
    const list = searchItems(input.value);
    foot.textContent = list.length + " item" + (list.length === 1 ? "" : "s");
    grid.scrollTop = 0;
    if (!list.length) { grid.innerHTML = '<p class="meta" style="grid-column:1/-1">No items match that.</p>'; return; }
    grid.innerHTML = list.map(n =>
      `<button type="button" class="pick" data-name="${esc(n)}" title="${esc(n)}"><img src="${itemImg(n)}" alt="${esc(n)}" loading="lazy"></button>`
    ).join("");
  }

  input.addEventListener("input", draw);

  grid.addEventListener("click", e => {
    const b = e.target.closest("button.pick");
    if (!b) return;
    onPick(b.dataset.name);
    close();
  });
  grid.addEventListener("mouseover", e => {
    const b = e.target.closest("button.pick");
    if (b) foot.textContent = b.dataset.name;
  });
  // textures that don't exist show the name as text instead of a broken image
  grid.addEventListener("error", e => {
    if (e.target.tagName === "IMG") {
      const span = document.createElement("span");
      span.className = "pick-missing";
      span.textContent = e.target.alt;
      e.target.replaceWith(span);
    }
  }, true);

  overlay.addEventListener("mousedown", e => { if (e.target === overlay) close(); });

  draw();
  input.focus();
}
