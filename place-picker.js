// Searchable nation/city comboboxes. Needs CIVMC_PLACES (places.js).
(function () {
  const MAX = 80;

  function places() {
    return typeof CIVMC_PLACES !== "undefined" ? CIVMC_PLACES : { nations: [], byNation: {}, cities: [], cityNations: {} };
  }

  function norm(s) {
    return String(s || "").trim().toLowerCase();
  }

  function filterList(list, q) {
    const needle = norm(q);
    if (!needle) return list.slice(0, MAX);
    const starts = [];
    const contains = [];
    for (const item of list) {
      const n = norm(item);
      if (n.startsWith(needle)) starts.push(item);
      else if (n.includes(needle)) contains.push(item);
      if (starts.length + contains.length >= MAX) break;
    }
    return starts.concat(contains).slice(0, MAX);
  }

  function citiesForNation(nation) {
    const P = places();
    const n = String(nation || "").trim();
    if (!n) return P.cities.slice();
    // Exact key first, then case-insensitive
    if (P.byNation[n]) return P.byNation[n].slice();
    const key = Object.keys(P.byNation).find(k => norm(k) === norm(n));
    return key ? P.byNation[key].slice() : P.cities.slice();
  }

  function nationsForCity(city) {
    const P = places();
    const c = String(city || "").trim();
    if (!c) return [];
    if (P.cityNations && P.cityNations[c]) return P.cityNations[c].slice();
    const key = P.cityNations && Object.keys(P.cityNations).find(k => norm(k) === norm(c));
    return key ? P.cityNations[key].slice() : [];
  }

  function ensureWrap(input) {
    if (input.closest(".place-combo")) return input.closest(".place-combo");
    const wrap = document.createElement("div");
    wrap.className = "place-combo";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    input.classList.add("place-combo-input");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    const box = document.createElement("div");
    box.className = "place-combo-list ac-box";
    box.hidden = true;
    box.setAttribute("role", "listbox");
    wrap.appendChild(box);
    return wrap;
  }

  function positionBox(input, box) {
    // Prefer absolute under the wrap (CSS); keep fixed fallback if clipped
    box.style.minWidth = Math.max(input.offsetWidth, 160) + "px";
  }

  function closeBox(wrap) {
    const input = wrap.querySelector(".place-combo-input");
    const box = wrap.querySelector(".place-combo-list");
    if (box) { box.hidden = true; box.innerHTML = ""; }
    if (input) input.setAttribute("aria-expanded", "false");
    wrap._active = -1;
  }

  function openList(wrap, items, onPick) {
    const input = wrap.querySelector(".place-combo-input");
    const box = wrap.querySelector(".place-combo-list");
    box.innerHTML = "";
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "place-combo-empty meta";
      empty.textContent = "No matches - you can still type a custom name";
      box.appendChild(empty);
      box.hidden = false;
      input.setAttribute("aria-expanded", "true");
      positionBox(input, box);
      wrap._active = -1;
      return;
    }
    items.forEach((label, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ac-item";
      btn.setAttribute("role", "option");
      btn.textContent = label;
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        onPick(label);
      });
      box.appendChild(btn);
    });
    box.hidden = false;
    input.setAttribute("aria-expanded", "true");
    positionBox(input, box);
    wrap._active = -1;
  }

  function setActive(wrap, idx) {
    const items = [...wrap.querySelectorAll(".ac-item")];
    if (!items.length) return;
    wrap._active = ((idx % items.length) + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle("on", i === wrap._active));
    items[wrap._active].scrollIntoView({ block: "nearest" });
  }

  function bindCombo(input, getOptions, onCommit) {
    const wrap = ensureWrap(input);
    const box = wrap.querySelector(".place-combo-list");

    const refresh = () => openList(wrap, filterList(getOptions(), input.value), (label) => {
      input.value = label;
      closeBox(wrap);
      onCommit(label);
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    input.addEventListener("focus", refresh);
    input.addEventListener("input", refresh);
    input.addEventListener("keydown", (e) => {
      if (box.hidden && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        refresh();
        e.preventDefault();
        return;
      }
      if (box.hidden) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setActive(wrap, (wrap._active ?? -1) + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setActive(wrap, (wrap._active ?? -1) - 1); }
      else if (e.key === "Enter") {
        const items = [...wrap.querySelectorAll(".ac-item")];
        if (wrap._active >= 0 && items[wrap._active]) {
          e.preventDefault();
          items[wrap._active].dispatchEvent(new Event("mousedown"));
        } else {
          closeBox(wrap);
        }
      } else if (e.key === "Escape") {
        closeBox(wrap);
      }
    });
    input.addEventListener("blur", () => {
      setTimeout(() => closeBox(wrap), 120);
    });
  }

  /** Generic searchable combobox (same UI as nation/city pickers). */
  window.bindSearchCombo = function bindSearchCombo(input, getOptions, onCommit) {
    if (!input || input.dataset.searchComboBound) return;
    input.dataset.searchComboBound = "1";
    bindCombo(input, typeof getOptions === "function" ? getOptions : () => [], onCommit || (() => {}));
  };

  window.bindNationField = function bindNationField(nationInput) {
    if (!nationInput || nationInput.dataset.placeBound) return;
    nationInput.dataset.placeBound = "1";
    nationInput.placeholder = nationInput.placeholder || "Search nations…";
    nationInput.title = "Pick from active CivMC nations (CivWiki), or type a custom name";
    bindCombo(nationInput, () => places().nations.slice(), () => {});
  };

  /**
   * Pair nation + city inputs with searchable dropdowns.
   * City list narrows when a known nation is selected; picking a city
   * can auto-fill nation when unambiguous.
   */
  window.bindPlaceFields = function bindPlaceFields(nationInput, cityInput) {
    if (!nationInput || !cityInput) return;
    if (nationInput.dataset.placeBound && cityInput.dataset.placeBound) return;
    if (!nationInput.dataset.placeBound) {
      nationInput.dataset.placeBound = "1";
      nationInput.placeholder = nationInput.placeholder || "Search nations…";
      nationInput.title = "Pick from active CivMC nations (CivWiki), or type a custom name";
      bindCombo(nationInput, () => places().nations.slice(), () => {});
    }
    if (!cityInput.dataset.placeBound) {
      cityInput.dataset.placeBound = "1";
      cityInput.placeholder = cityInput.placeholder || "Search cities…";
      cityInput.title = "Pick from known settlements, or type a custom name";
      bindCombo(cityInput, () => citiesForNation(nationInput.value), (city) => {
        const owners = nationsForCity(city);
        const current = nationInput.value.trim();
        if (!owners.length) return;
        if (!current) {
          nationInput.value = owners[0];
          nationInput.dispatchEvent(new Event("change", { bubbles: true }));
        } else if (!owners.some(o => norm(o) === norm(current)) && owners.length === 1) {
          nationInput.value = owners[0];
          nationInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }
  };

  window.bindPlaceFieldsIn = function bindPlaceFieldsIn(root) {
    const scope = root || document;
    const sn = scope.querySelector("#s-nation");
    const sc = scope.querySelector("#s-city");
    if (sn && sc) bindPlaceFields(sn, sc);

    scope.querySelectorAll("[data-panel]").forEach(panel => {
      const n = panel.querySelector(".p-nation");
      const c = panel.querySelector(".p-city");
      if (n && c) bindPlaceFields(n, c);
    });

    scope.querySelectorAll(".place-nation").forEach(n => {
      const parent = n.closest(".row, .place-pair, form, .panel, .stack") || n.parentElement;
      const c = parent && parent.querySelector(".place-city");
      if (c) bindPlaceFields(n, c);
      else bindNationField(n);
    });
  };
})();
