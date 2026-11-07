/**
 * Jeu de démonstration — ENTIÈREMENT FICTIF.
 * Personnes, boutiques, annonces, prix et entreprises sont inventés. Toute ressemblance
 * avec des personnes ou entreprises existantes serait fortuite. Les marques citées le
 * sont uniquement pour décrire des articles d'occasion (usage descriptif).
 */

export const DEMO_PASSWORD = "DemoMarket2026!";

export type DemoUser = {
  key: string;
  email: string;
  name: string;
  handle: string;
  country: "FR" | "DZ";
  region: string;
  city: string;
  bio?: string;
  roles?: ("MODERATOR" | "SUPPORT" | "FINANCE" | "ADMIN" | "SUPER_ADMIN")[];
  sellerType?: "INDIVIDUAL" | "BUSINESS";
  identityVerified?: boolean;
  business?: { legalName: string; registrationNumber: string; vatNumber?: string; address: string; postalCode: string };
};

export const DEMO_USERS: DemoUser[] = [
  { key: "admin", email: "admin@demo.tamurt.local", name: "Admin démo", handle: "admin-demo", country: "FR", region: "75", city: "Paris", roles: ["SUPER_ADMIN", "ADMIN"] },
  { key: "moderator", email: "moderation@demo.tamurt.local", name: "Modération démo", handle: "moderation-demo", country: "FR", region: "13", city: "Marseille", roles: ["MODERATOR"] },
  { key: "support", email: "support@demo.tamurt.local", name: "Support démo", handle: "support-demo", country: "FR", region: "69", city: "Lyon", roles: ["SUPPORT"] },
  { key: "finance", email: "finance@demo.tamurt.local", name: "Finance démo", handle: "finance-demo", country: "FR", region: "75", city: "Paris", roles: ["FINANCE"] },
  {
    key: "thiziri",
    email: "thiziri@demo.tamurt.local",
    name: "Atelier Thiziri",
    handle: "atelier-thiziri",
    country: "DZ",
    region: "15",
    city: "Tizi Ouzou",
    bio: "Couturière à Tizi Ouzou (profil fictif). Robes kabyles brodées main, sur mesure ou prêtes à porter.",
    identityVerified: true,
  },
  {
    key: "vinyles",
    email: "vinyles@demo.tamurt.local",
    name: "Vinyles du Vieux-Port",
    handle: "vinyles-du-vieux-port",
    country: "FR",
    region: "13",
    city: "Marseille",
    bio: "Collectionneur passionné (profil fictif) : chaâbi, musique kabyle, jazz et soul. Disques nettoyés et testés.",
  },
  {
    key: "techlyon",
    email: "tech@demo.tamurt.local",
    name: "Tech Occasion Lyon",
    handle: "tech-occasion-lyon",
    country: "FR",
    region: "69",
    city: "Lyon",
    bio: "Revendeur professionnel fictif de smartphones et ordinateurs reconditionnés.",
    sellerType: "BUSINESS",
    identityVerified: true,
    business: { legalName: "Tech Occasion Lyon SARL (entreprise fictive)", registrationNumber: "000000000", vatNumber: "FR00000000000", address: "1 rue de l'Exemple", postalCode: "69000" },
  },
  {
    key: "yanis",
    email: "yanis@demo.tamurt.local",
    name: "Yanis Gaming",
    handle: "yanis-gaming",
    country: "FR",
    region: "13",
    city: "Marseille",
    bio: "Joueur depuis toujours (profil fictif). Consoles et jeux en très bon état, envoi soigné.",
  },
  {
    key: "lina",
    email: "lina@demo.tamurt.local",
    name: "Lina Dressing",
    handle: "lina-dressing",
    country: "FR",
    region: "93",
    city: "Montreuil",
    bio: "Je vide mon dressing (profil fictif) : vêtements et chaussures portés avec soin.",
  },
  {
    key: "bgayet",
    email: "bgayet@demo.tamurt.local",
    name: "Maison Bgayet",
    handle: "maison-bgayet",
    country: "DZ",
    region: "06",
    city: "Béjaïa",
    bio: "Artisanat et objets de maison de Béjaïa (profil fictif).",
  },
  { key: "kamel", email: "acheteur@demo.tamurt.local", name: "Kamel", handle: "kamel-m", country: "FR", region: "13", city: "Marseille" },
  { key: "sonia", email: "acheteuse@demo.tamurt.local", name: "Sonia", handle: "sonia-b", country: "DZ", region: "06", city: "Béjaïa" },
];

export type DemoListing = {
  seller: string;
  title: string;
  description: string;
  category: string;
  brand?: string;
  condition: "NEW_WITH_TAGS" | "NEW_WITHOUT_TAGS" | "VERY_GOOD" | "GOOD" | "FAIR" | "FOR_PARTS";
  price: number;
  currency: "EUR" | "DZD";
  region: string;
  city: string;
  delivery: ("HAND_DELIVERY" | "NATIONAL_SHIPPING" | "TAMURT_TRANSPORT")[];
  size?: "XS" | "S" | "M" | "L" | "XL";
  weight?: number;
  attributes?: Record<string, string | number | boolean>;
  crossBorder?: boolean;
  quantity?: number;
  icon: string;
  hue: number;
  images?: number;
  status?: "ACTIVE" | "PENDING_REVIEW" | "SOLD" | "RESERVED";
  ageDays: number;
};

export const DEMO_LISTINGS: DemoListing[] = [
  // ── France ──
  {
    seller: "yanis", title: "Console PS5 édition standard + 2 manettes", category: "consoles", brand: "Sony", condition: "VERY_GOOD", price: 380, currency: "EUR", region: "13", city: "Marseille",
    description: "PS5 lecteur disque achetée en 2023, très peu servie. Livrée avec deux manettes DualSense (une blanche, une noire), câbles d'origine et carton. Aucune rayure, ventilateur nettoyé. Réinitialisée aux paramètres d'usine.",
    delivery: ["HAND_DELIVERY", "NATIONAL_SHIPPING", "TAMURT_TRANSPORT"], size: "L", weight: 6500, attributes: { platform: "PlayStation", complete: true }, crossBorder: true, icon: "gamepad-2", hue: 210, images: 3, ageDays: 1,
  },
  {
    seller: "yanis", title: "Nintendo Switch OLED blanche", category: "consoles", brand: "Nintendo", condition: "VERY_GOOD", price: 230, currency: "EUR", region: "13", city: "Marseille",
    description: "Switch modèle OLED, écran protégé par un verre trempé depuis le premier jour. Dock, Joy-Con et chargeur fournis. Boîte d'origine.",
    delivery: ["HAND_DELIVERY", "NATIONAL_SHIPPING"], size: "M", weight: 1800, attributes: { platform: "Nintendo", complete: true }, icon: "gamepad-2", hue: 0, images: 2, ageDays: 3,
  },
  {
    seller: "yanis", title: "Lot de 6 jeux PS4 (FIFA, GTA V, Spider-Man…)", category: "jeux-video", condition: "GOOD", price: 60, currency: "EUR", region: "13", city: "Marseille",
    description: "Six jeux en boîte, disques testés. Compatibles PS5 avec lecteur. Vente en lot uniquement.",
    delivery: ["HAND_DELIVERY", "NATIONAL_SHIPPING"], size: "S", weight: 700, attributes: { platform: "PlayStation 4" }, icon: "gamepad-2", hue: 265, images: 1, ageDays: 9,
  },
  {
    seller: "techlyon", title: "iPhone 13 128 Go bleu — batterie 89 %", category: "smartphones", brand: "Apple", condition: "VERY_GOOD", price: 390, currency: "EUR", region: "69", city: "Lyon",
    description: "Reconditionné dans notre atelier : tests complets, batterie à 89 %, débloqué tout opérateur. Facture fournie (vendeur professionnel). Garantie légale de conformité applicable.",
    delivery: ["NATIONAL_SHIPPING"], size: "S", weight: 400, quantity: 3, attributes: { storage: "128 Go", unlocked: true, battery_health: 89, color: "Bleu" }, icon: "smartphone", hue: 205, images: 2, ageDays: 2,
  },
  {
    seller: "techlyon", title: "Samsung Galaxy S22 256 Go débloqué", category: "smartphones", brand: "Samsung", condition: "GOOD", price: 320, currency: "EUR", region: "69", city: "Lyon",
    description: "Légères traces sur le contour, écran parfait. Débloqué, chargeur rapide inclus. Vendeur professionnel : facture et garantie légale.",
    delivery: ["NATIONAL_SHIPPING"], size: "S", weight: 400, quantity: 2, attributes: { storage: "256 Go", unlocked: true, color: "Noir" }, icon: "smartphone", hue: 230, images: 2, ageDays: 6,
  },
  {
    seller: "techlyon", title: "MacBook Air M1 8 Go / 256 Go", category: "ordinateurs-portables", brand: "Apple", condition: "VERY_GOOD", price: 590, currency: "EUR", region: "69", city: "Lyon",
    description: "MacBook Air M1 (2020), 87 cycles de batterie, clavier AZERTY. macOS réinstallé. Chargeur d'origine.",
    delivery: ["NATIONAL_SHIPPING"], size: "M", weight: 2000, attributes: { ram: "8 Go", storage: "256 Go SSD", screen: 13 }, icon: "laptop", hue: 220, images: 2, ageDays: 4,
  },
  {
    seller: "techlyon", title: "Écran Dell 27 pouces QHD", category: "ecrans-peripheriques", brand: "Dell", condition: "GOOD", price: 140, currency: "EUR", region: "69", city: "Lyon",
    description: "Écran 27\" 2560 × 1440, pied réglable en hauteur, câble DisplayPort fourni. Aucun pixel mort.",
    delivery: ["HAND_DELIVERY", "NATIONAL_SHIPPING"], size: "XL", weight: 7500, icon: "monitor", hue: 195, images: 1, ageDays: 12,
  },
  {
    seller: "vinyles", title: "Vinyle 33 tours de chanson kabyle — pressage des années 70", category: "vinyles", condition: "GOOD", price: 45, currency: "EUR", region: "13", city: "Marseille",
    description: "Disque nettoyé à la machine, quelques craquements légers en début de face A. Pochette d'époque avec usure aux angles. Écoute possible avant achat à Marseille.",
    delivery: ["HAND_DELIVERY", "NATIONAL_SHIPPING", "TAMURT_TRANSPORT"], size: "S", weight: 350, attributes: { format: "33 tours" }, crossBorder: true, icon: "disc-3", hue: 25, images: 2, ageDays: 2,
  },
  {
    seller: "vinyles", title: "Lot de 10 vinyles jazz des années 60", category: "vinyles", condition: "GOOD", price: 80, currency: "EUR", region: "13", city: "Marseille",
    description: "Dix 33 tours de jazz (rééditions et pressages d'époque), liste détaillée sur demande. Vendus en lot.",
    delivery: ["HAND_DELIVERY", "NATIONAL_SHIPPING"], size: "M", weight: 3500, attributes: { format: "33 tours" }, icon: "disc-3", hue: 40, images: 1, ageDays: 15,
  },
  {
    seller: "vinyles", title: "Platine vinyle Technics SL-1210 MK2", category: "audio-hifi", brand: "Technics", condition: "VERY_GOOD", price: 450, currency: "EUR", region: "13", city: "Marseille",
    description: "Platine révisée, cellule neuve, capot sans fêlure. Remise en main propre privilégiée vu le poids.",
    delivery: ["HAND_DELIVERY"], size: "XL", weight: 12000, icon: "disc-3", hue: 0, images: 2, ageDays: 20,
  },
  {
    seller: "lina", title: "Veste en jean taille M", category: "mode-femme", brand: "Levi's", condition: "VERY_GOOD", price: 25, currency: "EUR", region: "93", city: "Montreuil",
    description: "Veste en jean coupe classique, portée quelques fois. Aucun défaut.",
    delivery: ["HAND_DELIVERY", "NATIONAL_SHIPPING"], size: "S", weight: 700, attributes: { size: "M", color: "Bleu" }, icon: "shirt", hue: 215, images: 2, ageDays: 1,
  },
  {
    seller: "lina", title: "Robe d'été en lin, taille S", category: "mode-femme", condition: "NEW_WITH_TAGS", price: 18, currency: "EUR", region: "93", city: "Montreuil",
    description: "Robe légère en lin, jamais portée, étiquette encore attachée. Couleur sable.",
    delivery: ["HAND_DELIVERY", "NATIONAL_SHIPPING"], size: "XS", weight: 300, attributes: { size: "S", color: "Beige" }, icon: "shirt", hue: 40, images: 1, ageDays: 5,
  },
  {
    seller: "lina", title: "Baskets Air Max 90, pointure 42", category: "chaussures", brand: "Nike", condition: "GOOD", price: 55, currency: "EUR", region: "93", city: "Montreuil",
    description: "Portées une saison, semelles en bon état, lavées. Boîte non conservée.",
    delivery: ["HAND_DELIVERY", "NATIONAL_SHIPPING"], size: "M", weight: 1100, attributes: { shoe_size: "42", gender: "Mixte", color: "Blanc" }, icon: "footprints", hue: 150, images: 2, ageDays: 7,
  },
  {
    seller: "lina", title: "Sac à main en cuir camel", category: "sacs-accessoires", condition: "VERY_GOOD", price: 40, currency: "EUR", region: "93", city: "Montreuil",
    description: "Sac porté épaule, cuir souple, doublure intacte. Dimensions : 30 × 22 × 10 cm.",
    delivery: ["HAND_DELIVERY", "NATIONAL_SHIPPING"], size: "S", weight: 600, attributes: { color: "Marron" }, icon: "shopping-bag", hue: 30, images: 1, ageDays: 11,
  },
  {
    seller: "lina", title: "Canapé 3 places en velours vert", category: "mobilier", condition: "GOOD", price: 250, currency: "EUR", region: "93", city: "Montreuil",
    description: "Canapé confortable, 210 cm de long. À récupérer sur place (3e étage sans ascenseur), aide au portage possible.",
    delivery: ["HAND_DELIVERY"], icon: "sofa", hue: 140, images: 2, ageDays: 18,
  },
  {
    seller: "kamel", title: "Vélo de route, taille M, 18 vitesses", category: "velos", brand: "Btwin", condition: "GOOD", price: 210, currency: "EUR", region: "13", city: "Marseille",
    description: "Vélo de route entretenu, pneus changés au printemps. Idéal pour débuter. Remise en main propre uniquement.",
    delivery: ["HAND_DELIVERY"], attributes: { frame_size: "M" }, icon: "bike", hue: 10, images: 2, ageDays: 10,
  },
  {
    seller: "kamel", title: "Haltères réglables 2 × 20 kg", category: "fitness", condition: "VERY_GOOD", price: 60, currency: "EUR", region: "13", city: "Marseille",
    description: "Paire d'haltères avec disques en fonte, barres et stops. À venir chercher.",
    delivery: ["HAND_DELIVERY"], icon: "dumbbell", hue: 0, images: 1, ageDays: 25,
  },
  {
    seller: "vinyles", title: "Lot de 12 romans policiers en français", category: "livres", condition: "GOOD", price: 15, currency: "EUR", region: "13", city: "Marseille",
    description: "Douze romans poche, lus une fois. Liste des titres sur demande.",
    delivery: ["HAND_DELIVERY", "NATIONAL_SHIPPING", "TAMURT_TRANSPORT"], size: "M", weight: 2500, attributes: { language: "Français" }, crossBorder: true, icon: "book-open", hue: 50, images: 1, ageDays: 14,
  },
  {
    seller: "lina", title: "Poussette combinée 3 en 1", category: "puericulture", condition: "GOOD", price: 120, currency: "EUR", region: "93", city: "Montreuil",
    description: "Poussette avec nacelle et siège, notice d'origine. Aucun choc. Annonce vérifiée avant publication (catégorie réglementée).",
    delivery: ["HAND_DELIVERY"], icon: "baby", hue: 320, images: 2, status: "PENDING_REVIEW", ageDays: 0,
  },
  {
    seller: "yanis", title: "Lego Technic — supercar complète avec notice", category: "jouets", brand: "Lego", condition: "VERY_GOOD", price: 220, currency: "EUR", region: "13", city: "Marseille",
    description: "Set complet vérifié pièce par pièce, notice et boîte. Monté une seule fois.",
    delivery: ["HAND_DELIVERY", "NATIONAL_SHIPPING"], size: "L", weight: 3000, icon: "blocks", hue: 45, images: 2, ageDays: 8,
  },
  {
    seller: "techlyon", title: "Appareil photo hybride + objectif 18-55 mm", category: "photo-video", brand: "Fujifilm", condition: "VERY_GOOD", price: 650, currency: "EUR", region: "69", city: "Lyon",
    description: "Boîtier hybride 26 Mpx, 4 500 déclenchements, objectif 18-55 mm. Deux batteries.",
    delivery: ["NATIONAL_SHIPPING"], size: "S", weight: 900, icon: "camera", hue: 260, images: 2, ageDays: 3,
  },
  {
    seller: "yanis", title: "Casque à réduction de bruit sans fil", category: "audio-hifi", brand: "Sony", condition: "GOOD", price: 150, currency: "EUR", region: "13", city: "Marseille",
    description: "Casque Bluetooth à réduction de bruit active, étui et câble fournis. Coussinets changés.",
    delivery: ["HAND_DELIVERY", "NATIONAL_SHIPPING"], size: "S", weight: 600, icon: "headphones", hue: 200, images: 1, status: "SOLD", ageDays: 30,
  },
  // ── Algérie ──
  {
    seller: "thiziri", title: "Robe kabyle brodée main, taille M", category: "tenues-traditionnelles", condition: "NEW_WITHOUT_TAGS", price: 18000, currency: "DZD", region: "15", city: "Tizi Ouzou",
    description: "Taqendurt en tissu léger, broderies faites main et galons (ziggzag) colorés. Taille M, retouches possibles. Ceinture (fouta) non incluse.",
    delivery: ["HAND_DELIVERY", "TAMURT_TRANSPORT"], size: "S", weight: 800, attributes: { size: "M", color: "Multicolore", region_style: "Kabyle" }, crossBorder: true, icon: "sparkles", hue: 330, images: 3, ageDays: 1,
  },
  {
    seller: "thiziri", title: "Robe kabyle de fête avec fouta, taille L", category: "tenues-traditionnelles", condition: "NEW_WITH_TAGS", price: 26000, currency: "DZD", region: "15", city: "Tizi Ouzou",
    description: "Robe de fête aux tons jaune et rouge, fouta assortie. Confection soignée, finitions doublées.",
    delivery: ["HAND_DELIVERY", "TAMURT_TRANSPORT"], size: "S", weight: 1000, attributes: { size: "L", color: "Jaune", region_style: "Kabyle" }, crossBorder: true, icon: "sparkles", hue: 45, images: 2, ageDays: 4,
  },
  {
    seller: "bgayet", title: "Jarre en poterie décorée à la main", category: "poterie", condition: "NEW_WITHOUT_TAGS", price: 6500, currency: "DZD", region: "06", city: "Béjaïa",
    description: "Poterie modelée et peinte à la main, motifs géométriques traditionnels. Hauteur 35 cm. Objet fragile : remise en main propre de préférence.",
    delivery: ["HAND_DELIVERY"], size: "M", weight: 2500, icon: "amphora", hue: 20, images: 2, ageDays: 2,
  },
  {
    seller: "thiziri", title: "Collier en argent émaillé de style berbère", category: "bijoux-artisanaux", condition: "NEW_WITHOUT_TAGS", price: 24000, currency: "DZD", region: "15", city: "Tizi Ouzou",
    description: "Collier en argent émaillé et corail synthétique, travail artisanal. Poinçon à vérifier sur place.",
    delivery: ["HAND_DELIVERY"], size: "XS", weight: 150, attributes: { material: "Argent émaillé" }, icon: "gem", hue: 190, images: 2, ageDays: 6,
  },
  {
    seller: "bgayet", title: "Burnous en laine, fabrication artisanale", category: "tenues-traditionnelles", condition: "NEW_WITHOUT_TAGS", price: 35000, currency: "DZD", region: "06", city: "Béjaïa",
    description: "Burnous en laine tissée, couleur naturelle. Taille adulte homme. Chaud et léger.",
    delivery: ["HAND_DELIVERY", "TAMURT_TRANSPORT"], size: "M", weight: 1500, attributes: { size: "Taille unique", color: "Beige" }, crossBorder: true, icon: "shirt", hue: 35, images: 2, ageDays: 9,
  },
  {
    seller: "bgayet", title: "Tapis tissé main 150 × 90 cm", category: "tapis-tissage", condition: "VERY_GOOD", price: 22000, currency: "DZD", region: "06", city: "Akbou",
    description: "Tapis en laine aux motifs géométriques, couleurs naturelles. Très bon état.",
    delivery: ["HAND_DELIVERY"], attributes: { dimensions: "150 × 90 cm" }, icon: "palette", hue: 5, images: 2, ageDays: 12,
  },
  {
    seller: "sonia", title: "Smartphone Redmi Note 12 128 Go", category: "smartphones", brand: "Xiaomi", condition: "VERY_GOOD", price: 32000, currency: "DZD", region: "06", city: "Béjaïa",
    description: "Téléphone utilisé six mois, avec coque et chargeur. Batterie excellente.",
    delivery: ["HAND_DELIVERY"], attributes: { storage: "128 Go", unlocked: true, color: "Gris" }, icon: "smartphone", hue: 180, images: 1, ageDays: 3,
  },
  {
    seller: "bgayet", title: "Livre ancien de littérature algérienne (édition des années 60)", category: "livres", condition: "FAIR", price: 1500, currency: "DZD", region: "06", city: "Béjaïa",
    description: "Roman en français, édition ancienne, pages jaunies mais complètes. Couverture usée.",
    delivery: ["HAND_DELIVERY"], attributes: { language: "Français" }, icon: "book-open", hue: 30, images: 1, ageDays: 16,
  },
  {
    seller: "bgayet", title: "Table basse kabyle en bois sculpté", category: "mobilier", condition: "GOOD", price: 9000, currency: "DZD", region: "06", city: "Béjaïa",
    description: "Petite table basse ronde (meida) en bois sculpté, diamètre 60 cm. Quelques marques d'usage.",
    delivery: ["HAND_DELIVERY"], icon: "armchair", hue: 25, images: 1, ageDays: 21,
  },
  {
    seller: "sonia", title: "Console PS4 Slim 500 Go + manette", category: "consoles", brand: "Sony", condition: "GOOD", price: 38000, currency: "DZD", region: "06", city: "Béjaïa",
    description: "PS4 Slim fonctionnelle, une manette, câbles. Quelques rayures sur le dessus.",
    delivery: ["HAND_DELIVERY"], attributes: { platform: "PlayStation" }, icon: "gamepad-2", hue: 215, images: 1, ageDays: 5,
  },
];
