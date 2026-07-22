import tilesData from '@/data/tiles.json';

export type Tile = {
  id: string;
  sku: string;
  name: string;
  brand: string;
  collection: string;
  type: 'porcelain' | 'clinker' | 'mosaic';
  size: string;
  pricePerM2: number;
  currency: 'KGS';
  color: string;
  texture: string;
  image: string;
  texturePreview?: string;
};

const tiles = tilesData as Tile[];

export function getTileById(id: string): Tile | undefined {
  return tiles.find((t) => t.id === id);
}
