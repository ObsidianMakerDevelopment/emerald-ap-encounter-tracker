
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

export function decodeTokenData(arrayBuffer, base_patch_checksum) {
    let version = Versions.v067;
    if(!base_patch_checksum)
    {
        version = Versions.v067; //archipelago 0.6.7 stable
    }
    else if(base_patch_checksum == "65a5632d20742e9f6a41f91b45048f27")
    {
        version = Versions.v300; //beta 3.0.0
    }
    setVersion(version);
    let rom_data = getData(version);
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
    //Immediate decodables:
    for (let token of tokens) {
        if (token.type == APTokenTypes.WRITE) {
            if (token.position == rom_data.misc_rom_addresses["gArchipelagoOptions"] + 0x20) {
                token.name = "Free Fly Location";
                token.value = token.args[0];
            }
            //   address = data.rom_addresses["sNewGamePCItems"] + (i * 4) (Max 20 slots)
            else if (token.position >= rom_data.misc_rom_addresses["sNewGamePCItems"] && token.position < rom_data.misc_rom_addresses["sNewGamePCItems"] + 20 * 4) {
                token.name = "PC Item Slot " + ((token.position - rom_data.misc_rom_addresses["sNewGamePCItems"]) / 4);
            }

            for (let mapKey in rom_data.maps) {
                let map = rom_data.maps[mapKey];

                if ("land_encounters" in map) {
                    for (let i = 0; i < map.land_encounters.slots.length; i++) {
                        let address = map.land_encounters.address + 2 + (4 * i);``
                        if (token.position == address) {
                            token.name = "Land Encounter Slot " + i + " on Map " + mapKey;
                            token.dexsanity = true;
                            token.map = mapKey;
                            token.encounter_type = "Land";
                            token.species = new Uint16Array(token.args.buffer)[0];
                            if (mapKey == "MAP_MT_PYRE_SUMMIT") { console.log("Map Mt Pyre Summit", mapKey, token, token.args) }
                        }

                    }
                }
                if ("water_encounters" in map) {
                    for (let i = 0; i < map.water_encounters.slots.length; i++) {
                        let address = map.water_encounters.address + 2 + (4 * i);
                        if (token.position == address) {
                            token.name = "Water Encounter Slot " + i + " on Map " + mapKey;
                            token.dexsanity = true;
                            token.map = mapKey;
                            token.encounter_type = "Water";
                            token.species = new Uint16Array(token.args.buffer)[0];
                        }
                    }
                }
                if ("fishing_encounters" in map) {
                    for (let i = 0; i < map.fishing_encounters.slots.length; i++) {
                        let address = map.fishing_encounters.address + 2 + (4 * i);
                        if (token.position == address) {
                            token.name = "Fishing Encounter Slot " + i + " on Map " + mapKey;
                            token.dexsanity = true;
                            token.map = mapKey;
                            token.encounter_type = {
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
                            }[i];
                            token.species = new Uint16Array(token.args.buffer)[0];
                        }
                    }
                }
                if ("rock_smash_encounters" in map) {
                    for (let i = 0; i < map.rock_smash_encounters.slots.length; i++) {
                        let address = map.rock_smash_encounters.address + 2 + (4 * i);
                        if (token.position == address) {
                            token.name = "Rock Smash Encounter Slot " + i + " on Map " + mapKey;
                            token.dexsanity = true;
                            token.map = mapKey;
                            token.encounter_type = "Rock Smash";
                            token.species = new Uint16Array(token.args.buffer)[0];
                        }
                    }
                }
            }
        }
    }

    return tokens;
}

/*data = bytearray()
        data.extend(len(self._tokens).to_bytes(4, "little"))
        for token_type, offset, args in self._tokens:
            data.append(token_type)
            data.extend(offset.to_bytes(4, "little"))
            if token_type in [APTokenTypes.AND_8, APTokenTypes.OR_8, APTokenTypes.XOR_8]:
                assert isinstance(args, int), f"Arguments to AND/OR/XOR must be of type int, not {type(args)}"
                data.extend(int.to_bytes(1, 4, "little"))
                data.append(args)
            elif token_type in [APTokenTypes.COPY, APTokenTypes.RLE]:
                assert isinstance(args, tuple), f"Arguments to COPY/RLE must be of type tuple, not {type(args)}"
                data.extend(int.to_bytes(8, 4, "little"))
                data.extend(args[0].to_bytes(4, "little"))
                data.extend(args[1].to_bytes(4, "little"))
            elif token_type == APTokenTypes.WRITE:
                assert isinstance(args, bytes), f"Arguments to WRITE must be of type bytes, not {type(args)}"
                data.extend(len(args).to_bytes(4, "little"))
                data.extend(args)
            else:
                raise ValueError(f"Unknown token type {token_type}")
        return bytes(data)*/