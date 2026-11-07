/**
 * Catégories, attributs, marques. Hiérarchie extensible et administrable (/admin/configuration).
 * Les véhicules, l'immobilier et les services sont référencés mais inactifs et non
 * transactionnels : ils ne font pas partie du MVP transactionnel.
 */

export type AttrDef = {
  key: string;
  label: string;
  type: "TEXT" | "NUMBER" | "SELECT" | "BOOLEAN";
  options?: readonly string[];
  unit?: string;
  isRequired?: boolean;
  isFilterable?: boolean;
};

export type CategoryDef = {
  slug: string;
  name: string;
  icon?: string;
  description?: string;
  isActive?: boolean;
  isTransactional?: boolean;
  requiresReview?: boolean;
  isProhibited?: boolean;
  conditionRequired?: boolean;
  attributes?: readonly AttrDef[];
  children?: readonly CategoryDef[];
};

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Taille unique"] as const;
const SHOE_SIZES = ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47"] as const;
const COLORS = ["Noir", "Blanc", "Gris", "Bleu", "Rouge", "Vert", "Jaune", "Rose", "Marron", "Beige", "Violet", "Orange", "Multicolore"] as const;

const color: AttrDef = { key: "color", label: "Couleur", type: "SELECT", options: COLORS, isFilterable: true };
const size: AttrDef = { key: "size", label: "Taille", type: "SELECT", options: SIZES, isFilterable: true };

export const CATEGORIES: readonly CategoryDef[] = [
  {
    slug: "mode",
    name: "Mode et accessoires",
    icon: "shirt",
    children: [
      { slug: "mode-femme", name: "Vêtements femme", icon: "shirt", attributes: [size, color] },
      { slug: "mode-homme", name: "Vêtements homme", icon: "shirt", attributes: [size, color] },
      { slug: "tenues-traditionnelles", name: "Tenues traditionnelles", icon: "sparkles", description: "Robes kabyles, burnous, karakou, gandouras…", attributes: [size, color, { key: "region_style", label: "Style régional", type: "TEXT" }] },
      { slug: "sacs-accessoires", name: "Sacs et accessoires", icon: "shopping-bag", attributes: [color] },
      { slug: "bijoux-montres", name: "Bijoux et montres", icon: "watch", attributes: [{ key: "material", label: "Matière", type: "SELECT", options: ["Argent", "Or", "Plaqué", "Acier", "Fantaisie", "Autre"], isFilterable: true }] },
    ],
  },
  {
    slug: "chaussures",
    name: "Chaussures",
    icon: "footprints",
    attributes: [
      { key: "shoe_size", label: "Pointure", type: "SELECT", options: SHOE_SIZES, isRequired: true, isFilterable: true },
      { key: "gender", label: "Pour", type: "SELECT", options: ["Femme", "Homme", "Mixte", "Enfant"], isFilterable: true },
      color,
    ],
  },
  {
    slug: "smartphones",
    name: "Smartphones et téléphonie",
    icon: "smartphone",
    attributes: [
      { key: "storage", label: "Stockage", type: "SELECT", options: ["32 Go", "64 Go", "128 Go", "256 Go", "512 Go", "1 To"], isFilterable: true },
      { key: "unlocked", label: "Débloqué tout opérateur", type: "BOOLEAN", isFilterable: true },
      { key: "battery_health", label: "État de la batterie", type: "NUMBER", unit: "%" },
      color,
    ],
  },
  {
    slug: "informatique",
    name: "Informatique",
    icon: "laptop",
    children: [
      { slug: "ordinateurs-portables", name: "Ordinateurs portables", icon: "laptop", attributes: [{ key: "ram", label: "Mémoire vive", type: "SELECT", options: ["4 Go", "8 Go", "16 Go", "32 Go", "64 Go"], isFilterable: true }, { key: "storage", label: "Stockage", type: "TEXT" }, { key: "screen", label: "Écran", type: "NUMBER", unit: "pouces" }] },
      { slug: "ordinateurs-fixes", name: "Ordinateurs fixes", icon: "monitor" },
      { slug: "tablettes", name: "Tablettes", icon: "smartphone" },
      { slug: "ecrans-peripheriques", name: "Écrans et périphériques", icon: "monitor" },
    ],
  },
  {
    slug: "gaming",
    name: "Gaming",
    icon: "gamepad-2",
    children: [
      { slug: "consoles", name: "Consoles", icon: "gamepad-2", attributes: [{ key: "platform", label: "Plateforme", type: "SELECT", options: ["PlayStation", "Xbox", "Nintendo", "PC", "Rétro", "Autre"], isFilterable: true }, { key: "complete", label: "Complet en boîte", type: "BOOLEAN" }] },
      { slug: "jeux-video", name: "Jeux vidéo", icon: "gamepad-2", attributes: [{ key: "platform", label: "Plateforme", type: "SELECT", options: ["PlayStation 5", "PlayStation 4", "Xbox Series", "Nintendo Switch", "PC", "Rétro", "Autre"], isRequired: true, isFilterable: true }] },
      { slug: "accessoires-gaming", name: "Accessoires gaming", icon: "headphones" },
    ],
  },
  {
    slug: "electronique",
    name: "Électronique",
    icon: "tv",
    children: [
      { slug: "audio-hifi", name: "Audio et hi-fi", icon: "headphones" },
      { slug: "photo-video", name: "Photo et vidéo", icon: "camera" },
      { slug: "tv-video", name: "TV et vidéoprojecteurs", icon: "tv" },
    ],
  },
  {
    slug: "maison",
    name: "Maison",
    icon: "house",
    children: [
      { slug: "mobilier", name: "Mobilier", icon: "sofa", attributes: [{ key: "material", label: "Matière", type: "TEXT" }] },
      { slug: "decoration", name: "Décoration", icon: "lamp" },
      { slug: "cuisine", name: "Cuisine et arts de la table", icon: "chef-hat" },
      { slug: "electromenager", name: "Électroménager", icon: "coffee" },
      { slug: "jardin-bricolage", name: "Jardin et bricolage", icon: "sprout" },
    ],
  },
  {
    slug: "sport",
    name: "Sport et loisirs",
    icon: "bike",
    children: [
      { slug: "velos", name: "Vélos", icon: "bike", attributes: [{ key: "frame_size", label: "Taille du cadre", type: "SELECT", options: ["XS", "S", "M", "L", "XL"], isFilterable: true }] },
      { slug: "fitness", name: "Fitness et musculation", icon: "dumbbell" },
      { slug: "camping-randonnee", name: "Camping et randonnée", icon: "tent" },
    ],
  },
  {
    slug: "livres",
    name: "Livres",
    icon: "book-open",
    attributes: [
      { key: "author", label: "Auteur", type: "TEXT" },
      { key: "language", label: "Langue", type: "SELECT", options: ["Français", "Arabe", "Tamazight", "Anglais", "Autre"], isFilterable: true },
    ],
  },
  {
    slug: "musique",
    name: "Musique",
    icon: "music",
    children: [
      { slug: "vinyles", name: "Vinyles", icon: "disc-3", attributes: [{ key: "format", label: "Format", type: "SELECT", options: ["33 tours", "45 tours", "Maxi 45 tours", "Coffret"], isFilterable: true }, { key: "artist", label: "Artiste", type: "TEXT" }] },
      { slug: "cd-cassettes", name: "CD et cassettes", icon: "disc-3" },
      { slug: "instruments", name: "Instruments de musique", icon: "guitar" },
    ],
  },
  {
    slug: "collections",
    name: "Collections",
    icon: "stamp",
    children: [
      { slug: "timbres", name: "Timbres", icon: "stamp" },
      { slug: "monnaies-billets", name: "Monnaies et billets de collection", icon: "gem", requiresReview: true, description: "Annonces vérifiées avant publication (risque de contrefaçon)." },
      { slug: "figurines-cartes", name: "Figurines et cartes à collectionner", icon: "puzzle" },
    ],
  },
  {
    slug: "artisanat",
    name: "Artisanat",
    icon: "amphora",
    children: [
      { slug: "poterie", name: "Poterie", icon: "amphora" },
      { slug: "bijoux-artisanaux", name: "Bijoux artisanaux", icon: "gem", attributes: [{ key: "material", label: "Matière", type: "SELECT", options: ["Argent", "Argent émaillé", "Corail", "Laiton", "Autre"], isFilterable: true }] },
      { slug: "tapis-tissage", name: "Tapis et tissage", icon: "palette", attributes: [{ key: "dimensions", label: "Dimensions", type: "TEXT" }] },
      { slug: "bois-vannerie", name: "Bois et vannerie", icon: "palette" },
    ],
  },
  {
    slug: "produits-culturels",
    name: "Produits culturels",
    icon: "drama",
    children: [
      { slug: "films-series", name: "Films et séries", icon: "tv" },
      { slug: "art-oeuvres", name: "Art et œuvres", icon: "palette" },
    ],
  },
  {
    slug: "enfants",
    name: "Enfants",
    icon: "baby",
    children: [
      { slug: "vetements-enfant", name: "Vêtements enfant", icon: "shirt", attributes: [{ key: "age", label: "Âge", type: "SELECT", options: ["0-6 mois", "6-12 mois", "1-2 ans", "3-4 ans", "5-6 ans", "7-8 ans", "9-10 ans", "11-12 ans", "13-14 ans"], isFilterable: true }] },
      { slug: "jouets", name: "Jouets et jeux", icon: "blocks" },
      { slug: "puericulture", name: "Puériculture", icon: "baby", requiresReview: true, description: "Articles de sécurité (sièges auto, poussettes) vérifiés avant publication." },
    ],
  },
  {
    slug: "beaute",
    name: "Beauté et bien-être",
    icon: "flower-2",
    requiresReview: true,
    description: "Produits neufs et scellés uniquement ; annonces vérifiées avant publication.",
  },
  { slug: "autres", name: "Autres objets", icon: "package" },

  // Hors MVP transactionnel : préparés, inactifs.
  { slug: "vehicules", name: "Véhicules", icon: "car", isActive: false, isTransactional: false, conditionRequired: false },
  { slug: "immobilier", name: "Immobilier", icon: "building-2", isActive: false, isTransactional: false, conditionRequired: false },
  { slug: "services", name: "Services", icon: "briefcase", isActive: false, isTransactional: false, conditionRequired: false },

  // Catégories interdites : référencées pour la politique et la modération, jamais publiables.
  { slug: "interdit-armes", name: "Armes et munitions", icon: "ban", isActive: false, isProhibited: true },
  { slug: "interdit-medicaments", name: "Médicaments et produits de santé", icon: "ban", isActive: false, isProhibited: true },
  { slug: "interdit-animaux", name: "Animaux vivants", icon: "ban", isActive: false, isProhibited: true },
  { slug: "interdit-contrefacons", name: "Contrefaçons et répliques", icon: "ban", isActive: false, isProhibited: true },
];

export const BRANDS = [
  "Apple", "Samsung", "Xiaomi", "Huawei", "Oppo", "Google", "Sony", "Microsoft", "Nintendo", "HP", "Dell", "Lenovo",
  "Asus", "Acer", "Canon", "Nikon", "Fujifilm", "Bose", "JBL", "Technics", "Philips", "Moulinex", "Seb", "Ikea",
  "Nike", "Adidas", "Puma", "New Balance", "Levi's", "Zara", "Decathlon", "Btwin", "Lego", "Playmobil",
] as const;

export { REVIEW_KEYWORDS } from "@/lib/config/moderation";
