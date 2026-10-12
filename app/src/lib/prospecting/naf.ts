// NAF rev. 2 divisions (first two digits of the code), French labels. Pure.
// The registry gives sub-classes ("62.01Z"); the division is enough to describe a sector
// and to turn it into search words for the provider.

export const NAF_DIVISIONS: Record<string, string> = {
  "01": "Agriculture",
  "02": "Sylviculture",
  "03": "Pêche et aquaculture",
  "05": "Extraction de houille",
  "06": "Extraction d'hydrocarbures",
  "07": "Extraction de minerais métalliques",
  "08": "Autres industries extractives",
  "09": "Services de soutien aux industries extractives",
  "10": "Industries alimentaires",
  "11": "Fabrication de boissons",
  "12": "Fabrication de produits à base de tabac",
  "13": "Fabrication de textiles",
  "14": "Industrie de l'habillement",
  "15": "Industrie du cuir et de la chaussure",
  "16": "Travail du bois",
  "17": "Industrie du papier et du carton",
  "18": "Imprimerie",
  "19": "Cokéfaction et raffinage",
  "20": "Industrie chimique",
  "21": "Industrie pharmaceutique",
  "22": "Fabrication de produits en caoutchouc et en plastique",
  "23": "Fabrication de produits minéraux non métalliques",
  "24": "Métallurgie",
  "25": "Fabrication de produits métalliques",
  "26": "Fabrication de produits informatiques et électroniques",
  "27": "Fabrication d'équipements électriques",
  "28": "Fabrication de machines et équipements",
  "29": "Industrie automobile",
  "30": "Fabrication d'autres matériels de transport",
  "31": "Fabrication de meubles",
  "32": "Autres industries manufacturières",
  "33": "Réparation et installation de machines",
  "35": "Production et distribution d'énergie",
  "36": "Captage et distribution d'eau",
  "37": "Collecte et traitement des eaux usées",
  "38": "Gestion des déchets",
  "39": "Dépollution",
  "41": "Construction de bâtiments",
  "42": "Génie civil",
  "43": "Travaux de construction spécialisés",
  "45": "Commerce et réparation automobile",
  "46": "Commerce de gros",
  "47": "Commerce de détail",
  "49": "Transports terrestres",
  "50": "Transports par eau",
  "51": "Transports aériens",
  "52": "Entreposage et logistique",
  "53": "Activités de poste et de courrier",
  "55": "Hébergement",
  "56": "Restauration",
  "58": "Édition",
  "59": "Production audiovisuelle et musicale",
  "60": "Radio et télévision",
  "61": "Télécommunications",
  "62": "Programmation et conseil informatique",
  "63": "Services d'information",
  "64": "Services financiers",
  "65": "Assurance",
  "66": "Auxiliaires de services financiers et d'assurance",
  "68": "Activités immobilières",
  "69": "Activités juridiques et comptables",
  "70": "Conseil de gestion",
  "71": "Architecture et ingénierie",
  "72": "Recherche-développement scientifique",
  "73": "Publicité et études de marché",
  "74": "Autres activités spécialisées, scientifiques et techniques",
  "75": "Activités vétérinaires",
  "77": "Location et location-bail",
  "78": "Activités liées à l'emploi",
  "79": "Agences de voyage",
  "80": "Enquêtes et sécurité",
  "81": "Services relatifs aux bâtiments",
  "82": "Services administratifs de soutien aux entreprises",
  "84": "Administration publique",
  "85": "Enseignement",
  "86": "Activités pour la santé humaine",
  "87": "Hébergement médico-social",
  "88": "Action sociale sans hébergement",
  "90": "Activités créatives et artistiques",
  "91": "Bibliothèques, musées et culture",
  "92": "Jeux de hasard",
  "93": "Activités sportives et de loisirs",
  "94": "Activités des organisations associatives",
  "95": "Réparation d'ordinateurs et de biens personnels",
  "96": "Autres services personnels",
  "97": "Activités des ménages employeurs",
  "98": "Activités des ménages pour usage propre",
  "99": "Activités extra-territoriales",
};

const NAF_CODE = /^\d{2}(\.\d{1,2}[A-Z]?)?$/;

/** "62.01Z", "6201Z", "62" → "62.01Z", "62.01Z", "62"; anything else → null. */
export function normalizeNafCode(value: string) {
  const compact = value.trim().toUpperCase().replace(/\s/g, "");
  const dotted = /^\d{4}[A-Z]?$/.test(compact) ? `${compact.slice(0, 2)}.${compact.slice(2)}` : compact;
  return NAF_CODE.test(dotted) ? dotted : null;
}

export function nafDivision(code: string) {
  return code.slice(0, 2);
}

export function nafLabel(code: string) {
  return NAF_DIVISIONS[nafDivision(code)] ?? null;
}

/**
 * Closest LinkedIn industry for each division: the words Apollo's organization tags understand
 * (French NAF labels match nothing there). Checked on a few divisions on 12/10/2026.
 */
export const NAF_INDUSTRIES_EN: Record<string, string> = {
  "01": "farming", "02": "forestry", "03": "fishery", "05": "mining & metals", "06": "oil & energy",
  "07": "mining & metals", "08": "mining & metals", "09": "oil & energy",
  "10": "food production", "11": "wine and spirits", "12": "tobacco", "13": "textiles", "14": "apparel & fashion",
  "15": "apparel & fashion", "16": "building materials", "17": "paper & forest products", "18": "printing",
  "19": "oil & energy", "20": "chemicals", "21": "pharmaceuticals", "22": "plastics", "23": "building materials",
  "24": "mining & metals", "25": "machinery", "26": "computer hardware", "27": "electrical/electronic manufacturing",
  "28": "machinery", "29": "automotive", "30": "aviation & aerospace", "31": "furniture", "32": "consumer goods",
  "33": "industrial automation", "35": "utilities", "36": "utilities", "37": "environmental services",
  "38": "environmental services", "39": "environmental services",
  "41": "construction", "42": "civil engineering", "43": "construction",
  "45": "automotive", "46": "wholesale", "47": "retail",
  "49": "transportation/trucking/railroad", "50": "maritime", "51": "airlines/aviation",
  "52": "logistics and supply chain", "53": "package/freight delivery",
  "55": "hospitality", "56": "restaurants",
  "58": "publishing", "59": "media production", "60": "broadcast media", "61": "telecommunications",
  "62": "information technology & services", "63": "internet",
  "64": "financial services", "65": "insurance", "66": "financial services",
  "68": "real estate", "69": "accounting", "70": "management consulting", "71": "architecture & planning",
  "72": "research", "73": "marketing & advertising", "74": "design", "75": "veterinary",
  "77": "leisure, travel & tourism", "78": "staffing and recruiting", "79": "leisure, travel & tourism",
  "80": "security and investigations", "81": "facilities services", "82": "outsourcing/offshoring",
  "84": "government administration", "85": "education management", "86": "hospital & health care",
  "87": "hospital & health care", "88": "individual & family services", "90": "performing arts",
  "91": "museums and institutions", "92": "gambling & casinos", "93": "sports", "94": "nonprofit organization management",
  "95": "consumer services", "96": "consumer services", "97": "consumer services", "98": "consumer services",
  "99": "international affairs",
};

export function nafIndustryEn(code: string) {
  return NAF_INDUSTRIES_EN[nafDivision(code)] ?? null;
}
