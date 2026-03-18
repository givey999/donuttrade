export interface CosmeticColor {
  id: string;
  hex: string;
  name: string;
  tier: 'free' | 'paid' | 'volume';
  price?: number;
  requiredVolume?: number;
}

export interface CosmeticFont {
  id: string;
  name: string;
  fontFamily: string;
  tier: 'free' | 'paid' | 'volume';
  price?: number;
  requiredVolume?: number;
}

export const COSMETIC_COLORS: CosmeticColor[] = [
  // Free tier
  { id: 'red', hex: '#EF4444', name: 'Red', tier: 'free' },
  { id: 'blue', hex: '#3B82F6', name: 'Blue', tier: 'free' },
  { id: 'green', hex: '#22C55E', name: 'Green', tier: 'free' },
  // Paid tier
  { id: 'gold', hex: '#EAB308', name: 'Gold', tier: 'paid', price: 1_000_000 },
  { id: 'purple', hex: '#A855F7', name: 'Purple', tier: 'paid', price: 1_000_000 },
  { id: 'pink', hex: '#EC4899', name: 'Pink', tier: 'paid', price: 1_000_000 },
  // Volume tier
  { id: 'diamond', hex: '#06B6D4', name: 'Diamond', tier: 'volume', requiredVolume: 250_000_000 },
  { id: 'emerald', hex: '#10B981', name: 'Emerald', tier: 'volume', requiredVolume: 500_000_000 },
  { id: 'ruby', hex: '#DC2626', name: 'Ruby', tier: 'volume', requiredVolume: 3_000_000_000 },
];

export const COSMETIC_FONTS: CosmeticFont[] = [
  // Free tier
  { id: 'sans', name: 'Sans Serif', fontFamily: 'ui-sans-serif, system-ui, sans-serif', tier: 'free' },
  { id: 'serif', name: 'Serif', fontFamily: 'ui-serif, Georgia, serif', tier: 'free' },
  { id: 'mono', name: 'Monospace', fontFamily: 'ui-monospace, monospace', tier: 'free' },
  // Paid tier
  { id: 'cursive', name: 'Cursive', fontFamily: 'cursive', tier: 'paid', price: 1_000_000 },
  { id: 'fantasy', name: 'Fantasy', fontFamily: 'fantasy', tier: 'paid', price: 1_000_000 },
  { id: 'rounded', name: 'Rounded', fontFamily: '"Varela Round", ui-rounded, sans-serif', tier: 'paid', price: 1_000_000 },
  // Volume tier
  { id: 'elegant', name: 'Elegant', fontFamily: '"Playfair Display", serif', tier: 'volume', requiredVolume: 250_000_000 },
  { id: 'bold-display', name: 'Bold Display', fontFamily: '"Bebas Neue", sans-serif', tier: 'volume', requiredVolume: 500_000_000 },
  { id: 'premium', name: 'Premium', fontFamily: '"Cinzel", serif', tier: 'volume', requiredVolume: 3_000_000_000 },
];

export function getColor(id: string): CosmeticColor | undefined {
  return COSMETIC_COLORS.find(c => c.id === id);
}

export function getFont(id: string): CosmeticFont | undefined {
  return COSMETIC_FONTS.find(f => f.id === id);
}
