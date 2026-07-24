import * as AP from "archipelago.js";
import * as ZIP from "jszip";
import { decodeTokenData } from "./tokensDecoder.mjs";
import {emerald_data} from "./data.mjs"
// Minimal tracker bootstrap with Archipelago login/config UI
const configStorageKey = "ap_tracker_config";

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


        ap_client.socket.on("disconnected", async () => {
            try {
                await ap_client.login(server, username, "Pokemon Emerald", { password, version: { major: 0, minor: 6, build: 6 }, items: AP.itemsHandlingFlags.all });
            } catch (err) {
                console.error("Re-login failed", err);
            }
        });




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

    applyBtn.addEventListener("click", async () => {
        const server = document.getElementById("configServer").value.trim();
        const username = document.getElementById("configUsername").value.trim();
        const password = document.getElementById("configPassword").value || "";
        if (!server || !username) {
            document.getElementById("configStatus").textContent = "Server and username are required.";
            return;
        }
        saveConfig({ server, username, password });
        try {
            await loginToAP(server, username, password);
            closeConfigMenu();
        } catch (err) {
            // leave menu open for retry
        }
    });

    // Auto-open menu if no saved config
    const saved = loadSavedConfig();
    openConfigMenu();
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
    for(let key in emerald_data.constants)
    {
        if(key.startsWith("SPECIES_")) {
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
                percentages[speciesName] = (counts[species] / total) * 100;
            }
            result[mapKey][encounterType] = percentages;
        }
    }
    return result;
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
            }

            if (optionsCallback) optionsCallback(options);


        } catch (err) {
            console.error("Failed to read ZIP file", err);
        }
    });
    input.click();
}
window.openFilePicker = openFilePicker;