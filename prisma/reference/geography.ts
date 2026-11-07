/**
 * Référentiels géographiques versionnés. Ils sont chargés en base par le seed et
 * restent administrables : aucun nombre de wilayas ou de départements n'est figé dans
 * le code applicatif. Chaque jeu porte une version ; une mise à jour du découpage
 * administratif = nouveau jeu versionné + migration des données (voir docs/DATABASE.md).
 *
 * ⚠️ À vérifier avant production auprès des sources officielles :
 * - France : Code officiel géographique (INSEE).
 * - Algérie : Journal officiel de la République algérienne (le découpage administratif
 *   évolue ; ce jeu reflète les 58 wilayas créées par la loi de 2019).
 */

export const GEO_DATASETS = { FR: "FR-COG-2026-dep", DZ: "DZ-JORA-2019-58" } as const;

export const COUNTRIES = [
  { code: "FR", name: "France", nativeName: "France", currency: "EUR", phonePrefix: "+33", regionLabel: "Département", isActive: true, checkoutMode: "INTEGRATED", payoutsEnabled: false, sortOrder: 1 },
  { code: "DZ", name: "Algérie", nativeName: "الجزائر", currency: "DZD", phonePrefix: "+213", regionLabel: "Wilaya", isActive: true, checkoutMode: "CLASSIFIED_ONLY", payoutsEnabled: false, sortOrder: 2 },
  // Pays de la diaspora préparés, non ouverts (activation après validation opérationnelle et juridique).
  { code: "BE", name: "Belgique", nativeName: "Belgique", currency: "EUR", phonePrefix: "+32", regionLabel: "Province", isActive: false, checkoutMode: "DISABLED", payoutsEnabled: false, sortOrder: 10 },
  { code: "CA", name: "Canada", nativeName: "Canada", currency: "CAD", phonePrefix: "+1", regionLabel: "Province", isActive: false, checkoutMode: "DISABLED", payoutsEnabled: false, sortOrder: 11 },
  { code: "CH", name: "Suisse", nativeName: "Suisse", currency: "CHF", phonePrefix: "+41", regionLabel: "Canton", isActive: false, checkoutMode: "DISABLED", payoutsEnabled: false, sortOrder: 12 },
  { code: "GB", name: "Royaume-Uni", nativeName: "United Kingdom", currency: "GBP", phonePrefix: "+44", regionLabel: "Région", isActive: false, checkoutMode: "DISABLED", payoutsEnabled: false, sortOrder: 13 },
] as const;

/** Départements français (code officiel, nom). */
export const FR_DEPARTMENTS: readonly (readonly [string, string])[] = [
  ["01", "Ain"], ["02", "Aisne"], ["03", "Allier"], ["04", "Alpes-de-Haute-Provence"], ["05", "Hautes-Alpes"],
  ["06", "Alpes-Maritimes"], ["07", "Ardèche"], ["08", "Ardennes"], ["09", "Ariège"], ["10", "Aube"], ["11", "Aude"],
  ["12", "Aveyron"], ["13", "Bouches-du-Rhône"], ["14", "Calvados"], ["15", "Cantal"], ["16", "Charente"],
  ["17", "Charente-Maritime"], ["18", "Cher"], ["19", "Corrèze"], ["2A", "Corse-du-Sud"], ["2B", "Haute-Corse"],
  ["21", "Côte-d'Or"], ["22", "Côtes-d'Armor"], ["23", "Creuse"], ["24", "Dordogne"], ["25", "Doubs"], ["26", "Drôme"],
  ["27", "Eure"], ["28", "Eure-et-Loir"], ["29", "Finistère"], ["30", "Gard"], ["31", "Haute-Garonne"], ["32", "Gers"],
  ["33", "Gironde"], ["34", "Hérault"], ["35", "Ille-et-Vilaine"], ["36", "Indre"], ["37", "Indre-et-Loire"],
  ["38", "Isère"], ["39", "Jura"], ["40", "Landes"], ["41", "Loir-et-Cher"], ["42", "Loire"], ["43", "Haute-Loire"],
  ["44", "Loire-Atlantique"], ["45", "Loiret"], ["46", "Lot"], ["47", "Lot-et-Garonne"], ["48", "Lozère"],
  ["49", "Maine-et-Loire"], ["50", "Manche"], ["51", "Marne"], ["52", "Haute-Marne"], ["53", "Mayenne"],
  ["54", "Meurthe-et-Moselle"], ["55", "Meuse"], ["56", "Morbihan"], ["57", "Moselle"], ["58", "Nièvre"], ["59", "Nord"],
  ["60", "Oise"], ["61", "Orne"], ["62", "Pas-de-Calais"], ["63", "Puy-de-Dôme"], ["64", "Pyrénées-Atlantiques"],
  ["65", "Hautes-Pyrénées"], ["66", "Pyrénées-Orientales"], ["67", "Bas-Rhin"], ["68", "Haut-Rhin"], ["69", "Rhône"],
  ["70", "Haute-Saône"], ["71", "Saône-et-Loire"], ["72", "Sarthe"], ["73", "Savoie"], ["74", "Haute-Savoie"],
  ["75", "Paris"], ["76", "Seine-Maritime"], ["77", "Seine-et-Marne"], ["78", "Yvelines"], ["79", "Deux-Sèvres"],
  ["80", "Somme"], ["81", "Tarn"], ["82", "Tarn-et-Garonne"], ["83", "Var"], ["84", "Vaucluse"], ["85", "Vendée"],
  ["86", "Vienne"], ["87", "Haute-Vienne"], ["88", "Vosges"], ["89", "Yonne"], ["90", "Territoire de Belfort"],
  ["91", "Essonne"], ["92", "Hauts-de-Seine"], ["93", "Seine-Saint-Denis"], ["94", "Val-de-Marne"], ["95", "Val-d'Oise"],
  ["971", "Guadeloupe"], ["972", "Martinique"], ["973", "Guyane"], ["974", "La Réunion"], ["976", "Mayotte"],
];

/** Wilayas d'Algérie (code officiel, nom usuel en français). */
export const DZ_WILAYAS: readonly (readonly [string, string])[] = [
  ["01", "Adrar"], ["02", "Chlef"], ["03", "Laghouat"], ["04", "Oum El Bouaghi"], ["05", "Batna"], ["06", "Béjaïa"],
  ["07", "Biskra"], ["08", "Béchar"], ["09", "Blida"], ["10", "Bouira"], ["11", "Tamanrasset"], ["12", "Tébessa"],
  ["13", "Tlemcen"], ["14", "Tiaret"], ["15", "Tizi Ouzou"], ["16", "Alger"], ["17", "Djelfa"], ["18", "Jijel"],
  ["19", "Sétif"], ["20", "Saïda"], ["21", "Skikda"], ["22", "Sidi Bel Abbès"], ["23", "Annaba"], ["24", "Guelma"],
  ["25", "Constantine"], ["26", "Médéa"], ["27", "Mostaganem"], ["28", "M'Sila"], ["29", "Mascara"], ["30", "Ouargla"],
  ["31", "Oran"], ["32", "El Bayadh"], ["33", "Illizi"], ["34", "Bordj Bou Arréridj"], ["35", "Boumerdès"],
  ["36", "El Tarf"], ["37", "Tindouf"], ["38", "Tissemsilt"], ["39", "El Oued"], ["40", "Khenchela"],
  ["41", "Souk Ahras"], ["42", "Tipaza"], ["43", "Mila"], ["44", "Aïn Defla"], ["45", "Naâma"], ["46", "Aïn Témouchent"],
  ["47", "Ghardaïa"], ["48", "Relizane"], ["49", "Timimoun"], ["50", "Bordj Badji Mokhtar"], ["51", "Ouled Djellal"],
  ["52", "Béni Abbès"], ["53", "In Salah"], ["54", "In Guezzam"], ["55", "Touggourt"], ["56", "Djanet"],
  ["57", "El M'Ghair"], ["58", "El Meniaa"],
];

/**
 * Sélection de villes (non exhaustive, extensible par l'administration ou import CSV).
 * [pays, code région, nom, variantes de recherche supplémentaires, populaire]
 * Les variantes incluent les noms kabyles et les graphies usuelles (Bgayet, Tizi Wezzu, Tubiret…).
 */
export const CITIES: readonly (readonly [string, string, string, readonly string[], boolean])[] = [
  // France
  ["FR", "75", "Paris", [], true],
  ["FR", "13", "Marseille", [], true],
  ["FR", "13", "Aix-en-Provence", ["aix"], false],
  ["FR", "69", "Lyon", [], true],
  ["FR", "69", "Villeurbanne", [], false],
  ["FR", "31", "Toulouse", [], true],
  ["FR", "06", "Nice", [], true],
  ["FR", "44", "Nantes", [], true],
  ["FR", "67", "Strasbourg", [], true],
  ["FR", "34", "Montpellier", [], true],
  ["FR", "33", "Bordeaux", [], true],
  ["FR", "59", "Lille", [], true],
  ["FR", "59", "Roubaix", [], false],
  ["FR", "35", "Rennes", [], false],
  ["FR", "38", "Grenoble", [], true],
  ["FR", "42", "Saint-Étienne", ["st etienne"], false],
  ["FR", "83", "Toulon", [], false],
  ["FR", "63", "Clermont-Ferrand", [], false],
  ["FR", "57", "Metz", [], false],
  ["FR", "68", "Mulhouse", [], false],
  ["FR", "84", "Avignon", [], false],
  ["FR", "93", "Saint-Denis", ["st denis"], true],
  ["FR", "93", "Montreuil", [], false],
  ["FR", "93", "Aubervilliers", [], false],
  ["FR", "92", "Nanterre", [], false],
  ["FR", "92", "Boulogne-Billancourt", ["boulogne"], false],
  ["FR", "94", "Créteil", [], false],
  ["FR", "94", "Vitry-sur-Seine", ["vitry"], false],
  ["FR", "95", "Argenteuil", [], false],
  ["FR", "95", "Cergy", [], false],
  ["FR", "91", "Évry-Courcouronnes", ["evry"], false],
  ["FR", "78", "Versailles", [], false],
  // Algérie
  ["DZ", "16", "Alger", ["algiers", "dzayer", "el djazair", "lezzayer"], true],
  ["DZ", "16", "Bab Ezzouar", [], false],
  ["DZ", "16", "Chéraga", ["cheraga"], false],
  ["DZ", "15", "Tizi Ouzou", ["tizi wezzu", "tizi-ouzou", "tizi"], true],
  ["DZ", "15", "Azazga", ["azazga"], false],
  ["DZ", "15", "Draâ Ben Khedda", ["draa ben khedda", "dbk", "mirabeau"], false],
  ["DZ", "15", "Larbaâ Nath Irathen", ["larbaa nath irathen", "fort national", "aarvaa n at yiraten"], false],
  ["DZ", "15", "Aïn El Hammam", ["ain el hammam", "michelet"], false],
  ["DZ", "15", "Tigzirt", [], false],
  ["DZ", "15", "Azeffoun", ["azeffun"], false],
  ["DZ", "15", "Maâtkas", ["maatkas"], false],
  ["DZ", "06", "Béjaïa", ["bgayet", "bougie", "vgayet", "bejaia"], true],
  ["DZ", "06", "Akbou", ["akbou"], false],
  ["DZ", "06", "Amizour", [], false],
  ["DZ", "06", "Sidi Aïch", ["sidi aich"], false],
  ["DZ", "06", "Kherrata", [], false],
  ["DZ", "10", "Bouira", ["tubiret", "tubirett", "tuvirett"], true],
  ["DZ", "10", "Lakhdaria", ["palestro"], false],
  ["DZ", "35", "Boumerdès", ["boumerdes"], false],
  ["DZ", "35", "Dellys", ["dellys", "dellis"], false],
  ["DZ", "35", "Bordj Menaïel", ["bordj menaiel"], false],
  ["DZ", "19", "Sétif", ["stif", "setif"], true],
  ["DZ", "31", "Oran", ["wahran"], true],
  ["DZ", "25", "Constantine", ["qsentina"], true],
  ["DZ", "23", "Annaba", ["bone"], false],
  ["DZ", "09", "Blida", [], false],
  ["DZ", "05", "Batna", [], false],
  ["DZ", "13", "Tlemcen", [], false],
  ["DZ", "34", "Bordj Bou Arréridj", ["bba", "bordj bou arreridj"], false],
];
