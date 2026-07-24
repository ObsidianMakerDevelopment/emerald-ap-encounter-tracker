import Pokedex from 'pokedex-promise-v2';
import * as pfs from "fs/promises";
const P = new Pokedex();

let hoenn: Pokedex.Region;
try {
    hoenn = JSON.parse(await pfs.readFile('hoenn.json', 'utf-8'));
}
catch {
    hoenn = await P.getRegionByName('hoenn');
    await pfs.writeFile('hoenn.json', JSON.stringify(hoenn, null, 2));
}
console.log(hoenn);

let generations: Pokedex.Generation[];
try {
    let gens = JSON.parse(await pfs.readFile('gens.json', 'utf-8'));
    generations = gens;
}
catch {
    generations = await Promise.all([P.getGenerationByName('generation-i'), P.getGenerationByName('generation-ii'), P.getGenerationByName('generation-iii')]);
    await pfs.writeFile('gens.json', JSON.stringify(generations, null, 2));
}
console.log(generations);

let mons = [];
for (const gen of generations) {
    mons.push(...gen.pokemon_species);
}

for(const mon of mons) {
    //https://pokeapi.co/api/v2/pokemon-species/7/"
    mon.number = parseInt(mon.url.split('/').filter(Boolean).pop()!);
}
mons.sort((a, b) => a.number - b.number);
console.log(mons);
await pfs.writeFile('mons.json', JSON.stringify(mons, null, 2));
