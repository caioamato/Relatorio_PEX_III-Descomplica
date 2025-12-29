// --- TIPOS GERAIS (Exportados para uso em outros arquivos) ---
export type Role = 'ADM_MASTER' | 'GESTOR' | 'TI' | 'COMUM' | 'DESATIVADO';
export type RequestStatus = 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'COMPRADO';
export type UnitOfMeasure = 'UN' | 'KG' | 'CX';
export type ItemStatus = 'Normal' | 'Crítico' | 'Em Reposição' | 'Excesso';

// --- INTERFACES ---

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  current_qty: number;
  min_qty: number;
  price: number;
  status: ItemStatus;
  unit: UnitOfMeasure;
}

export interface PurchaseRequest {
  id: string;
  item_id?: string;
  custom_item_name?: string;
  custom_category?: string;
  requester_id: string | number;
  requester_name: string;
  quantity: number;
  unit_price: number;
  observation?: string;
  status: RequestStatus;
  rejectionReason?: string;
  date: string;
}

export interface User {
  id: string | number;
  name: string;
  email: string;
  role: Role;
  department?: string;
  is_active?: boolean;
}

export interface SystemLog {
  id: string;
  action: string;
  description: string;
  user_name: string;
  user_id?: string | number;
  timestamp: string;
  previous_status?: string;
}

export interface DashboardMetrics {
  criticalItemsCount: number;
  pendingRequestsCount: number;
  totalStockValue: number;
}
