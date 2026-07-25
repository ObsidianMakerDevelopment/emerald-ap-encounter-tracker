import * as AP from "archipelago.js";
import * as ZIP from "jszip";
import { decodeTokenData } from "./tokensDecoder.mjs";
import { emerald_data } from "./data.mjs"
import { tabMapping, imgMapping } from "./tab_mapping.mjs"
import { pokemons } from "./mons.mjs"
import * as logic from "./logic.mjs"

// Minimal tracker bootstrap with Archipelago login/config UI
const configStorageKey = "ap_tracker_config";
const mapsStoragePrefix = "ap_tracker_maps_v1::";

function mapsStorageKeyFor(username) {
    if (!username) return mapsStoragePrefix + "__anonymous__";
    return mapsStoragePrefix + String(username).toLowerCase();
}

function saveMapsToStorage(username, maps) {
    try {
        const key = mapsStorageKeyFor(username);
        localStorage.setItem(key, JSON.stringify(maps));
    } catch (e) {
        console.error('Failed to save maps to storage', e);
    }
}
function loadMapsFromStorage(username) {
    try {
        const key = mapsStorageKeyFor(username);
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.error('Failed to load maps from storage', e);
        return null;
    }
}

function loadSavedConfig() {
    try {
        const raw = localStorage.getItem(configStorageKey);
        if (!raw) return {};
        return JSON.parse(raw);
    } catch (e) {
        console.error("Failed to load saved config", e);
        return {};
    }
}

function saveConfig(cfg) {
    try {
        localStorage.setItem(configStorageKey, JSON.stringify(cfg));
    } catch (e) {
        console.error("Failed to save config", e);
    }
}

async function loginToAP(server, username, password) {
    const statusEl = document.getElementById("configStatus");
    statusEl.textContent = "Connecting...";
    try {
        const ap_client = new AP.Client();
        window.ap_client = ap_client;

        const logData = await ap_client.login(server, username, "Pokemon Emerald", { password, version: { major: 0, minor: 6, build: 3 }, items: AP.itemsHandlingFlags.all });
        ap_client.logData = logData;

        ap_client.socket.on("bounced", (packet) => {
            console.log("Bounce data", packet);
            if (packet.data && packet.data.mapId) {
                //Try changing tab to that map if it exists

                tabMapping[packet.data.mapId] && document.querySelectorAll("#mapsContainer button").forEach(btn => {
                    if (btn.getAttribute("data-map") === tabMapping[packet.data.mapId]) {
                        btn.click();
                    }
                });
            }

        });
        ap_client.socket.on("disconnected", async () => {
            try {
                await ap_client.login(server, username, "Pokemon Emerald", { password, version: { major: 0, minor: 6, build: 6 }, items: AP.itemsHandlingFlags.all });
            } catch (err) {
                console.error("Re-login failed", err);
            }
        });


        // Mark species as completed based on any existing logData items
        try {
            if (logData && logData.items) {
                // logData.items might be an array of item objects or names
                for (const it of logData.items) {
                    const name = it && (it.name || it.item_name || it.item);
                    if (name) markSpeciesCompleted(name.toString());
                }
            }
        } catch (e) { console.warn('Error while marking from logData', e); }

        // Listen for future itemsReceived events and mark species accordingly
        try {
            if (ap_client.items && typeof ap_client.items.on === 'function') {
                ap_client.items.on('itemsReceived', (items) => {
                    try {
                        for (const it of items) {
                            const name = it && (it.name || it.item_name || it.item);
                            if (name) markSpeciesCompleted(name.toString());
                        }
                    } catch (e) { console.error('itemsReceived handler error', e); }
                }, 1);
            }
        } catch (e) { console.warn('Failed to register itemsReceived handler', e); }




        statusEl.textContent = "Connected as " + (logData && logData.playerName ? logData.playerName : username);
        document.title = (logData && logData.playerName ? logData.playerName : username) + " - Tracker";
        return { ap_client, logData };
    } catch (err) {
        console.error("Login failed", err);
        statusEl.textContent = "Connection failed: " + (err && err.message ? err.message : String(err));
        throw err;
    }
}

function openConfigMenu() {
    const back = document.getElementById("configBackdrop");
    const menu = document.getElementById("configMenu");
    back.style.display = "block";
    menu.style.display = "block";
    const saved = loadSavedConfig();
    document.getElementById("configServer").value = saved.server || "";
    document.getElementById("configUsername").value = saved.username || "";
    document.getElementById("configPassword").value = saved.password || "";
}

function closeConfigMenu() {
    const back = document.getElementById("configBackdrop");
    const menu = document.getElementById("configMenu");
    back.style.display = "none";
    menu.style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("configToggle");
    const back = document.getElementById("configBackdrop");
    const applyBtn = document.getElementById("applyConfigBtn");
    const cancelBtn = document.getElementById("cancelConfigBtn");

    toggle.addEventListener("click", openConfigMenu);
    back.addEventListener("click", closeConfigMenu);
    cancelBtn.addEventListener("click", closeConfigMenu);
    const loadPatchBtn = document.getElementById("loadPatchBtn");
    if (loadPatchBtn) loadPatchBtn.addEventListener("click", () => {
        try {
            openFilePicker((options) => {
                document.getElementById("configUsername").value = options.slot.player_name //playerName
                if (!document.getElementById("configServer").value)
                    document.getElementById("configServer").value = options.slot.server //server

            });
        } catch (e) { console.error(e); }
    });
    // Disable Apply until a patch with maps is loaded
    if (applyBtn) applyBtn.disabled = true;

    applyBtn.addEventListener("click", async () => {
        const server = document.getElementById("configServer").value.trim();
        const username = document.getElementById("configUsername").value.trim();
        const password = document.getElementById("configPassword").value || "";
        if (!server || !username) {
            document.getElementById("configStatus").textContent = "Server and username are required.";
            return;
        }
        // If there's cached maps for this username, load them; otherwise clear window.maps
        try {
            const cached = loadMapsFromStorage(username);
            if (cached) window.maps = cached;
            else window.maps = null;
        } catch (e) { window.maps = null; }
        saveConfig({ server, username, password });
        try {
            await loginToAP(server, username, password);
            closeConfigMenu();
            // After successful login, generate map tabs if maps are present
            if (window.maps && Object.keys(window.maps).length > 0) {
                try { generateMapTabs(); } catch (e) { console.error('Failed to generate map tabs', e); }
            } else {
                document.getElementById('configStatus').textContent = 'No maps loaded; please load a patch first.';
            }
        } catch (err) {
            // leave menu open for retry
        }
    });

    // Auto-open menu if no saved config
    const saved = loadSavedConfig();
    openConfigMenu();
    // Try to load cached maps for saved username so reload is fast.
    try {
        if (saved && saved.username) {
            const cached = loadMapsFromStorage(saved.username);
            if (cached) {
                window.maps = cached;
                const applyBtnEl = document.getElementById('applyConfigBtn');
                if (applyBtnEl) applyBtnEl.disabled = false;
                try { generateMapTabs(); } catch (e) { console.error('generateMapTabs failed', e); }
            }
        }
    } catch (e) { console.error('Failed to load cached maps on startup', e); }
    // Load locally saved caught state and start polling for caught state array (window.caught)
    try { loadCaughtFromStorage(); } catch (e) { console.error('loadCaughtFromStorage failed', e); }
    try { startCaughtPolling(); } catch (e) { console.error('startCaughtPolling failed', e); }
});

function extractPokemonPerMap(tokens) {
    let dexsanityData = tokens.filter(t => t.dexsanity).map(t => ({
        map: t.map,
        encounter_type: t.encounter_type,
        species: t.species
    }));
    let result = {};
    for (let entry of dexsanityData) {
        if (!result[entry.map]) result[entry.map] = {};
        if (!result[entry.map][entry.encounter_type]) result[entry.map][entry.encounter_type] = [];
        result[entry.map][entry.encounter_type].push(entry.species);
    }
    let speciesNameMap = {};
    //Build species name map:
    for (let key in emerald_data.constants) {
        if (key.startsWith("SPECIES_")) {
            const speciesId = emerald_data.constants[key];
            const speciesName = key.replace("SPECIES_", "");
            speciesNameMap[speciesId] = speciesName;
        }
    }
    //Phase 2, convert duplicate to percentages:
    for (let mapKey in result) {
        let mapData = result[mapKey];
        for (let encounterType in mapData) {
            let speciesList = mapData[encounterType];
            let total = speciesList.length;
            let counts = {};
            for (let species of speciesList) {
                if (!counts[species]) counts[species] = 0;
                counts[species]++;
            }
            // Convert to percentages, and to pokemon names
            let percentages = {};
            for (let species in counts) {
                const speciesName = speciesNameMap[species] || species;
                const id = pokemons.find(x => x.name.toUpperCase() === speciesName.toUpperCase())?.number || "-"+species;
                percentages[speciesName] = { probability: (counts[species] / total) * 100, id: id, name: speciesName };
            }
            result[mapKey][encounterType] = percentages;
        }
    }
    return result;
}

const CAUGHT_STORAGE_KEY = 'ap_tracker_caught_v1';

function saveCaughtToStorage() {
    try {
        if (!Array.isArray(window.caught)) return;
        localStorage.setItem(CAUGHT_STORAGE_KEY, JSON.stringify(window.caught));
    } catch (e) {
        console.error('Failed to save caught to storage', e);
    }
}
setInterval(saveCaughtToStorage, 5000); // Save every 5 seconds
window.saveCaughtToStorage = saveCaughtToStorage;
window.loadCaughtFromStorage = loadCaughtFromStorage;
window.clearCaughtStorage = clearCaughtStorage;

function loadCaughtFromStorage() {
    try {
        const raw = localStorage.getItem(CAUGHT_STORAGE_KEY);
        if (!raw) return;
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
            window.caught = arr;
            // ensure length
            window.maxPokemon = window.maxPokemon || 386;
            if (window.caught.length < window.maxPokemon + 1) {
                const newArr = new Array(window.maxPokemon + 1).fill(false);
                for (let i = 0; i < window.caught.length; i++) newArr[i] = !!window.caught[i];
                window.caught = newArr;
            }
        }
        for (let i = 1; i < window.caught.length; i++) {
            if (window.caught && window.caught[i])
                revealSpeciesById(i);
        }
    } catch (e) {
        console.warn('Failed to load caught from storage', e);
    }
}

function clearCaughtStorage() {
    try {
        localStorage.removeItem(CAUGHT_STORAGE_KEY);
        window.caught = new Array((window.maxPokemon || 386) + 1).fill(false);
    } catch (e) { console.error('Failed to clear caught storage', e); }
}

function applyLocalCaughtToUI() {
    try {
        if (!Array.isArray(window.caught)) return;
        for (let i = 1; i < window.caught.length; i++) {
            if (window.caught[i]) revealSpeciesById(i);
        }
    } catch (e) { console.error('applyLocalCaughtToUI error', e); }
}

function setCaughtStateForCard(card, state) {
    try {
        // if the card has a numeric species id, apply across all slots of that species
        const sid = card && card._speciesId;
        const n = parseInt(sid, 10);
        if (!Number.isNaN(n) && n > 0) {
            setCaughtStateForSpecies(n, !!state);
            return;
        }
        // otherwise fall back to toggling this single card
        if (state) {
            if (!card.classList.contains('completed')) card.classList.add('completed');
            updateCardCompletedStyle(card, true);
        } else {
            if (card.classList.contains('completed')) card.classList.remove('completed');
            updateCardCompletedStyle(card, false);
        }
        try { refreshAllTabCircles(); } catch (e) {}
    } catch (e) { console.error('setCaughtStateForCard error', e); }
}

function setCaughtStateForSpecies(speciesId, state) {
    try {
        const key = String(speciesId).toUpperCase();
        window.speciesElements = window.speciesElements || {};
        const elements = window.speciesElements[key] || [];
        for (const el of elements) {
            if (state) {
                if (!el.classList.contains('completed')) el.classList.add('completed');
                updateCardCompletedStyle(el, true);
            } else {
                if (el.classList.contains('completed')) el.classList.remove('completed');
                updateCardCompletedStyle(el, false);
            }
        }
        // persist numeric species id
        const n = parseInt(speciesId, 10);
        if (!Number.isNaN(n) && n > 0) {
            window.caught = window.caught || new Array((window.maxPokemon || 386) + 1).fill(false);
            window.caught[n] = !!state;
            saveCaughtToStorage();
        }
        try { refreshAllTabCircles(); } catch (e) {}
    } catch (e) { console.error('setCaughtStateForSpecies error', e); }
}

// Turn a raw species name like 'NIDORAN_M' or 'MR_MIME' into 'Nidoran M' or 'Mr Mime'
function formatDisplayName(raw) {
    if (raw === undefined || raw === null) return '';
    const s = String(raw);
    // if it's numeric, just return as-is
    if (/^\d+$/.test(s)) return s;
    // replace underscores with spaces, lowercase then title-case each word
    return s.replace(/_/g, ' ').toLowerCase().split(' ').map(w => {
        if (!w) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
    }).join(' ');
}

function openFilePicker(optionsCallback) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".apemerald";
    input.addEventListener("change", async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const zip = await ZIP.loadAsync(file);
            const files = Object.keys(zip.files);
            console.log("ZIP contents:", files);
            // Handle the ZIP contents as needed
            let options = {};
            if (zip.files["archipelago.json"])
                zip.files["archipelago.json"].async("string").then((content) => {
                    const config = JSON.parse(content);
                    console.log("Loaded config:", config);
                    options.slot = config;
                }).catch((err) => {
                    console.error("Failed to read archipelago.json from ZIP", err);
                });
            if (zip.files["token_data.bin"]) {
                let content = await zip.files["token_data.bin"].async("arraybuffer")
                console.log("Loaded token_data.bin:", content);
                options.tokenData = content;
                options.tokens = await decodeTokenData(content);

                // Handle the binary data as needed
                //console.log("Decoded tokens:", options.tokens);

                window.maps = extractPokemonPerMap(options.tokens);

                window.freeflyid = options.tokens.find(t => t.name === "Free Fly Location")?.value || null;
                // enable Apply button when maps are present
                if (window.maps && Object.keys(window.maps).length > 0) {
                    const applyBtn = document.getElementById('applyConfigBtn');
                    if (applyBtn) applyBtn.disabled = false;
                    const status = document.getElementById('configStatus');
                    if (status) status.textContent = 'Patch applied — Apply & Connect is enabled.';
                    // Persist maps for the current player username so reload is fast.
                    try {
                        const cfgUser = (options && options.slot && options.slot.player_name) || (document.getElementById('configUsername') && document.getElementById('configUsername').value) || (loadSavedConfig().username) || '';
                        if (cfgUser) saveMapsToStorage(cfgUser, window.maps);
                    } catch (e) { console.error('Failed to persist maps to storage', e); }
                    // generate tabs now that patch applied
                    try { generateMapTabs(); } catch (e) { console.error('generateMapTabs failed', e); }
                }
            }

            if (optionsCallback) optionsCallback(options);


        } catch (err) {
            console.error("Failed to read ZIP file", err);
        }
    });
    input.click();
}
window.openFilePicker = openFilePicker;

// Create tabs and UI for maps found in window.maps
function generateMapTabs() {
    const maps = window.maps || {};
    const container = document.getElementById('mapsContainer');
    if (!container) return;
    container.innerHTML = '';
    container.style.display = 'block';

    // sync status badge
    const statusBadge = document.createElement('div');
    statusBadge.id = 'syncStatusBadge';
    statusBadge.className = 'status-badge';
    statusBadge.textContent = 'Sync: Unknown';
    container.appendChild(statusBadge);

    // clear stored caught button
    const clearBtn = document.createElement('button');
    clearBtn.id = 'clearCaughtBtn';
    clearBtn.className = 'clear-btn';
    clearBtn.textContent = 'Clear Local Caught';
    clearBtn.addEventListener('click', () => {
        if (!confirm('Clear all locally remembered caught Pokémon?')) return;
        clearCaughtStorage();
        // reset UI
        if (window.speciesElements) {
            for (const key in window.speciesElements) {
                for (const el of window.speciesElements[key]) {
                    el.classList.remove('completed');
                    updateCardCompletedStyle(el, false);
                }
            }
        }
        const badge = document.getElementById('syncStatusBadge');
        if (badge) {
            badge.textContent = 'Sync: Cleared Local';
            badge.style.background = '#6c757d';
        }
    });
    container.appendChild(clearBtn);

    const tabsBar = document.createElement('div');
    tabsBar.className = 'tabs-bar';
    container.appendChild(tabsBar);
    // Convert vertical wheel scrolling into horizontal scroll on the tabs bar
    // while there is overflow in that direction. Use a non-passive listener
    // so we can call preventDefault() and stop page scroll while the
    // tabs bar can consume the wheel.
    try {
        tabsBar.addEventListener('wheel', (e) => {
            // prefer deltaY (vertical scroll); if zero, fall back to deltaX
            const delta = e.deltaY || e.deltaX;
            if (!delta) return;
            // invert direction and double the speed per user request
            const scrollAmount = -delta * 2;
            const direction = scrollAmount > 0 ? 1 : -1; // 1 -> scroll right, -1 -> left
            const maxScrollRight = tabsBar.scrollWidth - tabsBar.clientWidth - tabsBar.scrollLeft;
            const maxScrollLeft = tabsBar.scrollLeft;
            // If there's no overflow in the wheel direction, allow page scroll
            if ((direction > 0 && maxScrollRight <= 0) || (direction < 0 && maxScrollLeft <= 0)) {
                return; // let the event bubble to page
            }
            // Consume the wheel — scroll horizontally by the computed amount
            e.preventDefault();
            // Use smooth behavior for nicer feel
            try {
                tabsBar.scrollBy({ left: scrollAmount, behavior: 'smooth' });
            } catch (err) {
                // fallback if browser doesn't support options object
                tabsBar.scrollLeft += scrollAmount;
            }
        }, { passive: false });
    } catch (e) { /* ignore if addEventListener options unsupported */ }

    const contentArea = document.createElement('div');
    contentArea.className = 'maps-content';
    container.appendChild(contentArea);

    let first = true;
    let firstTab = null;
    for (const mapName of Object.keys(maps)) {
        const tabBtn = document.createElement('button');
        tabBtn.className = 'tab-btn';
        tabBtn.setAttribute('data-map', mapName);

        // left: small circle that can be colored based on content
        const circle = document.createElement('div');
        circle.className = 'tab-circle';
        circle.dataset.map = mapName;

        // label span (keeps previous behavior via textContent)
        const label = document.createElement('span');
        label.className = 'tab-label';
        label.textContent = formatDisplayName(mapName.substring(4)); // nice capitalization

        tabBtn.appendChild(circle);
        tabBtn.appendChild(label);
        tabsBar.appendChild(tabBtn);

        const mapDiv = document.createElement('div');
        mapDiv.className = 'map-div';
        mapDiv.dataset.map = mapName;
        mapDiv.style.display = 'none';
        mapDiv.style.width = '100%';
        mapDiv.style.minHeight = 'calc(100vh - 60px)';
        mapDiv.style.boxSizing = 'border-box';

        // left: image half
        const left = document.createElement('div');
        left.style.width = '50%';
        left.style.float = 'left';
        left.style.boxSizing = 'border-box';
        left.style.padding = '8px';

        const img = document.createElement('img');
        img.style.width = '100%';
        img.style.height = 'auto';
        img.alt = mapName;
        const imgSrc = (imgMapping && imgMapping[mapName]) || '';
        if (imgSrc) img.src = imgSrc;
        else img.style.background = '#0b2633';
        left.appendChild(img);
        mapDiv.appendChild(left);

        // right: groups
        const right = document.createElement('div');
        right.style.width = '50%';
        right.style.float = 'right';
        right.style.boxSizing = 'border-box';
        right.style.padding = '8px';
        right.style.display = 'flex';
        right.style.flexDirection = 'column';
        right.style.gap = '10px';

        // map title above encounter type sections (same as tab text)
        try {
            const mapTitle = document.createElement('div');
            mapTitle.style.fontSize = '1.4rem';
            mapTitle.style.fontWeight = '800';
            mapTitle.style.marginBottom = '6px';
            mapTitle.textContent = tabBtn.textContent || formatDisplayName(mapName.substring(4));
            right.appendChild(mapTitle);
        } catch (e) { /* ignore */ }

        const mapData = maps[mapName];
        for (const groupName of Object.keys(mapData)) {
            const groupBox = document.createElement('div');
            groupBox.style.border = '1px solid rgba(255,255,255,0.06)';
            groupBox.style.borderRadius = '8px';
            groupBox.style.padding = '8px';
            groupBox.style.background = 'rgba(255,255,255,0.02)';

            const header = document.createElement('div');
            header.className = 'group-header';
            header.dataset.group = groupName;
            header.style.display = 'flex';
            header.style.alignItems = 'center';
            header.style.gap = '8px';
            const groupCircle = document.createElement('span');
            groupCircle.className = 'group-circle';
            groupCircle.dataset.group = groupName;
            header.appendChild(groupCircle);
            const headerText = document.createElement('div');
            headerText.textContent = groupName;
            headerText.style.fontWeight = '700';
            headerText.style.marginBottom = '6px';
            header.appendChild(headerText);
            groupBox.appendChild(header);

            const speciesWrap = document.createElement('div');
            speciesWrap.style.display = 'flex';
            speciesWrap.style.flexWrap = 'wrap';
            speciesWrap.style.gap = '8px';

            const speciesObj = mapData[groupName] || {};
            for (const speciesName of Object.keys(speciesObj)) {
                const spec = speciesObj[speciesName] || {};
                const pct = spec.probability ?? spec;
                let id = spec.id ?? speciesName;
                const rawDisplayName = spec.name || speciesName;
                const displayName = formatDisplayName(rawDisplayName);

                const card = document.createElement('div');
                card.style.width = '84px';
                card.style.textAlign = 'center';
                card.dataset.species = displayName;

                //Map internal id to national dex ids
                //TODO:
                id = pokemons.find(x => x.name.toUpperCase() === speciesName.toUpperCase())?.number || id;
                window.pokemons = pokemons;
                card.dataset.speciesId = id;

                // click to toggle completed state
                card.style.cursor = 'pointer';
                card.addEventListener('click', () => {
                    // toggle manual caught state and persist
                    const willBe = !card.classList.contains('completed');
                    setCaughtStateForCard(card, willBe);
                });

                const pimg = document.createElement('img');
                pimg.style.width = '64px';
                pimg.style.height = '64px';
                pimg.style.objectFit = 'contain';
                // start with species 0 placeholder and hide the real identity
                const placeholderUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png`;
                const realUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${encodeURIComponent(id)}.png`;

                pimg.src = placeholderUrl;
                pimg.alt = '???';
                // store real values for later reveal
                card._realImg = realUrl;
                card._placeholderImg = placeholderUrl;
                card._realName = displayName;
                card._rawName = rawDisplayName;
                card._speciesId = id;
                card.appendChild(pimg);

                const lbl = document.createElement('div');
                lbl.style.fontSize = '0.8rem';
                lbl.style.marginTop = '4px';
                // initial hidden label
                lbl.textContent = `???`;
                // store probability text for reveal
                card._probText = `${Number(pct).toFixed(1)}%`;
                card.appendChild(lbl);

                // attach references for update
                card._imgEl = pimg;
                card._lblEl = lbl;

                speciesWrap.appendChild(card);
                // ensure initial hidden styling
                updateCardCompletedStyle(card, false);
                // track element for programmatic updates by id and name
                window.speciesElements = window.speciesElements || {};
                const idKey = String(id).toUpperCase();
                const nameKey = String(displayName).toUpperCase();
                if (!window.speciesElements[idKey]) window.speciesElements[idKey] = [];
                window.speciesElements[idKey].push(card);
                if (!window.speciesElements[nameKey]) window.speciesElements[nameKey] = [];
                window.speciesElements[nameKey].push(card);
            }

            groupBox.appendChild(speciesWrap);
            right.appendChild(groupBox);
        }

        mapDiv.appendChild(right);
        contentArea.appendChild(mapDiv);

        tabBtn.doClick = () => {
            // mark selected
            const allBtns = tabsBar.querySelectorAll('.tab-btn');
            for (const b of allBtns) b.classList.remove('selected');
            tabBtn.classList.add('selected');

            // scroll the clicked tab to the far left of the tabs bar if possible
            try {
                const barRect = tabsBar.getBoundingClientRect();
                const tabRect = tabBtn.getBoundingClientRect();
                // compute desired scroll so the tab's left aligns with the bar's left
                let desired = tabsBar.scrollLeft + (tabRect.left - barRect.left);
                // clamp to valid scroll range
                const max = Math.max(0, tabsBar.scrollWidth - tabsBar.clientWidth);
                if (desired < 0) desired = 0;
                if (desired > max) desired = max;
                try { tabsBar.scrollTo({ left: desired, behavior: 'smooth' }); } catch (e) { tabsBar.scrollLeft = desired; }
            } catch (e) { /* ignore scrolling errors */ }

            // set hash so reload restores this tab
            try {
                const hash = encodeURIComponent(mapName);
                if (history && typeof history.replaceState === 'function') history.replaceState(null, '', '#' + hash);
                else location.hash = hash;
            } catch (e) { try { location.hash = encodeURIComponent(mapName); } catch (ee) {} }

            // hide other mapDivs
            for (const ch of contentArea.children) ch.style.display = 'none';
            mapDiv.style.display = 'block';
        }
        tabBtn.addEventListener('click', () => {
            tabBtn.doClick();
        });

        if (first) {
            first = false;
            firstTab = tabBtn;
        }
    }
    // apply any locally stored caught state so pre-connection reveals persist
    try { applyLocalCaughtToUI(); } catch (e) { console.error('applyLocalCaughtToUI failed', e); }

    // choose initial tab: prefer hash, otherwise first tab
    try {
        const hash = (location.hash || '').replace(/^#/, '');
        const decoded = hash ? decodeURIComponent(hash) : null;
        if (decoded) {
            const target = tabsBar.querySelector(`.tab-btn[data-map="${decoded}"]`);
            if (target) target.click();
            else if (firstTab) firstTab.click();
        } else if (firstTab) {
            firstTab.click();
        }
    } catch (e) {
        if (firstTab) firstTab.click();
    }

    // refresh tab circles to reflect caught state
    try { refreshAllTabCircles(); } catch (e) { /* ignore */ }
}

function updateCardCompletedStyle(card, completed) {
    // Reveal or hide the real sprite and name depending on caught state
    try {
        if (completed) {
            if (card._imgEl && card._realImg) card._imgEl.src = card._realImg;
            if (card._lblEl) card._lblEl.textContent = `${card._realName}${card._probText ? ' — ' + card._probText : ''}`;
            card.style.filter = '';
            card.style.opacity = '1';
            card.style.border = '2px solid #2ea44f';
        } else {
            if (card._imgEl && card._placeholderImg) card._imgEl.src = card._placeholderImg;
            if (card._lblEl) card._lblEl.textContent = '???';
            card.style.filter = 'grayscale(100%)';
            card.style.opacity = '0.8';
            card.style.border = '';
        }
    } catch (e) {
        console.error('updateCardCompletedStyle error', e);
    }
}

// Determine a state for a map's tab-circle based on encounters and reachability.
// Returns: 'gray' (all caught), 'red' (none catchable, some missing),
// 'green' (all missing are catchable), 'yellow' (mix of catchable/not).
function colorStateForMap(mapName) {
    try {
        const maps = window.maps || {};
        const mapData = maps[mapName];
        if (!mapData) return 'gray';
        const caught = window.caught || [];

        const allowedGroups = {
            'Land': 'Land',
            'Water': 'Water',
            'Old Rod': 'OldRod',
            'Good Rod': 'GoodRod',
            'Super Rod': 'SuperRod',
            'Rock Smash': 'RockSmash'
        };

        function groupIsAccessible(mapNameLocal, groupName) {
            try {
                const method = allowedGroups[groupName];
                if (!method) return false;
                const rl = (logic && logic.roomLogic) ? logic.roomLogic[mapNameLocal] : null;
                if (!rl) return false;
                if (typeof rl[method] === 'function') {
                    try { return !!rl[method](); } catch (e) { return false; }
                }
                return false;
            } catch (e) { return false; }
        }

        let anySpecies = false;
        let anyUncaught = false;
        let anyUncaughtCatchable = false;
        let anyUncaughtUncatchable = false;

        for (const groupNameRaw of Object.keys(mapData)) {
            if (!Object.prototype.hasOwnProperty.call(allowedGroups, groupNameRaw)) continue;
            const speciesObj = mapData[groupNameRaw] || {};
            const accessible = groupIsAccessible(mapName, groupNameRaw);
            for (const speciesName of Object.keys(speciesObj)) {
                anySpecies = true;
                const spec = speciesObj[speciesName] || {};
                const id = spec.id ?? speciesName;
                let isCaught = false;
                const n = parseInt(id, 10);
                if (!Number.isNaN(n) && n > 0) {
                    isCaught = !!caught[n];
                } else {
                    const keyName = String(spec.name || speciesName).toUpperCase();
                    const keyId = String(id).toUpperCase();
                    const elsByName = (window.speciesElements && window.speciesElements[keyName]) || [];
                    const elsById = (window.speciesElements && window.speciesElements[keyId]) || [];
                    const combined = elsByName.concat(elsById);
                    if (!combined || combined.length === 0) {
                        isCaught = false;
                    } else {
                        for (const el of combined) {
                            if (el.classList && el.classList.contains('completed')) { isCaught = true; break; }
                        }
                    }
                }
                if (!isCaught) {
                    anyUncaught = true;
                    if (accessible) anyUncaughtCatchable = true;
                    else anyUncaughtUncatchable = true;
                }
            }
        }

        if (!anySpecies) return 'gray';
        if (!anyUncaught) return 'gray';
        if (!anyUncaughtCatchable && anyUncaughtUncatchable) return 'red';
        if (anyUncaughtCatchable && !anyUncaughtUncatchable) return 'green';
        return 'yellow';
    } catch (e) {
        console.error('colorStateForMap error', e);
        return 'gray';
    }
}

// Refresh the color/state of all tab circles based on caught progress
function refreshAllTabCircles() {
    try {
        const tabs = document.querySelectorAll('#mapsContainer .tab-btn');
        if (!tabs || tabs.length === 0) return;
        for (const btn of tabs) {
            const mapName = btn.getAttribute('data-map');
            const circle = btn.querySelector('.tab-circle');
            if (!circle) continue;
            const state = colorStateForMap(mapName);
            circle.classList.remove('state-gray', 'state-red', 'state-yellow', 'state-green');
            circle.classList.add('state-' + state);
            // fallback inline color for older styling
            const colorMap = { gray: '#6c757d', red: '#b02a37', yellow: '#f0ad4e', green: '#2ea44f' };
            circle.style.background = colorMap[state] || '#777';
        }
    } catch (e) { console.error('refreshAllTabCircles error', e); }
    try { refreshGroupCircles(); } catch (e) {}
}

// Compute color/state for a specific group in a map
function colorStateForGroup(mapName, groupName) {
    try {
        const maps = window.maps || {};
        const mapData = maps[mapName];
        if (!mapData) return 'gray';
        const groupObj = mapData[groupName] || {};
        const caught = window.caught || [];
        const allowedGroups = {
            'Land': 'Land',
            'Water': 'Water',
            'Old Rod': 'OldRod',
            'Good Rod': 'GoodRod',
            'Super Rod': 'SuperRod',
            'Rock Smash': 'RockSmash'
        };
        const method = allowedGroups[groupName];
        const rl = (logic && logic.roomLogic) ? logic.roomLogic[mapName] : null;
        const accessible = rl && method && typeof rl[method] === 'function' ? !!rl[method]() : false;

        let anySpecies = false;
        let anyUncaught = false;
        let anyUncaughtCatchable = false;
        let anyUncaughtUncatchable = false;

        for (const speciesName of Object.keys(groupObj)) {
            anySpecies = true;
            const spec = groupObj[speciesName] || {};
            const id = spec.id ?? speciesName;
            let isCaught = false;
            const n = parseInt(id, 10);
            if (!Number.isNaN(n) && n > 0) {
                isCaught = !!caught[n];
            } else {
                const keyName = String(spec.name || speciesName).toUpperCase();
                const keyId = String(id).toUpperCase();
                const elsByName = (window.speciesElements && window.speciesElements[keyName]) || [];
                const elsById = (window.speciesElements && window.speciesElements[keyId]) || [];
                const combined = elsByName.concat(elsById);
                if (!combined || combined.length === 0) isCaught = false;
                else {
                    for (const el of combined) { if (el.classList && el.classList.contains('completed')) { isCaught = true; break; } }
                }
            }
            if (!isCaught) {
                anyUncaught = true;
                if (accessible) anyUncaughtCatchable = true; else anyUncaughtUncatchable = true;
            }
        }
        if (!anySpecies) return 'gray';
        if (!anyUncaught) return 'gray';
        if (!anyUncaughtCatchable && anyUncaughtUncatchable) return 'red';
        if (anyUncaughtCatchable && !anyUncaughtUncatchable) return 'green';
        return 'yellow';
    } catch (e) { console.error('colorStateForGroup error', e); return 'gray'; }
}

function refreshGroupCircles() {
    try {
        const mapDivs = document.querySelectorAll('#mapsContainer .map-div');
        if (!mapDivs) return;
        for (const mdiv of mapDivs) {
            const mapName = mdiv.dataset.map;
            const headers = mdiv.querySelectorAll('.group-header');
            for (const h of headers) {
                const g = h.dataset.group;
                const circle = h.querySelector('.group-circle');
                if (!circle) continue;
                const state = colorStateForGroup(mapName, g);
                circle.classList.remove('state-gray','state-red','state-yellow','state-green');
                circle.classList.add('state-' + state);
                const colorMap = { gray: '#6c757d', red: '#b02a37', yellow: '#f0ad4e', green: '#2ea44f' };
                circle.style.background = colorMap[state] || '#777';
            }
        }
    } catch (e) { console.error('refreshGroupCircles error', e); }
}

function markSpeciesCompleted(speciesName) {
    if (!speciesName) return;
    // speciesName may be like 'POTION' or 'NIDOQUEEN' - try uppercase
    const key = String(speciesName).toUpperCase();
    const elements = window.speciesElements && window.speciesElements[key];
    if (elements && elements.length) {
        for (const el of elements) {
            if (!el.classList.contains('completed')) {
                setCaughtStateForCard(el, true);
            }
        }
        return;
    }
    // try best-effort: search through all speciesElements keys for substring match
    if (window.speciesElements) {
        for (const nameKey in window.speciesElements) {
            if (nameKey === key) continue;
            if (nameKey.includes(key) || key.includes(nameKey)) {
                for (const el of window.speciesElements[nameKey]) {
                    if (!el.classList.contains('completed')) {
                        setCaughtStateForCard(el, true);
                    }
                }
            }
        }
    }
}

// Reveal all cards for a given numeric species id (1..386)
function revealSpeciesById(speciesId) {
    if (!speciesId) return;
    const key = String(speciesId).toUpperCase();
    const elements = window.speciesElements && window.speciesElements[key];
    if (elements && elements.length) {
        for (const el of elements) {
            if (!el.classList.contains('completed')) {
                el.classList.add('completed');
                updateCardCompletedStyle(el, true);
            }
        }
    }
    try { refreshAllTabCircles(); } catch (e) {}
}

// Start a polling loop that checks window.caught (length 386) every second
function startCaughtPolling() {
    if (window._caughtPollIntervalId) return; // already running
    window.maxPokemon = 386;
    if (!Array.isArray(window.caught) || window.caught.length < window.maxPokemon + 1) {
        // create a 1-based array of length 387 (index 1..386)
        window.caught = new Array(window.maxPokemon + 1).fill(false);
    }
    function isConnected() {
        try {
            if (window.ap_client) {
                // common socket flag
                if (window.ap_client.socket && typeof window.ap_client.socket.connected !== 'undefined') return !!window.ap_client.socket.connected;
                // common client flag
                if (typeof window.ap_client.connected !== 'undefined') return !!window.ap_client.connected;
                // some clients implement isConnected()
                if (typeof window.ap_client.isConnected === 'function') return !!window.ap_client.isConnected();
            }
        } catch (e) {
            console.warn('isConnected check failed', e);
        }
        return false;
    }

    // set initial badge state immediately
    try {
        const badgeInit = document.getElementById('syncStatusBadge');
        const connectedInit = isConnected();
        if (badgeInit) {
            if (connectedInit) {
                badgeInit.textContent = 'Sync: Connected';
                badgeInit.style.background = '#2ea44f';
            } else {
                badgeInit.textContent = 'Sync: Disconnected (manual only)';
                badgeInit.style.background = '#b02a37';
            }
        }
    } catch (e) { /* ignore */ }

    window._caughtPollIntervalId = setInterval(() => {
        try {
            const connected = isConnected();
            const badge = document.getElementById('syncStatusBadge');
            if (badge) {
                if (connected) {
                    badge.textContent = 'Sync: Connected';
                    badge.style.background = '#2ea44f';
                } else {
                    badge.textContent = 'Sync: Disconnected (manual only)';
                    badge.style.background = '#b02a37';
                }
            }

            //ap_client.room.checkedLocations Pokedex starts at 3870001 for species 1 (Bulbasaur) and goes to 3870386 for species 386 (Deoxys)
            if (window.ap_client && window.ap_client.room && Array.isArray(window.ap_client.room.checkedLocations)) {
                for (let i = 1; i <= window.maxPokemon; i++) {
                    const locId = 3870000 + i;
                    const isCaught = window.ap_client.room.checkedLocations.includes(locId);
                    if (window.caught[i] !== isCaught) {
                        window.caught[i] = isCaught;
                        if (isCaught) {
                            revealSpeciesById(i);
                        }
                    }
                }
            }
            if (!connected) return; // only sync revealed state from array when connected
            for (let i = 1; i <= window.maxPokemon; i++) {
                if (window.caught[i]) {
                    revealSpeciesById(i);
                }
            }
        } catch (e) {
            console.error('caught poll error', e);
        }
    }, 1000);
}
