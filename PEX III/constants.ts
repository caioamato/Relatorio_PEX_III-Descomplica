import { InventoryItem, PurchaseRequest, User, SystemLog } from './types';

// --- SISTEMA LIMPO ---
// Sem bcrypt (resolve o erro)
// Sem dados falsos (pronto para produção)

export const MOCK_USERS: User[] = [];

export const INITIAL_INVENTORY: InventoryItem[] = [];

export const INITIAL_REQUESTS: PurchaseRequest[] = [];

export const INITIAL_LOGS: SystemLog[] = [];