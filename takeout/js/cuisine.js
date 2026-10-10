// Cuisine → line icon (Tabler outline font) + color, and the "Browse by craving" groups.

// First matching rule wins, checked against a place's cuisines, then its tags.
const RULES = [
  [["pizza"], "pizza", "#d9822b"],
  [["sushi", "japanese", "hibachi", "seafood", "cajun"], "fish", "#2f6f8f"],
  [["mexican", "tex-mex", "tacos", "burritos"], "pepper", "#b84a2e"],
  [["mediterranean", "middle eastern", "lebanese", "greek"], "lemon", "#8c3b5e"],
  [["chinese", "sichuan", "thai", "vietnamese", "korean", "asian"], "bowl-chopsticks", "#a8423a"],
  [["indian", "south indian"], "flame", "#b0632a"],
  [["bbq", "steakhouse"], "grill", "#7a3b2a"],
  [["chicken", "wings"], "meat", "#9a5a2a"],
  [["burgers"], "burger", "#c0602a"],
  [["coney", "diner", "breakfast"], "egg-fried", "#a68a2a"],
  [["sandwiches", "deli", "bakery"], "baguette", "#8a6d3b"],
  [["italian"], "chef-hat", "#6f7a3a"],
  [["polish", "irish", "soul food", "caribbean", "jamaican"], "soup", "#6d4c7d"],
  [["bar food", "american"], "beer", "#7b6a3e"],
];
const FALLBACK = { icon: "tools-kitchen-2", color: "#4a4450" };

export function cuisineStyle(r) {
  const keys = [...(r.cuisines || []), ...(r.tags || [])].map((s) => String(s).toLowerCase());
  for (const k of keys) {
    for (const [names, icon, color] of RULES) if (names.includes(k)) return { icon, color };
  }
  return FALLBACK;
}

// Craving tiles on the home screen. `match` = cuisines or tags, any of which qualifies.
export const CRAVINGS = [
  { key: "pizza", label: "Pizza", icon: "pizza", color: "#d9822b", match: ["pizza"] },
  { key: "burgers", label: "Burgers", icon: "burger", color: "#c0602a", match: ["burgers", "sliders"] },
  { key: "mexican", label: "Mexican", icon: "pepper", color: "#b84a2e", match: ["mexican", "tex-mex", "tacos"] },
  { key: "mideast", label: "Middle Eastern", icon: "lemon", color: "#8c3b5e", match: ["mediterranean", "middle eastern", "lebanese", "greek", "shawarma"] },
  { key: "asian", label: "Asian", icon: "bowl-chopsticks", color: "#a8423a", match: ["chinese", "sichuan", "thai", "vietnamese", "korean", "japanese", "indian"] },
  { key: "sushi", label: "Sushi & seafood", icon: "fish", color: "#2f6f8f", match: ["sushi", "seafood", "cajun", "fish & chips", "fish fry"] },
  { key: "bbq", label: "BBQ & chicken", icon: "grill", color: "#7a3b2a", match: ["bbq", "chicken", "wings", "fried chicken", "hot chicken"] },
  { key: "breakfast", label: "Breakfast & diners", icon: "egg-fried", color: "#a68a2a", match: ["breakfast", "diner", "coney", "brunch"] },
  { key: "healthy", label: "Healthy", icon: "salad", color: "#4d7c4a", match: ["healthy", "salads", "vegetarian", "vegan", "poke"] },
  { key: "bar", label: "Bar & grill", icon: "beer", color: "#7b6a3e", match: ["bar", "sports bar", "brewery", "pub", "bar food"] },
];

export const cravingByKey = (k) => CRAVINGS.find((c) => c.key === k) || null;
