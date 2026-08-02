import * as AP from "archipelago.js";

/**
 * @type {AP.Client}
 */
//window.ap_client;

export let BADGES = ["Stone Badge", "Knuckle Badge", "Dynamo Badge", "Heat Badge", "Balance Badge", "Feather Badge", "Mind Badge", "Rain Badge"];
export let GYMS = ["defeat_roxanne", "defeat_brawly", "defeat_wattson", "defeat_flannery", "defeat_norman", "defeat_winona", "defeat_tate_and_liza", "defeat_juan"];

let items = {};
let items_initialized = false;
let cached_has = {};
export function invalidate_cache() {
    cached_has = {};
}
function cache(item, value) {
    cached_has[item] = value;
    return value;
}
let eventsFlags = 0;
export function has(item) {
    if (item == 0) return true;
    if (cached_has[item] !== undefined) {
        return cached_has[item];
    }
    if (window.ap_client && !items_initialized) {
        //Register a listener to create the items map
        /**
         * @type {AP.Client}
         */
        let client = window.ap_client;

        client.items.on("itemsReceived", (ritems, index) => {
            if(index <=0) items = {}; // Reset items on first index
            invalidate_cache();
            for (let received_item of ritems) {
                /**
                 * @type {AP.Item}
                 */
                let iz = received_item;
                items[iz.name] = (items[iz.name] || 0) + 1;
            }
        });

        client.storage.notify("pokemon_emerald_events_0_"+client.players.self.slot, (data) => {
            //Get events as string?
            console.log("Received events", data);

            eventsFlags = Number(data);
        });
        items_initialized = true;

    }

    if (item == "defeat_roxanne") {
        return cache(item, true); //Roxanne is possible to challenge at any time, so we will just assume the player can defeat her
    }
    else if (item == "defeat_brawly") {
        return cache(item, dewford_access()) || (eventsFlags & 0x1) != 0; //OOL brawly
    }
    else if (item == "defeat_wattson") {
        return cache(item, mauville_access()) || (eventsFlags & 0x2) != 0; //OOL brawly
    }
    else if (item == "defeat_flannery") {
        return cache(item, lavaridge_access()) || (eventsFlags & 0x4) != 0; //OOL brawly
    }
    else if (item == "defeat_norman") {
        return cache(item, has_norman_req()) || (eventsFlags & 0x8) != 0; //OOL brawly
    }
    else if (item == "defeat_winona") {
        return cache(item, fortree_access() && has("Devon Scope")) || (eventsFlags & 16) != 0; //OOL brawly
    }
    else if (item == "defeat_tate_and_liza") {
        return cache(item, mossdeep_access()) || (eventsFlags & 32) != 0; //OOL brawly
    }
    else if (item == "defeat_juan") {
        return cache(item, sootopolis_access()) || (eventsFlags & 64) != 0; //OOL brawly; //TODO: Add logic for defeating Juan, currently only checks if player can access Sootopolis, rayquaza sequence is not implemented yet
    }
    else if (item == "deliver_letter") {
        return (eventsFlags & 128) != 0 || cache(item, granite_cave_inner_access() && has("Letter"));
    }
    else if (item == "defeat_champion") {
        return cache(item, e4_access());
    }
    else if(item =="talk_mr_stone"){
        return true; // Always possible to talk to Mr. Stone, it's an event that doesn't require any items or badges to access, so we will just assume the player can talk to him
    }
  
    if (item.startsWith("free_fly_")) {
        if (window.freeflyid) {
            if (item == "free_fly_ever_grande" || item == "free_fly_evergrande") {
                return window.freeflyid === 14;
            }
            let mapping =
            {
                0: "littleroot",  // Free Fly Littleroot
                1: "oldale",  // Free Fly Oldale
                2: "petalburg",  // Free Fly Petalburg
                3: "rustboro",  // Free Fly Rustboro
                4: "dewford",  // Free Fly Dewford
                5: "slateport",  // Free Fly Slateport
                6: "mauville",  // Free Fly Mauville
                7: "verdanturf",  // Free Fly Verdanturf
                8: "fallarbor",  // Free Fly Fallarbor
                9: "lavaridge",  // Free Fly Lavaridge
                10: "fortree", // Free Fly Fortree
                11: "lilycove", // Free Fly Lilycove
                12: "mossdeep", // Free Fly Mossdeep
                13: "sootopolis", // Free Fly Sootopolis
                14: "evergrande" // Free Fly Ever Grande
            }
            return cache(item, mapping[window.freeflyid] === item.replace("free_fly_", ""));
        }
    }
    if (item == "Itemfinder Off") {
        if (window.ap_client) {
            return cache(item, !window.ap_client.logData.require_itemfinder);
        }
    }
    if (item == "defeat_shelly")
    {
        //bit == 11
        return (eventsFlags & 2048) != 0;
    }
    if (item == "talk_mr_stone") {
        return cache(item, has("Devon Goods")); //Logic to be able to talk to mr stone is not implemented yet, so we will just assume the player can talk to him
    }
    if (item == "steven_gives_dive") {
        //bit = 19
        return (eventsFlags & 524288) != 0;
    }
    if(item == "aqua_steals_submarine")
    {
        //bit = 14
        return (eventsFlags & 16384) != 0;
    }
    if (window.ap_client) {
        if(items_initialized) {
            return cache(item, items[item] !== undefined && items[item] > 0);
        }
        return cache(item, window.ap_client.items.received.find(x => x.name == item) !== undefined);
    }
    return false;
}
export function free_fly(location) {
    return has("free_fly_" + location) && fly();
}
export function canUseHM(hm) {
    if (window.ap_client) {
        let requirements = window.ap_client.logData.hm_requirements[hm]
        if(requirements ==0) return true;
        if(requirements.length)
        {
            //Is Array
            return requirements.every(req => has(req));
        }
        else if (Number.isFinite(requirements)) {
            //Count badges
            let count = 0;
            for (let badge of BADGES) {
                if (has(badge)) {
                    count++;
                }
            }
            return count >= requirements;
        }
        return false;
    }
}
export function cut() {
    return has("HM01 Cut") && canUseHM("HM01 Cut");
}
export function fly() {
    return has("HM02 Fly") && canUseHM("HM02 Fly");
}
export function surf() {
    return has("HM03 Surf") && canUseHM("HM03 Surf");
}
export function strength() {
    return has("HM04 Strength") && canUseHM("HM04 Strength");
}
export function flash() {
    return has("HM05 Flash") && canUseHM("HM05 Flash");
}
export function rock_smash() {
    return has("HM06 Rock Smash") && canUseHM("HM06 Rock Smash");
}
export function waterfall() {
    return has("HM07 Waterfall") && canUseHM("HM07 Waterfall");
}
export function dive() {
    return has("HM08 Dive") && canUseHM("HM08 Dive");
}
export function bike() {
    return has("Acro Bike") || has("Mach Bike");
}
export function hidden() {
    return has("Itemfinder") || has("Itemfinder Off");
}
export function badges() {
    let count = 0;
    for (let badge of BADGES) {
        if (has(badge)) {
            count++;
        }
    }
    return count;
}
export function has_norman_req() {
    if (!window.ap_client) return false;

    //norman_requirement:0 badges, 1 gyms (Gyms not considered for now)
    let count = 0;
    let req_type = window.ap_client.logData.norman_requirement;
    let req_count = window.ap_client.logData.norman_count;

    if (req_type == 0) { // badges
        for (let item of BADGES) {
            if (has(item)) {
                count++;
            }
        }
    }
    return count >= req_count;
}
export function has_e4_req() {
    if (!window.ap_client) return false;

    let count = 0;
    let req_type = window.ap_client.logData.e4_requirement;
    let req_count = window.ap_client.logData.e4_count;

    if (req_type == 0) { // badges
        for (let item of BADGES) {
            if (has(item)) {
                count++;
            }
        }
    }
    return count >= req_count;
}
export function rescue_stern() {
    return false;
}
export function pass_route_110() {
    let roadblocks = window.ap_client?.logData?.remove_roadblocks || [];
    return bike() || roadblocks.includes("Remove Route 110 Aqua Grunts") || rescue_stern();
}
export function pass_cable_car() {
    let roadblocks = window.ap_client?.logData?.remove_roadblocks || [];
    return roadblocks.includes("Remove Route 112 Magma Grunts") || true;
}
export function route_115_boulders() {
    let roadblocks = window.ap_client?.logData?.extra_boulders || false;
    return !roadblocks || strength();
}
export function pass_route_115() {
    let route_115_bumpy_slope_on = window.ap_client?.logData?.extra_bumpy_slope || false;
    return (surf() && route_115_boulders()) || (route_115_bumpy_slope_on && has("Acro Bike"));
}
export function pass_route_118() {
    let modify_118 = window.ap_client?.logData?.modify_118 || false;
    if (modify_118) {
        return has("Acro Bike");
    }
    return surf();
}
export function pass_route_119() {
    let roadblocks = window.ap_client?.logData?.remove_roadblocks || [];
    return roadblocks.includes("Remove Route 119 Aqua Grunts") || has("defeat_shelly");
}
export function pass_route_124(direction) {
    let roadblocks = window.ap_client?.logData?.remove_roadblocks || [];
    let wailmer_on = !roadblocks.includes("Remove Route 124 Aqua Grunts");
    if (direction == "left") {
        return surf() && (wailmer_on || has("defeat_matt"));
    }
    return surf();
}
export function dewford_access() {
    return has("talk_mr_stone") || surf();
}
export function slateport_access() {
    return free_fly("slateport")
        || surf()
        || (dewford_access() && has("deliver_letter"))
        || (free_fly("mauville") && pass_route_110())
        || (free_fly("verdanturf") && pass_route_110())
        || (rock_smash() && pass_route_110())
        || (free_fly("fortree") && (has("S.S. Ticket") || (pass_route_119() && pass_route_118() && pass_route_110())))
        || (free_fly("lilycove") && (has("S.S. Ticket") || (cut() && pass_route_119() && pass_route_118() && pass_route_110())));
}
export function mauville_access() {
    return free_fly("mauville")
        || free_fly("verdanturf")
        || rock_smash()
        || surf()
        || (slateport_access() && pass_route_110())
        || (free_fly("fortree") && pass_route_119() && pass_route_118())
        || (free_fly("lilycove") && cut() && pass_route_119() && pass_route_118());
}
export function fallarbor_access() {
    return free_fly("fallarbor")
        || free_fly("lavaridge")
        || pass_route_115()
        || rock_smash();
}
export function mt_chimney_access() {
    return (fallarbor_access() && pass_cable_car())
        || (free_fly("lavaridge") && has("Acro Bike"));
}
export function lavaridge_access() {
    return free_fly("lavaridge")
        || (fallarbor_access() && pass_cable_car());
}
export function route_119_access() {
    return (mauville_access() && pass_route_118())
        || (free_fly("fortree") && (pass_route_119() || surf()))
        || (free_fly("lilycove") && (surf() || (cut() && pass_route_119())))
        || (slateport_access() && has("S.S. Ticket") && (surf() || (cut() && pass_route_119())))
        || (free_fly("mossdeep") && pass_route_124())
        || (free_fly("sootopolis") && dive() && pass_route_124())
        || (free_fly("evergrande") && pass_route_124());
}
export function fortree_access() {
    return free_fly("fortree")
        || (route_119_access() && pass_route_119())
        || (free_fly("lilycove") && cut())
        || (slateport_access() && has("S.S. Ticket") && cut())
        || (free_fly("mossdeep") && pass_route_124() && cut())
        || (free_fly("sootopolis") && dive() && pass_route_124() && cut())
        || (free_fly("ever_grande") && pass_route_124() && cut());
}
export function lilycove_access() {
    return free_fly("lilycove")
        || fortree_access()
        || (slateport_access() && has("S.S. Ticket"))
        || (free_fly("mossdeep") && pass_route_124())
        || (free_fly("sootopolis") && dive() && pass_route_124())
        || (free_fly("ever_grande") && pass_route_124());
}
export function aqua_hideout_access() {
    //TODO: logic, 
    return lilycove_access() && surf() && (has("hideout_grunts_on") || has("aqua_steals_submarine"));
}
export function route_124_access() {
    return (lilycove_access() && pass_route_124("left"))
        || (free_fly("mossdeep") && surf())
        || (free_fly("sootopolis") && dive() && surf())
        || (free_fly("ever_grande") && surf());
}
export function mossdeep_access() {
    return free_fly("mossdeep") || route_124_access();
}
export function sootopolis_access() {
    return free_fly("sootopolis") || (route_124_access() && dive());
}
export function seafloor_cavern_access() {
    let roadblocks = window.ap_client?.logData?.remove_roadblocks || [];
    let sea_floor_grunts_on = roadblocks.includes("Remove Seafloor Cavern Aqua Grunt");
    return route_124_access() && dive() && (sea_floor_grunts_on || has("steven_gives_dive")) && rock_smash() && strength();
}
export function sealed_chamber_access() {
    return route_124_access() && dive();
}
export function desert_ruins_access() {
    return fallarbor_access() && has("Go Goggles");
}
export function island_cave_access() {
    return surf();
}
export function ancient_tomb_access() {
    return fortree_access();
}
export function victory_road_access() {
    return free_fly("ever_grande") || (route_124_access() && waterfall());
}
export function victory_road_b1f_access() {
    let flash_req = window.ap_client?.logData?.require_flash || 1;
    return victory_road_access() && rock_smash() && strength() && ((flash_req == 0) || flash());
}
export function victory_road_b2f_access() {
    return victory_road_b1f_access();
}
export function e4_access() {
    return victory_road_b2f_access() && rock_smash() && strength() && surf() && has_e4_req();
}
export function battle_frontier_access() {
    return (slateport_access() || lilycove_access()) && has("S.S. Ticket");
}
export function terra_cave_access() {
    return has("defeat_champion") && has("defeat_shelly");
}
export function marine_cave_access() {
    return dive() && has("defeat_champion") && has("defeat_shelly");
}
export function ever_grande_encounters() {
    return (free_fly("ever_grande") && surf()) || (route_124_access());
}
export function jagged_pass_access() {
    return (mt_chimney_access() && pass_cable_car()) || (free_fly("lavaridge") && has("Acro Bike"));
}
export function magma_hideout_access() {
    return jagged_pass_access() && has("Magma Emblem");
}
export function inner_magma_hideout_access() {
    return magma_hideout_access() && strength() && rock_smash();
}
export function artisan_cave_access() {
    return battle_frontier_access() && has("Wailmer Pail") && surf();
}
export function shoal_cave_access() {
    return surf() && mossdeep_access();
}
export function granite_cave_inner_access() {
    let flash_req = window.ap_client?.logData?.require_flash || 1;

    return dewford_access() && (flash() || flash_req == 0);
}
export function mt_pyre_access() {
    return fortree_access() && surf() || (lilycove_access() && surf());
}
export function safari_zone_access() {
    return lilycove_access() && has("Safari Zone Pass");
}
export function meteor_falls_access() {
    return fallarbor_access();
}
export function meteor_falls_1f2r_access() {
    return meteor_falls_access() && surf() && waterfall();
}
export function meteor_falls_b1f1r_access() {
    return meteor_falls_access() && surf() && waterfall();
}
export function meteor_falls_b1f2r_access() {
    return meteor_falls_access() && surf() && waterfall();
}
export function meteor_falls_steven_room() {
    return meteor_falls_access() && surf() && waterfall() && has("defeat_champion");
}

/* Example logData:
{
    "goal": 3,
    "badges": 2,
    "hms": 2,
    "key_items": 1,
    "bikes": 1,
    "event_tickets": 1,
    "rods": 1,
    "overworld_items": 1,
    "hidden_items": 1,
    "npc_gifts": 1,
    "berry_trees": 1,
    "require_itemfinder": 1,
    "require_flash": 3,
    "elite_four_requirement": 1,
    "elite_four_count": 8,
    "norman_requirement": 0,
    "norman_count": 6,
    "legendary_hunt_catch": 0,
    "legendary_hunt_count": 9,
    "extra_boulders": 0,
    "remove_roadblocks": [
        "Route 119 Aqua Grunts",
        "Seafloor Cavern Aqua Grunt"
    ],
    "allowed_legendary_hunt_encounters": [
        "Deoxys",
        "Groudon",
        "Ho-Oh",
        "Kyogre",
        "Latias",
        "Latios",
        "Lugia",
        "Mew",
        "Rayquaza",
        "Regice",
        "Regirock",
        "Registeel"
    ],
    "extra_bumpy_slope": 0,
    "free_fly_location": 1,
    "remote_items": 1,
    "dexsanity": 1,
    "trainersanity": 1,
    "modify_118": 0,
    "death_link": 1,
    "normalize_encounter_rates": 1,
    "free_fly_location_id": 11,
    "hm_requirements": {
        "HM01 Cut": [
            "Stone Badge"
        ],
        "HM02 Fly": 0,
        "HM03 Surf": [
            "Balance Badge"
        ],
        "HM04 Strength": [
            "Heat Badge"
        ],
        "HM05 Flash": [
            "Knuckle Badge"
        ],
        "HM06 Rock Smash": [
            "Dynamo Badge"
        ],
        "HM07 Waterfall": [
            "Rain Badge"
        ],
        "HM08 Dive": [
            "Mind Badge"
        ]
    }
}*/

export class RoomLogic {
    constructor(options) {
        this.defaults = false;
        if (options && options.bind) {
            this.Base = options.bind(this.Base);
        }
        else {
            if (options != false && options != true && options != undefined) {
                Object.assign(this, options);
            }
            else if (options != undefined) {
                this.defaults = options;
            }
        }
    }

    Base() {
        return this.defaults;
    }

    Land() {
        return this.Base();
    }
    Water() {
        return this.Base() && surf();
    }
    OldRod() {
        return this.Base() && has("Old Rod");
    }
    GoodRod() {
        return this.Base() && has("Good Rod");
    }
    SuperRod() {
        return this.Base() && has("Super Rod");
    }
    RockSmash() {
        return this.Base() && rock_smash();
    }
}
export let roomLogic = {
    "MAP_ABANDONED_SHIP_HIDDEN_FLOOR_CORRIDORS": new RoomLogic(() => surf() && dive()),
    "MAP_ABANDONED_SHIP_ROOMS_B1F": new RoomLogic(surf),
    "MAP_ARTISAN_CAVE_1F": new RoomLogic(artisan_cave_access),
    "MAP_ARTISAN_CAVE_B1F": new RoomLogic(artisan_cave_access),
    "MAP_CAVE_OF_ORIGIN_1F": new RoomLogic(sootopolis_access),
    "MAP_CAVE_OF_ORIGIN_ENTRANCE": new RoomLogic(sootopolis_access),
    "MAP_DESERT_UNDERPASS": new RoomLogic(desert_ruins_access),
    "MAP_DEWFORD_TOWN": new RoomLogic(dewford_access),
    "MAP_EVER_GRANDE_CITY": new RoomLogic(ever_grande_encounters), // Weird logic because encounters can be accessed from below, not just from the top of the waterfall
    "MAP_FIERY_PATH": new RoomLogic(() => fallarbor_access() || (mauville_access() && rock_smash())),
    "MAP_GRANITE_CAVE_1F": new RoomLogic(dewford_access),
    "MAP_GRANITE_CAVE_B1F": new RoomLogic(granite_cave_inner_access),
    "MAP_GRANITE_CAVE_B2F": new RoomLogic(granite_cave_inner_access),
    "MAP_GRANITE_CAVE_STEVENS_ROOM": new RoomLogic(granite_cave_inner_access),
    "MAP_JAGGED_PASS": new RoomLogic(jagged_pass_access),
    "MAP_LILYCOVE_CITY": new RoomLogic(lilycove_access),
    "MAP_ROUTE101": new RoomLogic(true),
    "MAP_ROUTE102": new RoomLogic(true),
    "MAP_ROUTE103": new RoomLogic(true),
    "MAP_ROUTE104": new RoomLogic(true),
    "MAP_ROUTE105": new RoomLogic(surf),
    "MAP_ROUTE106": new RoomLogic(surf),
    "MAP_ROUTE107": new RoomLogic(surf),
    "MAP_ROUTE108": new RoomLogic(surf),
    "MAP_ROUTE109": new RoomLogic(surf),
    "MAP_ROUTE110": new RoomLogic(() => mauville_access() || slateport_access()),
    "MAP_ROUTE111": new RoomLogic({ Land: () => (has("Go Goggles") && (mauville_access() && (surf() || rock_smash()))) || (fallarbor_access()), Base: () => mauville_access() || fallarbor_access(), Water: () => surf() && mauville_access(), OldRod: () => has("Old Rod") && mauville_access(), GoodRod: () => has("Good Rod") && mauville_access(), SuperRod: () => has("Super Rod") && mauville_access() }),
    "MAP_ROUTE112": new RoomLogic(() => fallarbor_access() || (mauville_access() && rock_smash())),
    "MAP_ROUTE113": new RoomLogic(fallarbor_access),
    "MAP_ROUTE114": new RoomLogic(fallarbor_access),
    "MAP_ROUTE115": new RoomLogic({ Land: surf, Base: () => true }),
    "MAP_ROUTE116": new RoomLogic(true),
    "MAP_ROUTE117": new RoomLogic(mauville_access),
    "MAP_ROUTE118": new RoomLogic(() => mauville_access() || fortree_access()),
    "MAP_ROUTE119": new RoomLogic(fortree_access),
    "MAP_ROUTE120": new RoomLogic(fortree_access),
    "MAP_ROUTE121": new RoomLogic(() => fortree_access() || lilycove_access()),
    "MAP_ROUTE122": new RoomLogic(() => lilycove_access() && surf()),
    "MAP_ROUTE123": new RoomLogic(() => lilycove_access() && surf()),
    "MAP_ROUTE124": new RoomLogic(route_124_access),
    "MAP_ROUTE125": new RoomLogic(route_124_access),
    "MAP_ROUTE126": new RoomLogic(route_124_access),
    "MAP_ROUTE127": new RoomLogic(route_124_access),
    "MAP_ROUTE128": new RoomLogic(route_124_access),
    "MAP_ROUTE129": new RoomLogic(route_124_access),
    "MAP_ROUTE130": new RoomLogic(route_124_access),
    "MAP_ROUTE131": new RoomLogic(route_124_access),
    "MAP_ROUTE132": new RoomLogic(route_124_access),
    "MAP_ROUTE133": new RoomLogic(route_124_access),
    "MAP_ROUTE134": new RoomLogic(route_124_access),
    "MAP_MAGMA_HIDEOUT_1F": new RoomLogic(magma_hideout_access),
    "MAP_MAGMA_HIDEOUT_2F_1R": new RoomLogic(inner_magma_hideout_access),
    "MAP_MAGMA_HIDEOUT_2F_2R": new RoomLogic(inner_magma_hideout_access),
    "MAP_MAGMA_HIDEOUT_2F_3R": new RoomLogic(inner_magma_hideout_access),
    "MAP_MAGMA_HIDEOUT_3F_1R": new RoomLogic(inner_magma_hideout_access),
    "MAP_MAGMA_HIDEOUT_3F_2R": new RoomLogic(inner_magma_hideout_access),
    "MAP_MAGMA_HIDEOUT_3F_3R": new RoomLogic(inner_magma_hideout_access),
    "MAP_MAGMA_HIDEOUT_4F": new RoomLogic(inner_magma_hideout_access),
    "MAP_METEOR_FALLS_1F_1R": new RoomLogic(meteor_falls_access),
    "MAP_METEOR_FALLS_1F_2R": new RoomLogic(meteor_falls_1f2r_access),
    "MAP_METEOR_FALLS_B1F_1R": new RoomLogic(meteor_falls_b1f1r_access),
    "MAP_METEOR_FALLS_B1F_2R": new RoomLogic(meteor_falls_b1f2r_access),
    "MAP_METEOR_FALLS_STEVENS_CAVE": new RoomLogic(meteor_falls_steven_room),
    "MAP_MIRAGE_TOWER_1F": new RoomLogic(desert_ruins_access),
    "MAP_MIRAGE_TOWER_2F": new RoomLogic(desert_ruins_access),
    "MAP_MIRAGE_TOWER_3F": new RoomLogic(desert_ruins_access),
    "MAP_MIRAGE_TOWER_4F": new RoomLogic(desert_ruins_access),
    "MAP_MOSSDEEP_CITY": new RoomLogic(mossdeep_access),
    "MAP_MT_PYRE_1F": new RoomLogic(mt_pyre_access),
    "MAP_MT_PYRE_2F": new RoomLogic(mt_pyre_access),
    "MAP_MT_PYRE_3F": new RoomLogic(mt_pyre_access),
    "MAP_MT_PYRE_4F": new RoomLogic(mt_pyre_access),
    "MAP_MT_PYRE_5F": new RoomLogic(mt_pyre_access),
    "MAP_MT_PYRE_6F": new RoomLogic(mt_pyre_access),
    "MAP_MT_PYRE_EXTERIOR": new RoomLogic(mt_pyre_access),
    "MAP_MT_PYRE_SUMMIT": new RoomLogic(mt_pyre_access),
    "MAP_NEW_MAUVILLE_ENTRANCE": new RoomLogic(() => mauville_access() && surf()),
    "MAP_NEW_MAUVILLE_INSIDE": new RoomLogic(() => mauville_access() && surf() && has("Basement Key")),
    "MAP_PACIFIDLOG_TOWN": new RoomLogic(route_124_access),
    "MAP_PETALBURG_CITY": new RoomLogic(true),
    "MAP_PETALBURG_WOODS": new RoomLogic(true),
    "MAP_RUSTURF_TUNNEL": new RoomLogic(true),
    "MAP_SAFARI_ZONE_NORTH": new RoomLogic(() => safari_zone_access() && has("Acro Bike")),
    "MAP_SAFARI_ZONE_NORTHEAST": new RoomLogic(safari_zone_access),
    "MAP_SAFARI_ZONE_NORTHWEST": new RoomLogic(() => safari_zone_access() && has("Mach Bike")),
    "MAP_SAFARI_ZONE_SOUTH": new RoomLogic(safari_zone_access),
    "MAP_SAFARI_ZONE_SOUTHEAST": new RoomLogic(safari_zone_access),
    "MAP_SAFARI_ZONE_SOUTHWEST": new RoomLogic(safari_zone_access),
    "MAP_SEAFLOOR_CAVERN_ENTRANCE": new RoomLogic(seafloor_cavern_access),
    "MAP_SEAFLOOR_CAVERN_ROOM1": new RoomLogic(seafloor_cavern_access),
    "MAP_SEAFLOOR_CAVERN_ROOM2": new RoomLogic(seafloor_cavern_access),
    "MAP_SEAFLOOR_CAVERN_ROOM3": new RoomLogic(seafloor_cavern_access),
    "MAP_SEAFLOOR_CAVERN_ROOM4": new RoomLogic(seafloor_cavern_access),
    "MAP_SEAFLOOR_CAVERN_ROOM5": new RoomLogic(seafloor_cavern_access),
    "MAP_SEAFLOOR_CAVERN_ROOM6": new RoomLogic(seafloor_cavern_access),
    "MAP_SEAFLOOR_CAVERN_ROOM7": new RoomLogic(seafloor_cavern_access),
    "MAP_SEAFLOOR_CAVERN_ROOM8": new RoomLogic(seafloor_cavern_access),
    "MAP_SHOAL_CAVE_LOW_TIDE_ENTRANCE_ROOM": new RoomLogic(shoal_cave_access),
    "MAP_SHOAL_CAVE_LOW_TIDE_ICE_ROOM": new RoomLogic(shoal_cave_access),
    "MAP_SHOAL_CAVE_LOW_TIDE_INNER_ROOM": new RoomLogic(shoal_cave_access),
    "MAP_SHOAL_CAVE_LOW_TIDE_LOWER_ROOM": new RoomLogic(shoal_cave_access),
    "MAP_SHOAL_CAVE_LOW_TIDE_STAIRS_ROOM": new RoomLogic(shoal_cave_access),
    "MAP_SLATEPORT_CITY": new RoomLogic(slateport_access),
    "MAP_SOOTOPOLIS_CITY": new RoomLogic(sootopolis_access),
    "MAP_UNDERWATER_ROUTE124": new RoomLogic(() => route_124_access() && dive()),
    "MAP_UNDERWATER_ROUTE126": new RoomLogic(() => route_124_access() && dive()),
    "MAP_SKY_PILLAR_1F": new RoomLogic(route_124_access),
    "MAP_SKY_PILLAR_3F": new RoomLogic(route_124_access),
    "MAP_SKY_PILLAR_5F": new RoomLogic(route_124_access),
    "MAP_VICTORY_ROAD_1F": new RoomLogic(victory_road_access),
    "MAP_VICTORY_ROAD_B1F": new RoomLogic(victory_road_b1f_access),
    "MAP_VICTORY_ROAD_B2F": new RoomLogic(victory_road_b2f_access)
}