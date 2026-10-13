/** Directory ads editor (Admin + /ads/). Depends on app.js (sb, esc, fmtDate, setMsg, directory ad canvas helpers). */

function profileIsHead(p) {
  return !!(p && (p.is_head === true || p.is_head === "true" || p.is_head === 1));
}

function profileIdentity(p) {
  if (!p) return { username: "", login: "", mc: "", display: "", email: "" };
  const username = String(p.username || "").trim();
  const login = String(p.login_username || p.username || "").trim();
  const mc = String(p.mc_username || "").trim();
  const email = String(p.email || "").trim();
  let display = username;
  if (typeof userName === "function") {
    try { display = userName(p) || username; } catch (e) { /* ignore */ }
  }
  return { username, login, mc, display, email };
}

/** Directory ads UI: head tools, any admin, or pengdi on any identity field. */
function canEditDirectoryAds(p, head) {
  if (head) return true;
  if (p && (p.is_admin || p.is_head)) return true;
  const id = profileIdentity(p);
  const blob = [id.username, id.login, id.mc, id.display, id.email, p && p.discord_username]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return blob.includes("pengdi");
}

function canAccessDirectoryAdsPage(p, head) {
  if (p && p.is_admin && !stillTimedOut(p)) return true;
  return canEditDirectoryAds(p, head);
}

async function resolveIsHead(profile) {
  if (profileIsHead(profile)) return true;
  try {
    const { data, error } = await sb.rpc("is_head");
    if (!error && data === true) return true;
  } catch (e) { /* rpc missing on old deploy */ }
  return false;
}

let directoryAds = [];
let adEditingId = null;
let adView = "web";
let adDocs = { web: directoryAdDefaultDoc("web"), mod: directoryAdDefaultDoc("mod") };
let adSelectedId = null;
let directoryAdsUiReady = false;
let adPropsPanelKey = null;
let adPreviewTimer = null;

const AD_RESIZE_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function adPropsKey() {
  const el = adEl();
  return el ? "el:" + el.id : "doc:" + adView;
}

function scheduleAdPreview() {
  const preview = document.getElementById("ad-preview");
  if (!preview) return;
  clearTimeout(adPreviewTimer);
  adPreviewTimer = setTimeout(() => {
    renderDirectoryAdCanvas(preview, adDoc(), { kind: adView });
  }, 150);
}

function syncAdGeomInputs() {
  const el = adEl();
  if (!el) return;
  for (const k of ["x", "y", "w", "h", "size"]) {
    const inp = document.querySelector("#ad-props [data-ad-prop=\"" + k + "\"]");
    if (inp && document.activeElement !== inp) inp.value = String(el[k] ?? "");
  }
}

function paintAdEditorNode(el, selected) {
  const node = document.createElement("div");
  node.className = "ad-edit-el ad-edit-" + el.type + (selected ? " selected" : "");
  applyAdEditNodeStyles(node, el);
  node.dataset.id = el.id;
  node.onpointerdown = startAdDrag;
  if (selected) appendAdResizeHandles(node);
  return node;
}

function applyAdEditNodeStyles(node, el) {
  node.style.left = el.x + "px";
  node.style.top = el.y + "px";
  node.style.width = el.w + "px";
  node.style.height = el.h + "px";
  node.style.color = el.color;
  node.style.fontSize = (10 * (el.size || 1)) + "px";
  if (el.type === "box") {
    node.style.background = el.fill;
    node.style.borderColor = el.stroke;
  } else if (el.type === "button") {
    node.style.background = el.style === "ghost"
      ? "color-mix(in srgb, var(--bg) 55%, transparent)"
      : "";
  }
  node.textContent = el.type === "button" ? el.label : (el.type === "image" ? "image" : el.text);
}

function appendAdResizeHandles(node) {
  for (const dir of AD_RESIZE_HANDLES) {
    const r = document.createElement("span");
    r.className = "ad-resize";
    r.dataset.dir = dir;
    r.onpointerdown = startAdResize;
    node.appendChild(r);
  }
}

function updateAdEditorSelection() {
  const stage = document.getElementById("ad-editor");
  if (!stage) return;
  stage.querySelectorAll(".ad-edit-el").forEach(node => {
    const id = node.dataset.id;
    const el = adDoc().elements.find(x => x.id === id);
    const selected = id === adSelectedId;
    node.classList.toggle("selected", selected);
    node.querySelectorAll(".ad-resize").forEach(h => h.remove());
    if (selected) appendAdResizeHandles(node);
    if (el) applyAdEditNodeStyles(node, el);
  });
}

function syncAdEditorFromModel() {
  const stage = document.getElementById("ad-editor");
  if (!stage) return;
  const doc = adDoc();
  stage.style.width = doc.w + "px";
  stage.style.height = doc.h + "px";
  stage.style.background = doc.bg;
  const ids = new Set(doc.elements.map(e => e.id));
  stage.querySelectorAll(".ad-edit-el").forEach(node => {
    if (!ids.has(node.dataset.id)) node.remove();
  });
  for (const el of doc.elements) {
    let node = stage.querySelector(".ad-edit-el[data-id=\"" + el.id + "\"]");
    if (!node) {
      node = paintAdEditorNode(el, el.id === adSelectedId);
      stage.appendChild(node);
    } else {
      applyAdEditNodeStyles(node, el);
      node.classList.toggle("selected", el.id === adSelectedId);
    }
  }
  updateAdEditorSelection();
  scheduleAdPreview();
}

function onAdPropsPanelInput(e) {
  const inp = e.target.closest("[data-ad-doc], [data-ad-prop]");
  if (!inp) return;
  if (inp.dataset.adDoc) {
    adDoc()[inp.dataset.adDoc] = inp.value;
    const stage = document.getElementById("ad-editor");
    if (stage) stage.style.background = adDoc().bg;
    scheduleAdPreview();
    return;
  }
  const el = adEl();
  if (!el) return;
  const k = inp.dataset.adProp;
  if (["x", "y", "w", "h", "size"].includes(k)) el[k] = Number(inp.value) || 0;
  else if (k === "text") {
    if (el.type === "button") el.label = inp.value;
    else el.text = inp.value;
  } else if (k === "href") {
    if (el.type === "image") el.src = inp.value;
    else el.href = inp.value;
  } else el[k] = inp.value;
  syncAdEditorFromModel();
}

function adDoc() { return adDocs[adView]; }
function adEl() { return adDoc().elements.find(e => e.id === adSelectedId) || null; }
function adLocalValue(ts) {
  const d = ts ? new Date(ts) : new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function adNewDoc() {
  adEditingId = null;
  adSelectedId = null;
  adPropsPanelKey = null;
  adDocs = { web: directoryAdDefaultDoc("web"), mod: directoryAdDefaultDoc("mod") };
  const title = document.getElementById("ad-title");
  const priority = document.getElementById("ad-priority");
  const enabled = document.getElementById("ad-enabled");
  const start = document.getElementById("ad-start");
  const end = document.getElementById("ad-end");
  if (title) title.value = "";
  if (priority) priority.value = "0";
  if (enabled) enabled.checked = true;
  if (start) start.value = adLocalValue(new Date());
  if (end) end.value = adLocalValue(new Date(Date.now() + 7 * 86400000));
  renderAdEditor();
}

function setupDirectoryAdsUi() {
  const form = document.getElementById("ad-form");
  if (!form) return;
  if (directoryAdsUiReady) {
    paintDirectoryAds();
    return;
  }
  directoryAdsUiReady = true;
  const host = document.getElementById("ads-wrap") || document.querySelector(".directory-ad-admin");
  if (host) host.addEventListener("click", onDirectoryAdClick);
  form.addEventListener("submit", saveDirectoryAd);
  const adNew = document.getElementById("ad-new");
  if (adNew) adNew.onclick = adNewDoc;
  const dup = document.getElementById("ad-duplicate");
  if (dup) dup.onclick = duplicateAdElement;
  const del = document.getElementById("ad-delete-el");
  if (del) del.onclick = deleteAdElement;
  document.querySelectorAll("[data-ad-view]").forEach(btn => {
    btn.onclick = () => {
      adView = btn.dataset.adView;
      document.querySelectorAll("[data-ad-view]").forEach(b => b.classList.toggle("primary", b === btn));
      adSelectedId = null;
      adPropsPanelKey = null;
      renderAdEditor();
    };
  });
  document.querySelectorAll("[data-ad-add]").forEach(btn => {
    btn.onclick = () => addAdElement(btn.dataset.adAdd);
  });
  const propsHost = document.getElementById("ad-props");
  if (propsHost && !propsHost.dataset.adPropsBound) {
    propsHost.dataset.adPropsBound = "1";
    propsHost.addEventListener("input", onAdPropsPanelInput);
    propsHost.addEventListener("change", onAdPropsPanelInput);
  }
  adNewDoc();
  paintDirectoryAds();
}

function onDirectoryAdClick(e) {
  const rowBtn = e.target.closest("button[data-ad-act]");
  if (rowBtn) return handleDirectoryAdRow(rowBtn);
}

async function paintDirectoryAds() {
  const box = document.getElementById("ads-list");
  if (!box) return;
  const { data, error } = await sb.from("directory_ads").select("*").order("created_at", { ascending: false }).limit(50);
  if (error) {
    box.innerHTML = `<p class="meta">${esc(error.message)}</p>`;
    return;
  }
  directoryAds = data || [];
  if (!directoryAds.length) {
    box.innerHTML = "<p class=\"meta\">No directory ads yet.</p>";
    return;
  }
  const now = Date.now();
  box.innerHTML = directoryAds.map(a => {
    const active = a.enabled && new Date(a.starts_at).getTime() <= now && new Date(a.ends_at).getTime() > now;
    return `<div class="listing" data-ad-id="${a.id}"><div><b>${esc(a.title)}</b> ${active ? '<span class="tag sale">active</span>' : (a.enabled ? '<span class="tag">scheduled</span>' : '<span class="tag bad">disabled</span>')}<span class="meta"> · p${a.priority || 0} · ${esc(fmtDate(a.starts_at))} -> ${esc(fmtDate(a.ends_at))}</span></div><div class="row" style="gap:6px"><button type="button" class="small" data-ad-act="edit">Edit</button><button type="button" class="small" data-ad-act="toggle">${a.enabled ? "Disable" : "Enable"}</button><button type="button" class="small" data-ad-act="delete">Delete</button></div></div>`;
  }).join("");
}

async function handleDirectoryAdRow(btn) {
  const id = btn.closest("[data-ad-id]").dataset.adId;
  const ad = directoryAds.find(a => String(a.id) === String(id));
  if (!ad) return;
  const admsg = document.getElementById("admsg");
  if (btn.dataset.adAct === "edit") {
    adEditingId = ad.id;
    adDocs = { web: normalizeDirectoryAdDoc(ad.layout_web, "web"), mod: normalizeDirectoryAdDoc(ad.layout_mod, "mod") };
    adSelectedId = null;
    document.getElementById("ad-title").value = ad.title || "";
    document.getElementById("ad-start").value = adLocalValue(ad.starts_at);
    document.getElementById("ad-end").value = adLocalValue(ad.ends_at);
    document.getElementById("ad-priority").value = ad.priority || 0;
    document.getElementById("ad-enabled").checked = !!ad.enabled;
    renderAdEditor();
  } else if (btn.dataset.adAct === "toggle") {
    const { error } = await sb.from("directory_ads").update({ enabled: !ad.enabled }).eq("id", ad.id);
    if (error) setDirectoryAdSaveError(admsg, error.message);
    await paintDirectoryAds();
  } else if (btn.dataset.adAct === "delete" && confirm("Delete this directory ad?")) {
    const { error } = await sb.from("directory_ads").delete().eq("id", ad.id);
    if (error) setDirectoryAdSaveError(admsg, error.message);
    await paintDirectoryAds();
    if (String(adEditingId) === String(ad.id)) adNewDoc();
  }
}

function setDirectoryAdSaveError(el, message) {
  if (!el) return;
  let msg = message || "Save failed.";
  if (/policy|permission|row-level|42501|not authorized/i.test(msg)) {
    msg = "Database blocked this change (usually head admin only). You can still use the editor — ask head admin to save, or sign in as head. Details: " + msg;
  }
  setMsg(el, msg, "err");
}

function addAdElement(type) {
  const id = type + "-" + Math.random().toString(36).slice(2, 8);
  const el = {
    id, type, x: 12, y: 12,
    w: type === "button" ? 82 : 130,
    h: type === "text" ? 16 : 24,
    text: "New text", label: "Visit", href: "/home/", src: "",
    color: "#E6E4DA", fill: "#242722", stroke: "#7FB069", size: 1, style: "primary"
  };
  adDoc().elements.push(el);
  adSelectedId = id;
  renderAdEditor();
}

function duplicateAdElement() {
  const el = adEl();
  if (!el) return;
  const copy = { ...el, id: el.type + "-" + Math.random().toString(36).slice(2, 8), x: el.x + 8, y: el.y + 8 };
  adDoc().elements.push(copy);
  adSelectedId = copy.id;
  renderAdEditor();
}

function deleteAdElement() {
  if (!adSelectedId) return;
  adDoc().elements = adDoc().elements.filter(e => e.id !== adSelectedId);
  adSelectedId = null;
  renderAdEditor();
}

function renderAdEditor() {
  const stage = document.getElementById("ad-editor");
  const preview = document.getElementById("ad-preview");
  if (!stage) return;
  const doc = adDoc();
  stage.style.width = doc.w + "px";
  stage.style.height = doc.h + "px";
  stage.style.background = doc.bg;
  stage.innerHTML = "";
  for (const el of doc.elements) {
    stage.appendChild(paintAdEditorNode(el, el.id === adSelectedId));
  }
  renderAdProps(true);
  if (preview) renderDirectoryAdCanvas(preview, doc, { kind: adView });
}

function clampAdRect(el) {
  const doc = adDoc();
  const min = 8;
  el.w = Math.max(min, Math.min(el.w, doc.w));
  el.h = Math.max(min, Math.min(el.h, doc.h));
  el.x = Math.max(0, Math.min(el.x, doc.w - el.w));
  el.y = Math.max(0, Math.min(el.y, doc.h - el.h));
}

function applyAdResize(el, dir, dx, dy, start) {
  let x = start.x, y = start.y, w = start.w, h = start.h;
  const min = 8;
  if (dir.includes("e")) w = Math.max(min, start.w + dx);
  if (dir.includes("w")) {
    w = Math.max(min, start.w - dx);
    x = start.x + start.w - w;
  }
  if (dir.includes("s")) h = Math.max(min, start.h + dy);
  if (dir.includes("n")) {
    h = Math.max(min, start.h - dy);
    y = start.y + start.h - h;
  }
  el.x = Math.round(x);
  el.y = Math.round(y);
  el.w = Math.round(w);
  el.h = Math.round(h);
  clampAdRect(el);
}

function patchAdEditorNode(el) {
  const stage = document.getElementById("ad-editor");
  if (!stage) return;
  const node = stage.querySelector(".ad-edit-el[data-id=\"" + el.id + "\"]");
  if (node) applyAdEditNodeStyles(node, el);
}

function startAdDrag(e) {
  if (e.target.closest(".ad-resize")) return;
  const el = adDoc().elements.find(x => x.id === e.currentTarget.dataset.id);
  if (!el) return;
  const selectionChanged = adSelectedId !== el.id;
  adSelectedId = el.id;
  if (selectionChanged) {
    updateAdEditorSelection();
    renderAdProps(true);
  }
  const doc = adDoc();
  const sx = e.clientX, sy = e.clientY, ox = el.x, oy = el.y;
  const node = e.currentTarget;
  node.setPointerCapture(e.pointerId);
  node.onpointermove = ev => {
    el.x = Math.max(0, Math.min(Math.round(ox + ev.clientX - sx), doc.w - el.w));
    el.y = Math.max(0, Math.min(Math.round(oy + ev.clientY - sy), doc.h - el.h));
    patchAdEditorNode(el);
  };
  node.onpointerup = ev => {
    node.onpointermove = null;
    node.releasePointerCapture(ev.pointerId);
    syncAdGeomInputs();
    scheduleAdPreview();
  };
}

function startAdResize(e) {
  e.stopPropagation();
  e.preventDefault();
  const handle = e.currentTarget;
  const host = handle.parentElement;
  const dir = handle.dataset.dir || "se";
  const el = adDoc().elements.find(x => x.id === host.dataset.id);
  if (!el) return;
  adSelectedId = el.id;
  const sx = e.clientX, sy = e.clientY;
  const start = { x: el.x, y: el.y, w: el.w, h: el.h };
  host.setPointerCapture(e.pointerId);
  host.onpointermove = ev => {
    applyAdResize(el, dir, ev.clientX - sx, ev.clientY - sy, start);
    patchAdEditorNode(el);
  };
  host.onpointerup = ev => {
    host.onpointermove = null;
    host.releasePointerCapture(ev.pointerId);
    syncAdGeomInputs();
    scheduleAdPreview();
  };
}

function renderAdProps(force) {
  const p = document.getElementById("ad-props");
  if (!p) return;
  const key = adPropsKey();
  if (!force && adPropsPanelKey === key) return;
  adPropsPanelKey = key;
  const el = adEl();
  if (!el) {
    p.innerHTML = '<p class="meta">Select an element to edit its text, colors, link, and size.</p><label>Background</label><input data-ad-doc="bg" value="' + esc(adDoc().bg) + '">';
    return;
  }
  p.innerHTML = `<div class="ad-prop-grid"><label>Text / label<input data-ad-prop="text" value="${esc(el.type === "button" ? el.label : el.text)}"></label><label>Href / image src<input data-ad-prop="href" value="${esc(el.type === "image" ? el.src : el.href)}"></label><label>Color<input data-ad-prop="color" value="${esc(el.color)}"></label><label>Fill<input data-ad-prop="fill" value="${esc(el.fill)}"></label><label>Stroke<input data-ad-prop="stroke" value="${esc(el.stroke)}"></label><label>Size<input data-ad-prop="size" type="number" step="0.1" min="0.7" max="3" value="${esc(el.size || 1)}"></label><label>X<input data-ad-prop="x" type="number" value="${esc(el.x)}"></label><label>Y<input data-ad-prop="y" type="number" value="${esc(el.y)}"></label><label>W<input data-ad-prop="w" type="number" value="${esc(el.w)}"></label><label>H<input data-ad-prop="h" type="number" value="${esc(el.h)}"></label><label>Style<select data-ad-prop="style"><option value="primary"${el.style !== "ghost" ? " selected" : ""}>Primary</option><option value="ghost"${el.style === "ghost" ? " selected" : ""}>Ghost</option></select></label></div>`;
}

async function saveDirectoryAd(e) {
  e.preventDefault();
  const admsg = document.getElementById("admsg");
  const starts = new Date(document.getElementById("ad-start").value);
  const ends = new Date(document.getElementById("ad-end").value);
  if (!(starts < ends)) {
    setMsg(admsg, "End time must be after start time.", "err");
    return;
  }
  const row = {
    title: document.getElementById("ad-title").value.trim(),
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    enabled: document.getElementById("ad-enabled").checked,
    priority: Number(document.getElementById("ad-priority").value) || 0,
    layout_web: normalizeDirectoryAdDoc(adDocs.web, "web"),
    layout_mod: normalizeDirectoryAdDoc(adDocs.mod, "mod")
  };
  if (!row.title) {
    setMsg(admsg, "Title required.", "err");
    return;
  }
  let resp;
  if (adEditingId) resp = await sb.from("directory_ads").update(row).eq("id", adEditingId);
  else resp = await sb.from("directory_ads").insert(row).select("id").single();
  if (resp.error) {
    setDirectoryAdSaveError(admsg, resp.error.message);
    return;
  }
  if (!adEditingId && resp.data && resp.data.id != null) adEditingId = resp.data.id;
  setMsg(admsg, "Directory ad saved.", "ok");
  await paintDirectoryAds();
}

async function bootDirectoryAdsPage() {
  const session = await getSession();
  if (!session) {
    location.href = loginHref({ next: pageHref("ads") });
    return;
  }
  const me = await getProfile(session.user.id);
  if (me && stillTimedOut(me)) {
    await kickTimedOut();
    return;
  }
  const head = await resolveIsHead(me);
  if (head && me) me.is_head = true;
  if (!canAccessDirectoryAdsPage(me, head)) {
    location.href = pageHref("home");
    return;
  }
  const note = document.getElementById("ads-access-note");
  if (note && !head && !profileIsHead(me)) {
    note.textContent = "Saving may require head admin in the database; the editor is always available here.";
  }
  setupDirectoryAdsUi();
}
