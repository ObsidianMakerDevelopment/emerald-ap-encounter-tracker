import Pokedex from 'pokedex-promise-v2';
import * as pfs from "fs/promises";
const P = new Pokedex();

let hoenn: Pokedex.Region;
try{
    hoenn = JSON.parse(await pfs.readFile('hoenn.json', 'utf-8'));
}
catch{
    hoenn = await P.getRegionByName('hoenn');
    await pfs.writeFile('hoenn.json', JSON.stringify(hoenn, null, 2));
}
console.log(hoenn);
