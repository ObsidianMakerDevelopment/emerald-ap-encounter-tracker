
import { emerald_data, emerald_beta_data, getData, setVersion, Versions } from "./data.mjs"

class APTokenTypes {
    static WRITE = 0;
    static COPY = 1;
    static RLE = 2;
    static AND_8 = 3;
    static OR_8 = 4;
    static XOR_8 = 5;
}


let data = {
    rom_addresses: emerald_data.misc_rom_addresses ||
    {
        gArchipelagoOptions: 5895556,
        sNewGamePCItems: 6210444
    }
}

export async function decodeTokenData(arrayBuffer, base_patch_checksum) {
    let version = Versions.unknown;
    if(!base_patch_checksum)
    {
        version = Versions.v067; //archipelago 0.6.7 stable
    }
    else if(base_patch_checksum == "605b89b67018abcea91e693a4dd25be3")
    {
        version = Versions.v068; //archipelago 0.6.8 stable
    }
    else if(base_patch_checksum == "65a5632d20742e9f6a41f91b45048f27")
    {
        version = Versions.v300; //beta 3.0.0
    }

    setVersion(version);
    let rom_data = await getData(version);
    let numberOfToken = new DataView(arrayBuffer).getUint32(0, true);
    let tokens = [];

    let offset = 4; // Start after the number of tokens
    for (let i = 0; i < numberOfToken; i++) {
        let type = new DataView(arrayBuffer).getUint8(offset);
        offset += 1; // Move past the type byte

        let position = new DataView(arrayBuffer).getUint32(offset, true);
        offset += 4; // Move past the position bytes

        if (type == APTokenTypes.XOR_8 || type == APTokenTypes.AND_8 || type == APTokenTypes.OR_8) {
            let oneByteValue = new DataView(arrayBuffer).getUint32(offset);
            offset += 4; // Move past the one int value (Not sure why but it's hardcoded as 4 bytes of value 1)
            if (oneByteValue != 1) {
                console.error("Unexpected value for XOR/AND/OR token. Expected 1, got: " + oneByteValue);
                return tokens;
            }
            let value = new DataView(arrayBuffer).getUint8(offset);
            offset += 1; // Move past the value byte
            tokens.push({ type, position, args: value });
        }
        else if (type == APTokenTypes.COPY || type == APTokenTypes.RLE) {
            let length = new DataView(arrayBuffer).getUint32(offset, true);
            offset += 4; // Move past the length bytes
            let value1 = new DataView(arrayBuffer).getUint32(offset, true);
            offset += 4; // Move past the first value bytes
            let value2 = new DataView(arrayBuffer).getUint32(offset, true);
            offset += 4; // Move past the second value bytes
            tokens.push({ type, position, args: [value1, value2] });
        }
        else if (type == APTokenTypes.WRITE) {
            let length = new DataView(arrayBuffer).getUint32(offset, true);
            offset += 4; // Move past the length bytes
            let valueBytes = new Uint8Array(arrayBuffer.slice(offset, offset + length));
            offset += length; // Move past the value bytes
            tokens.push({ type, position, args: valueBytes });
        }
        else {
            console.error("Unknown token type: " + type);
            return tokens;
        }
    }
    // Build a lookup map of decodable addresses -> metadata to avoid repeated comparisons
    let addressMap = new Map();
    let minAddr = Number.POSITIVE_INFINITY;
    let maxAddr = Number.NEGATIVE_INFINITY;
    function addAddress(addr, meta) {
        addressMap.set(addr, meta);
        if (addr < minAddr) minAddr = addr;
        if (addr > maxAddr) maxAddr = addr;
    }

    // Free Fly location
    addAddress(rom_data.misc_rom_addresses["gArchipelagoOptions"] + 0x20, { kind: "FreeFly" });

    // PC item slots (20 slots, 4 bytes each)
    for (let i = 0; i < 20; i++) {
        let addr = rom_data.misc_rom_addresses["sNewGamePCItems"] + (i * 4);
        addAddress(addr, { kind: "PCItem", index: i });
    }

    // Map-based encounters
    for (let mapKey in rom_data.maps) {
        let map = rom_data.maps[mapKey];

        if ("land_encounters" in map) {
            for (let i = 0; i < map.land_encounters.slots.length; i++) {
                let address = map.land_encounters.address + 2 + (4 * i);
                addAddress(address, { kind: "Encounter", map: mapKey, encounter_type: "Land", slot_index: i });
            }
        }
        if ("water_encounters" in map) {
            for (let i = 0; i < map.water_encounters.slots.length; i++) {
                let address = map.water_encounters.address + 2 + (4 * i);
                addAddress(address, { kind: "Encounter", map: mapKey, encounter_type: "Water", slot_index: i });
            }
        }
        if ("fishing_encounters" in map) {
            const fishingType = {
                0: "Old Rod",
                1: "Old Rod",
                2: "Good Rod",
                3: "Good Rod",
                4: "Good Rod",
                5: "Super Rod",
                6: "Super Rod",
                7: "Super Rod",
                8: "Super Rod",
                9: "Super Rod",
            };
            for (let i = 0; i < map.fishing_encounters.slots.length; i++) {
                let address = map.fishing_encounters.address + 2 + (4 * i);
                addAddress(address, { kind: "Encounter", map: mapKey, encounter_type: fishingType[i], slot_index: i });
            }
        }
        if ("rock_smash_encounters" in map) {
            for (let i = 0; i < map.rock_smash_encounters.slots.length; i++) {
                let address = map.rock_smash_encounters.address + 2 + (4 * i);
                addAddress(address, { kind: "Encounter", map: mapKey, encounter_type: "Rock Smash", slot_index: i });
            }
        }
    }

    const hasAddresses = minAddr <= maxAddr;

    window.addressMap = addressMap;

    // Immediate decodables: single lookup per token
    for (let token of tokens) {
        if (token.type !== APTokenTypes.WRITE) continue;

        // Fast O(1) range check before map lookup
        if (!hasAddresses) continue;
        if (token.position < minAddr || token.position > maxAddr) continue;
        let meta = addressMap.get(token.position);
        if (!meta) continue;

        if (meta.kind === "FreeFly") {
            token.name = "Free Fly Location";
            token.value = token.args[0];
        }
        else if (meta.kind === "PCItem") {
            token.name = "PC Item Slot " + meta.index;
        }
        else if (meta.kind === "Encounter") {
            token.name = `${meta.encounter_type} Encounter Slot ${meta.slot_index} on Map ${meta.map}`;
            token.dexsanity = true;
            token.map = meta.map;
            token.encounter_type = meta.encounter_type;
            token.species = new Uint16Array(token.args.buffer)[0];
        }
    }

    return tokens;
}
