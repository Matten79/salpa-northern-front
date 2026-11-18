// Itärajan sektorit. Ruudukko 30×18, raja x=24 (x≥24 = Venäjä), puolustettava kaupunki lännessä (x<0).
// Koordinaatit: [x, z] ruutuina; blobit [keskiX, keskiZ, säde].

const SPRUCE = { n: 3, scale: 1, slim: 1, col: 0x2e5e33, winterCol: 0x557a68, ruska: .22 };
const MIXED = { n: 3, scale: .95, slim: 1, col: 0x35663a, winterCol: 0x5b7d6c, ruska: .5 };
const NORTH_PINE = { n: 2, scale: .8, slim: .8, col: 0x3f6638, winterCol: 0x5f7f68, ruska: .3 };
const FELL_BIRCH = { n: 2, scale: .6, slim: .9, col: 0x5d7a3e, winterCol: 0x7d8f80, ruska: .9 };

export const SECTORS = [
  {
    id: 'kaakko', nameEn: 'South-East Finland', descEn: 'Highway 7 (E18) and the Gulf of Finland coast. Open fields and good roads make this the main axis for armour.', factsEn: ["🛣 Three roads, a wide highway in the middle", "🌊 The sea bounds the south", "🛡 The enemy brings many tanks"], no: 1, name: 'Kaakkois-Suomi', short: 'Vaalimaa', area: 'Vaalimaa – Hamina',
    city: 'Hamina', cityTo: 'Haminaa', cityIn: 'Haminaan',
    lat: [60.45, 60.95], crossing: [27.85, 60.57], target: [27.2, 60.57],
    seed: 1, forest: .47, clearing: .6, money: 650, waves: 10, townSize: 13,
    winter: [5, 6, 7, 8], mix: { inf: 1, bmp: 1.2, tank: 1.3, drone: 1, heli: .8 }, reindeer: 0, trees: SPRUCE,
    roads: [
      [[29, 9], [24, 9], [20, 8], [14, 8], [8, 9], [0, 9]],
      [[29, 3], [24, 3], [19, 5], [15, 7], [14, 8]],
      [[29, 14], [25, 14], [18, 13], [10, 14], [4, 13], [0, 13]],
    ],
    lakes: [[17, 11.5, 2.0], [9, 4, 2.4], [21, 1, 1.7], [27, 11, 1.4], [28.5, 1, 1.3]],
    swamps: [[12, 11, 1.6], [5.5, 7, 1.5], [26, 6, 1.3]],
    sea: { z: 15.4, xMax: 24 },
    desc: 'Valtatie 7 (E18) ja Suomenlahden rannikko. Avointa peltoa ja hyvät tiet tekevät tästä panssarien pääsuunnan.',
    facts: ['🛣 Kolme tietä, leveä valtatie keskellä', '🌊 Meri rajaa etelän', '🛡 Vihollisella paljon panssareita'],
  },
  {
    id: 'ekarjala', nameEn: 'South Karelia', descEn: 'Lake Saimaa and the Vuoksi river. Waterways force the attacker onto narrow isthmuses and bridges – ideal for ambushes.', factsEn: ["💧 The Vuoksi splits the map, bridges are key points", "🌾 Lots of farmland and industry", "🧊 In winter the Vuoksi freezes over"], no: 2, name: 'Etelä-Karjala', short: 'Imatra', area: 'Imatra – Lappeenranta',
    city: 'Lappeenranta', cityTo: 'Lappeenrantaa', cityIn: 'Lappeenrantaan',
    lat: [60.95, 61.8], crossing: [29.2, 61.18], target: [28.19, 61.06],
    seed: 2, forest: .52, clearing: .7, money: 650, waves: 10, townSize: 16,
    winter: [5, 6, 7, 8], mix: { inf: 1, bmp: 1.1, tank: 1.1, drone: 1.1 }, reindeer: 0, trees: MIXED,
    roads: [
      [[29, 7], [24, 7], [19, 8], [12, 8], [5, 8], [0, 8]],
      [[29, 14], [24, 14], [18, 12], [11, 12], [5, 11], [0, 11]],
      [[29, 1], [24, 1], [18, 2], [15, 5], [12, 8]],
      [[12, 8], [11, 12]],
    ],
    rivers: [[[0, 4], [6, 5], [12, 4], [18, 4], [24, 5], [29, 5]]],
    lakes: [[2.5, 1.5, 2.4], [4, 15.5, 3.0], [11, 16.6, 2.2], [19, 16.6, 1.8], [15.5, 9.8, 1.3], [26, 10, 1.4]],
    swamps: [[22, 10.5, 1.2], [8, 14, 1.1]],
    desc: 'Saimaa ja Vuoksi. Vesistöt pakottavat hyökkääjän kapeille kannaksille ja silloille – hyvä paikka mertoille.',
    facts: ['💧 Vuoksi halkaisee kartan, sillat ovat avainkohtia', '🌾 Paljon peltoa ja teollisuusaluetta', '🧊 Talvella Vuoksi jäätyy ja aukeaa'],
  },
  {
    id: 'pkarjala', nameEn: 'North Karelia', descEn: 'Vast spruce forests and long lakes running north-west to south-east. Infantry infiltrates through the woods.', factsEn: ["🌲 Dense forest – infantry terrain", "💧 Long chains of lakes divide the map", "👣 The enemy relies on infantry"], no: 3, name: 'Pohjois-Karjala', short: 'Niirala', area: 'Niirala – Joensuu',
    city: 'Joensuu', cityTo: 'Joensuuta', cityIn: 'Joensuuhun',
    lat: [61.8, 63.55], crossing: [30.6, 62.15], target: [29.76, 62.6],
    seed: 3, forest: .38, clearing: .5, money: 650, waves: 10, townSize: 13,
    winter: [4, 5, 6, 7, 8], mix: { inf: 1.25, bmp: 1, tank: .8, drone: 1 }, reindeer: 0, trees: SPRUCE,
    roads: [
      [[29, 9], [24, 9], [18, 8], [12, 6], [6, 7], [0, 7]],
      [[29, 15], [23, 15], [17, 13], [10, 13], [4, 12], [0, 12]],
    ],
    lakes: [[5.5, 1.5, 1.6], [7.5, 3, 1.6], [9.5, 4.2, 1.3], [15, 15.2, 1.5], [17.5, 16.6, 1.5], [20, 3.5, 1.4], [22, 5, 1.3], [27, 2, 1.5], [26, 12, 1.3], [3.5, 16.2, 1.5]],
    swamps: [[13, 10, 1.6], [21, 10.5, 1.3], [8, 10, 1.2], [27, 6, 1.2]],
    desc: 'Laajat kuusimetsät ja pitkät, luode–kaakko-suuntaiset järvet. Jalkaväki soluttautuu metsien läpi.',
    facts: ['🌲 Tiheää metsää – jalkaväen maastoa', '💧 Pitkät järvijaksot jakavat kartan', '👣 Vihollisella runsaasti jalkaväkeä'],
  },
  {
    id: 'kainuu', nameEn: 'Kainuu', descEn: 'Wilderness and wide aapa bogs. Only one proper road – but in winter the frozen bogs become highways.', factsEn: ["🟫 Many open bogs", "🛣 One main road and a forest track", "🦌 A few reindeer have strayed south"], no: 4, name: 'Kainuu', short: 'Vartius', area: 'Vartius – Kajaani',
    city: 'Kajaani', cityTo: 'Kajaania', cityIn: 'Kajaaniin',
    lat: [63.55, 65.6], crossing: [29.95, 64.5], target: [27.73, 64.23],
    seed: 4, forest: .36, clearing: .4, money: 650, waves: 10, townSize: 11,
    winter: [4, 5, 6, 7, 8, 9], mix: { inf: 1.3, bmp: .9, tank: .6, drone: 1.1 }, reindeer: 4, trees: NORTH_PINE,
    roads: [
      [[29, 9], [23, 9], [16, 10], [9, 9], [0, 9]],
      [[29, 3], [22, 4], [17, 6], [16, 10]],
    ],
    lakes: [[6, 4, 2.2], [11, 15.5, 2.0], [25, 15, 1.6], [19, 1, 1.4]],
    swamps: [[12, 5, 2.3], [20, 13, 2.5], [5, 13, 1.9], [27, 5.5, 1.6], [14.5, 13.5, 1.5], [24, 1, 1.2], [2, 7, 1.2]],
    pal: { 0: 0x8faa52, 3: 0x8a8150 },
    desc: 'Korpimaata ja laajoja aapasoita. Vain yksi kunnon tie – mutta talvella jäätyneet suot muuttuvat moottoriteiksi.',
    facts: ['🟫 Paljon aapasoita', '🛣 Yksi päätie ja metsäautotie', '🦌 Muutama poro eksynyt etelään'],
  },
  {
    id: 'koillismaa', nameEn: 'Koillismaa – Salla', descEn: 'The fells, bogs and sparse pine forests of Salla. Positions on the fell tops see far. Reindeer graze everywhere.', factsEn: ["⛰ Fells: impassable for vehicles, +1 range for positions", "🛣 Only one road", "❄️ A long winter"], no: 5, name: 'Koillismaa – Salla', short: 'Salla', area: 'Salla – Kemijärvi',
    city: 'Kemijärvi', cityTo: 'Kemijärveä', cityIn: 'Kemijärvelle',
    lat: [65.6, 67.9], crossing: [29.4, 66.85], target: [27.4, 66.71],
    seed: 5, forest: .5, clearing: .4, money: 625, waves: 10, townSize: 9, north: true,
    winter: [3, 4, 5, 6, 7, 8, 9], mix: { inf: 1.2, bmp: .9, tank: .6, drone: 1.2 }, reindeer: 12, trees: NORTH_PINE,
    roads: [
      [[29, 8], [22, 8], [17, 10], [10, 10], [4, 8], [0, 8]],
    ],
    fells: [[8, 3, 2.3], [20, 15, 2.4], [26, 2.5, 1.7], [14, 4.5, 1.4]],
    lakes: [[4, 14, 2.2], [12, 15.6, 1.6], [22, 4.5, 1.3]],
    swamps: [[16, 13, 1.9], [6, 10.8, 1.3], [27, 12, 1.6]],
    pal: { 0: 0x8fa35a, 1: 0x587a44 },
    desc: 'Sallan tunturit, suot ja harva mäntymetsä. Tunturin laelta asemat näkevät kauas. Porot laiduntavat kaikkialla.',
    facts: ['⛰ Tunturit: ajoneuvot eivät pääse, asemille +1 kantama', '🛣 Vain yksi tie', '❄️ Pitkä talvi'],
  },
  {
    id: 'ylalappi', nameEn: 'Upper Lapland', descEn: 'Fells and mountain birch of Upper Lapland. Winter comes early and lasts long. There are more reindeer than people.', factsEn: ["⛰ Many fells – high firing positions", "🛣 One road, few vehicles", "🚁 The enemy relies on infantry, drones and helicopters"], no: 6, name: 'Ylä-Lappi', short: 'Raja-Jooseppi', area: 'Raja-Jooseppi – Ivalo',
    city: 'Ivalo', cityTo: 'Ivaloa', cityIn: 'Ivaloon',
    lat: [67.9, 69.1], crossing: [28.45, 68.5], target: [27.54, 68.66],
    seed: 6, forest: .58, clearing: .3, money: 600, waves: 10, townSize: 8, north: true,
    winter: [2, 3, 4, 5, 6, 7, 8, 9], mix: { inf: 1.35, bmp: .7, tank: .4, drone: 1.3, heli: 1.4 }, reindeer: 18, trees: FELL_BIRCH,
    roads: [
      [[29, 6], [22, 7], [15, 9], [8, 8], [0, 8]],
    ],
    fells: [[6, 3, 2.5], [14, 14, 2.7], [22, 2, 2.1], [27, 13, 2.1], [19.5, 10.8, 1.3], [4, 13, 1.7]],
    lakes: [[10.5, 4.5, 1.6], [24, 9.8, 1.2], [9, 16.6, 1.4]],
    swamps: [[16, 5, 1.5], [11, 11.5, 1.3]],
    pal: { 0: 0x9aa66a, 1: 0x6b8650 },
    desc: 'Ylä-Lapin tunturit ja tunturikoivikot. Talvi tulee aikaisin ja kestää pitkään. Poroja on enemmän kuin ihmisiä.',
    facts: ['⛰ Paljon tuntureita – korkeat tulipaikat', '🛣 Yksi tie, vähän ajoneuvoja', '🚁 Vihollinen luottaa jalkaväkeen ja lennokkeihin'],
  },
];

// Pelkistetty Suomen ääriviiva [lon, lat]
export const BORDER_LINE = [
  [27.85, 60.57], [28.3, 60.85], [28.7, 61.0], [29.2, 61.18], [29.55, 61.45], [29.8, 61.65], [30.15, 61.88],
  [30.65, 62.15], [31.2, 62.5], [31.55, 62.88], [31.25, 63.15], [30.65, 63.4], [30.5, 63.8], [30.55, 64.05],
  [30.0, 64.3], [29.95, 64.5], [29.65, 64.85], [30.1, 65.15], [29.75, 65.55], [29.85, 66.0], [29.1, 66.4],
  [29.4, 66.85], [29.05, 67.3], [29.6, 67.75], [28.75, 68.2], [28.45, 68.5], [28.75, 68.85], [28.93, 69.05],
];
export const FIN_OUTLINE = [
  ...BORDER_LINE,
  [29.3, 69.45], [28.9, 69.8], [28.0, 70.08], [27.4, 69.95], [27.0, 69.9], [26.4, 69.7], [25.85, 69.4],
  [25.75, 69.0], [25.1, 68.7], [24.2, 68.68], [23.4, 68.85], [22.4, 68.75], [21.7, 69.0], [21.0, 69.27],
  [20.55, 69.06], [21.0, 68.85], [21.6, 68.6], [22.4, 68.45], [23.1, 68.15], [23.7, 67.9], [23.55, 67.4],
  [23.85, 66.9], [23.65, 66.4], [24.15, 65.83], [24.6, 65.7], [25.3, 65.3], [25.4, 64.95], [24.6, 64.75],
  [24.0, 64.4], [23.2, 63.9], [22.4, 63.5], [21.6, 63.25], [21.2, 62.9], [21.4, 62.3], [21.45, 61.7],
  [21.5, 61.2], [21.4, 60.9], [22.0, 60.5], [22.6, 60.25], [22.9, 59.85], [23.6, 60.0], [24.3, 60.05],
  [25.0, 60.18], [25.8, 60.3], [26.6, 60.42], [27.2, 60.52],
];
export const CITIES = [
  { name: 'Helsinki', lon: 24.94, lat: 60.17, capital: true },
  { name: 'Hamina', lon: 27.2, lat: 60.57 },
  { name: 'Lappeenranta', lon: 28.19, lat: 61.06 },
  { name: 'Joensuu', lon: 29.76, lat: 62.6 },
  { name: 'Kajaani', lon: 27.73, lat: 64.23 },
  { name: 'Oulu', lon: 25.47, lat: 65.01 },
  { name: 'Kemijärvi', lon: 27.4, lat: 66.71 },
  { name: 'Rovaniemi', lon: 25.73, lat: 66.5 },
  { name: 'Ivalo', lon: 27.54, lat: 68.66 },
];
