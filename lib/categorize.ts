import type { Category } from "./invoice";

// Walmart doesn't print a category, so guess from the title. First match wins,
// which is why spices come before produce (ground ginger) and meat before
// frozen (frozen ground turkey). Anything the rules get wrong is fixed once on
// the Review screen and remembered for later orders.
const RULES: [Category, RegExp][] = [
  [
    "household",
    /\b(body wash|soap|shampoo|conditioner|toilet paper|paper towels?|tissues?|cotton swabs?|detergent|dish ?washer|dish soap|trash bags?|garbage bags?|cleaner|bleach|toothpaste|toothbrush(es)?|deodorant|lotion|razors?|napkins?|aluminum foil|plastic wrap|sponges?|wipes|batteries)\b/,
  ],
  [
    "bakery",
    /\b(bread|bagels?|buns|dinner rolls|tortillas?|muffins?|croissants?|cereal|corn flakes|oats|oatmeal|granola|pancakes?|waffles?|pita|naan)\b/,
  ],
  [
    "pantry",
    /\b(seasoning|sauce|paste|powder|salsa|cooking spray|oil|vinegar|wrappers|rice|flour|sugar|salt|spices?|masala|noodles?|pasta|lentils?|dal|broth|stock|bouillon|soup|ketchup|mayo(nnaise)?|mustard|honey|jam|jelly|peanut butter|chips|crackers|cookies|nuts|almonds|tea|coffee|ground (ginger|cumin|cinnamon|turmeric|coriander|cloves|nutmeg|cardamom|black pepper))\b/,
  ],
  [
    "meat",
    /\b(chicken|turkey|beef|pork|lamb|goat|mutton|steaks?|sausages?|bacon|ham|hot dogs?|salmon|tilapia|cod|fish|shrimp|prawns?|meat)\b/,
  ],
  ["dairy", /\b(eggs?|milk|yogurt|yoghurt|cheese|butter|cream|paneer|ghee|kefir)\b/],
  ["frozen", /\bfrozen\b/],
  [
    "produce",
    /\b(fresh|bananas?|apples?|oranges?|potato(es)?|onions?|tomato(es)?|cilantro|chiles?|chilies|chillies|peppers?|lettuce|spinach|carrots?|cucumbers?|garlic|ginger|lemons?|limes?|avocados?|grapes?|berries|strawberries|blueberries|mangoes|mangos?|okra|broccoli|cabbage|cauliflower|celery|mushrooms?|zucchini|squash|kale|herbs?|mint|curry leaves|eggplants?|green beans|corn|peas)\b/,
  ],
];

export function productKey(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

export function categorize(title: string): Category {
  const t = productKey(title);
  return RULES.find(([, re]) => re.test(t))?.[0] ?? "other";
}
