import { DamageComponent, ImbueProperties, ActiveImbuedEffect } from '../rules-engine/rules.types.js';

export { DamageComponent, ImbueProperties, ActiveImbuedEffect };

export type ItemAcquisitionMode = 'free' | 'limited' | 'approval';

export interface Item {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  category: string;
  weight: number;
  cost: number;
  acquisition_mode: ItemAcquisitionMode;
  stock_quantity: number | null;
  is_hidden: boolean;
  is_purchasable: boolean;
  properties: Record<string, any>;
  created_at: string;
}

export interface CreateItemDTO {
  name: string;
  description?: string;
  category?: string;
  weight?: number;
  cost?: number;
  acquisition_mode?: ItemAcquisitionMode;
  stock_quantity?: number | null;
  is_hidden?: boolean;
  is_purchasable?: boolean;
  properties?: Record<string, any>;
}

export interface UpdateItemDTO {
  name?: string;
  description?: string;
  category?: string;
  weight?: number;
  cost?: number;
  acquisition_mode?: ItemAcquisitionMode;
  stock_quantity?: number | null;
  is_hidden?: boolean;
  is_purchasable?: boolean;
  properties?: Record<string, any>;
}

export interface CharacterInventoryItem {
  id: string;
  character_id: string;
  item_id?: string | null;
  item_name: string;
  category: string;
  quantity: number;
  weight: number;
  cost: number;
  is_equipped: number;
  properties: Record<string, any>;
}

export interface AddInventoryItemDTO {
  itemId?: string; // Se fornecido, preenche a partir do catálogo da campanha
  itemName?: string;
  category?: string;
  quantity?: number;
  weight?: number;
  cost?: number;
  isEquipped?: boolean;
  properties?: Record<string, any>;
}

export interface UpdateInventoryItemDTO {
  quantity?: number;
  isEquipped?: boolean;
  properties?: Record<string, any>;
}

export interface TransferItemDTO {
  inventoryItemId: string;
  targetCharacterId: string;
  quantity: number;
}

export interface ImbueWeaponDTO {
  consumableInventoryId: string;
  weaponInventoryId: string;
}

export interface InventorySummary {
  items: CharacterInventoryItem[];
  totalWeight: number;
  totalCost: number;
  equippedCount: number;
  itemCount: number;
}

export interface InventoryTransferRecord {
  id: string;
  campaign_id: string;
  from_character_id: string;
  to_character_id: string;
  from_character_name?: string;
  to_character_name?: string;
  item_name: string;
  quantity: number;
  transferred_by_user_id: string;
  transferred_by_username?: string;
  created_at: string;
}

export type ItemRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ItemRequest {
  id: string;
  campaign_id: string;
  character_id: string;
  character_name?: string;
  user_id: string;
  username?: string;
  item_id: string;
  item_name?: string;
  quantity: number;
  status: ItemRequestStatus;
  notes?: string;
  reviewed_by_user_id?: string | null;
  reviewed_by_username?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateItemRequestDTO {
  characterId: string;
  itemId: string;
  quantity?: number;
  notes?: string;
}

export interface ReviewItemRequestDTO {
  status: 'approved' | 'rejected';
  notes?: string;
}

export interface PurchaseItemDTO {
  characterId: string;
  itemId: string;
  quantity: number;
}

export interface PurchaseResult {
  success: boolean;
  item: CharacterInventoryItem;
  inventory: InventorySummary;
  character: any;
  transaction: {
    quantity: number;
    unitCost: number;
    totalCost: number;
    currencyKey: string;
    previousBalance: number;
    newBalance: number;
  };
}
