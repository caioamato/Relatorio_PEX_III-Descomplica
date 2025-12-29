import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { InventoryItem, PurchaseRequest, RequestStatus, DashboardMetrics, User, Role, SystemLog } from '../types';
import { INITIAL_LOGS } from '../constants';
import { useAuth } from './AuthContext';

interface ERPContextType {
  inventory: InventoryItem[];
  requests: PurchaseRequest[];
  users: User[];
  logs: SystemLog[];
  createRequest: (itemId: string | null, quantity: number, unitPrice: number, observation?: string, customData?: { name: string, category: string }) => Promise<void>;
  updateRequestStatus: (requestId: string, newStatus: RequestStatus, reason?: string) => Promise<void>;
  addItem: (item: Omit<InventoryItem, 'id'>) => Promise<string | null>;
  updateItem: (itemId: string, data: Partial<InventoryItem>) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  withdrawItem: (itemId: string, quantity: number, reason: string) => Promise<void>;
  updateUserRole: (userId: string | number, newRole: Role) => void;
  addUser: (user: User) => void;
  deactivateUser: (userId: string | number) => Promise<void>;
  activateUser: (userId: string | number) => Promise<void>;
  resetUserPassword: (userId: string | number) => void;
  generateNextSku: () => string;
  metrics: DashboardMetrics;
  addLog: (action: string, description: string, previous_status?: string) => void;
  refreshData: () => void;
}

const ERPContext = createContext<ERPContextType | undefined>(undefined);

export const ERPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<SystemLog[]>(INITIAL_LOGS);

  const API_URL = import.meta.env.VITE_API_BASE_URL;

  // --- BUSCAR DADOS (GET) ---
  const fetchData = useCallback(async () => {
    try {
      const [usersRes, invRes, reqRes] = await Promise.all([
        fetch(`${API_URL}/api/users`),
        fetch(`${API_URL}/api/inventory`),
        fetch(`${API_URL}/api/requests`)
      ]);

      if (usersRes.ok) setUsers(await usersRes.json());
      if (invRes.ok) setInventory(await invRes.json());
      if (reqRes.ok) setRequests(await reqRes.json());

    } catch (error) { console.error("Erro ao buscar dados:", error); }
  }, [API_URL]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refreshData = () => fetchData();

  // --- LOGS ---
  const addLog = (action: string, description: string, previous_status?: string) => {
    const newLog: SystemLog = {
      id: `log-${Date.now()}`,
      action, description, user_name: user?.name || 'Sistema', user_id: user?.id,
      timestamp: new Date().toISOString(), previous_status
    };
    setLogs(prev => [newLog, ...prev]);
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  const generateNextSku = () => {
    const existingSkus = inventory.map(i => i.sku).filter(sku => sku.startsWith('ND-'))
      .map(sku => parseInt(sku.split('-')[1], 10)).filter(num => !isNaN(num));
    const maxNum = existingSkus.length > 0 ? Math.max(...existingSkus) : 0;
    return `ND-${String(maxNum + 1).padStart(3, '0')}`;
  };

  // --- ESTOQUE (INVENTORY) ---
  const addItem = async (item: Omit<InventoryItem, 'id'>) => {
    try {
      const response = await fetch(`${API_URL}/api/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (response.ok) {
        const savedItem = await response.json();
        setInventory(prev => [...prev, savedItem]);
        addLog('Novo Item', `Cadastrou ${item.name} (${item.sku})`);
        return savedItem.id;
      }
    } catch (e) { console.error(e); }
    return null;
  };

  const updateItem = async (itemId: string, data: Partial<InventoryItem>) => {
    const currentItem = inventory.find(i => String(i.id) === String(itemId));
    if (!currentItem) return;
    try {
      const response = await fetch(`${API_URL}/api/inventory/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...currentItem, ...data })
      });
      if (response.ok) {
        const savedItem = await response.json();
        setInventory(prev => prev.map(i => String(i.id) === String(itemId) ? savedItem : i));
        addLog('Edição de Item', `Editou item ${savedItem.name}`);
      }
    } catch (e) { console.error(e); }
  };

  const deleteItem = async (itemId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/inventory/${itemId}`, { method: 'DELETE' });
      if (response.ok) {
        setInventory(prev => prev.filter(i => String(i.id) !== String(itemId)));
        addLog('Exclusão de Item', `Removeu item ID ${itemId}`);
      }
    } catch (e) { console.error(e); }
  };

  const withdrawItem = async (itemId: string, quantity: number, reason: string) => {
    const item = inventory.find(i => String(i.id) === String(itemId));
    if (!item || item.current_qty < quantity) return;
    await updateItem(itemId, { current_qty: item.current_qty - quantity });
    addLog('Saída de Estoque', `Retirou ${quantity} do item ${item.name}. Motivo: ${reason}`);
  };

  // --- PEDIDOS (REQUESTS) ---
  const createRequest = async (itemId: string | null, quantity: number, unitPrice: number, observation: string = '', customData?: { name: string, category: string }) => {
    if (!user) return;
    const item = itemId ? inventory.find(i => String(i.id) === String(itemId)) : null;
    const itemName = item ? item.name : customData?.name || 'Novo Item';
    
    try {
      const response = await fetch(`${API_URL}/api/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_id: itemId,
          custom_item_name: customData?.name,
          custom_category: customData?.category,
          requester_id: user.id,
          requester_name: user.name,
          quantity,
          unit_price: unitPrice,
          observation
        })
      });

      if (response.ok) {
        const savedRequest = await response.json();
        setRequests(prev => [savedRequest, ...prev]);
        addLog('Nova Solicitação', `Solicitou ${quantity}x ${itemName}`);
      }
    } catch (e) { console.error(e); alert('Erro ao criar pedido'); }
  };

  const updateRequestStatus = async (requestId: string, newStatus: RequestStatus, reason?: string) => {
    if (!user || !['ADM_MASTER', 'GESTOR'].includes(user.role)) return alert("Acesso Negado.");
    
    const request = requests.find(r => String(r.id) === String(requestId));
    if (!request) return;

    let newItemId = request.item_id;

    // AQUI ESTAVA O ERRO: Adicionamos o 'status' que faltava
    if (newStatus === 'APROVADO' && !request.item_id && request.custom_item_name) {
      const nextSku = generateNextSku();
      const createdId = await addItem({
        name: request.custom_item_name,
        sku: nextSku,
        category: request.custom_category || 'Geral',
        current_qty: 0,
        min_qty: 5,
        price: request.unit_price || 0,
        unit: 'UN',
        status: 'Crítico' // <--- CAMPO ADICIONADO QUE RESOLVE O ERRO DA IMAGEM
      });
      if (createdId) newItemId = createdId;
    }

    if (newStatus === 'COMPRADO' && request.status !== 'COMPRADO' && newItemId) {
      const item = inventory.find(i => String(i.id) === String(newItemId));
      if (item) {
        await updateItem(String(newItemId), { current_qty: item.current_qty + request.quantity });
      }
    }

    try {
      const response = await fetch(`${API_URL}/api/requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus, 
          rejection_reason: reason,
          item_id: newItemId
        })
      });

      if (response.ok) {
        const updatedReq = await response.json();
        setRequests(prev => prev.map(r => String(r.id) === String(requestId) ? updatedReq : r));
        addLog('Atualização Pedido', `Mudou status para ${newStatus}`);
      }
    } catch (e) { console.error(e); }
  };

  // --- USUÁRIOS ---
  const addUser = (newUser: User) => {
    setUsers(prev => [...prev, newUser]);
  };

  const updateUserRole = async (userId: string | number, newRole: Role) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
    try {
        const user = users.find(u => u.id === userId);
        if(user) await fetch(`${API_URL}/api/users/${userId}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ ...user, role: newRole }) });
    } catch(e) { console.error(e); refreshData(); }
  };

  const deactivateUser = async (userId: string | number) => {
    const userToDeactivate = users.find(u => u.id === userId);
    if (!userToDeactivate) {
      throw new Error("Usuário não encontrado para desativar.");
    }

    try {
      const response = await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...userToDeactivate, is_active: false })
      });

      if (response.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: false, role: 'DESATIVADO' } : u));
        addLog('Usuário Desativado', `Desativou o usuário ${userToDeactivate.name}`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao desativar usuário');
      }
    } catch (e: any) {
      console.error('Falha ao desativar usuário:', e);
      throw e; // Re-throw to be caught by the UI component
    }
  };

  const activateUser = async (userId: string | number) => {
    const userToActivate = users.find(u => u.id === userId);
    if (!userToActivate) {
      throw new Error("Usuário não encontrado para ativar.");
    }

    try {
      const response = await fetch(`${API_URL}/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        // Restore user to active and set a default role
        body: JSON.stringify({ ...userToActivate, is_active: true, role: 'COMUM' })
      });

      if (response.ok) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: true, role: 'COMUM' } : u));
        addLog('Usuário Reativado', `Reativou o usuário ${userToActivate.name}`);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao reativar usuário');
      }
    } catch (e: any) {
      console.error('Falha ao reativar usuário:', e);
      throw e;
    }
  };

  const resetUserPassword = (userId: string | number) => {};

  const metrics = useMemo(() => {
    return {
      criticalItemsCount: inventory.filter(i => i.status === 'Crítico').length,
      pendingRequestsCount: requests.filter(r => r.status === 'PENDENTE').length,
      totalStockValue: inventory.reduce((acc, item) => acc + (Number(item.price) * Number(item.current_qty)), 0)
    };
  }, [inventory, requests]);

  return (
    <ERPContext.Provider value={{ inventory, requests, users, logs, createRequest, updateRequestStatus, addItem, updateItem, deleteItem, withdrawItem, updateUserRole, addUser, deactivateUser, activateUser, resetUserPassword, generateNextSku, metrics, addLog, refreshData }}>
      {children}
    </ERPContext.Provider>
  );
};

export const useERP = () => {
  const context = useContext(ERPContext);
  if (context === undefined) throw new Error('useERP must be used within an ERPProvider');
  return context;
};
  