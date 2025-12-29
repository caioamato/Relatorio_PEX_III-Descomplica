import React, { useState, useEffect } from 'react';
import { useERP } from '../contexts/ERPContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Search, Plus, Filter, AlertCircle, X, ChevronDown, RefreshCw, Lock, Minus, ClipboardList, ChevronLeft, ChevronRight, Pencil, Trash, CheckCircle, AlertOctagon } from 'lucide-react';
import { InventoryItem, UnitOfMeasure, ItemStatus } from '../types';

export const Inventory: React.FC = () => {
  const { inventory, requests, createRequest, addItem, updateItem, deleteItem, withdrawItem, generateNextSku } = useERP();
  const { user } = useAuth();
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // Request Modal State
  const [selectedItemForRequest, setSelectedItemForRequest] = useState<InventoryItem | null>(null);
  const [requestQty, setRequestQty] = useState<number>(1);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  // Withdraw Modal State
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [selectedItemForWithdraw, setSelectedItemForWithdraw] = useState<InventoryItem | null>(null);
  const [withdrawQty, setWithdrawQty] = useState<number>(1);
  const [withdrawReason, setWithdrawReason] = useState<string>('');

  // New/Edit Item Modal State
  const [isNewItemModalOpen, setIsNewItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [newItemData, setNewItemData] = useState<Partial<InventoryItem>>({
    name: '',
    sku: '',
    category: 'Geral',
    current_qty: 0,
    min_qty: 5,
    price: 0,
    status: 'Normal',
    unit: 'UN'
  });

  // Toast State
  const [toast, setToast] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  // Permission Logic
  const canManageStock = ['ADM_MASTER', 'GESTOR'].includes(user?.role || '');

  // Helper: Format Currency
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Helper: Determine Dynamic Status
  const getItemDisplayStatus = (item: InventoryItem): ItemStatus => {
    if (item.status === 'Normal') return 'Normal';
    
    // Check if there is an approved request (pending delivery) for this critical item
    const hasPendingReplenishment = requests.some(
      r => r.item_id === item.id && r.status === 'APROVADO'
    );

    return hasPendingReplenishment ? 'Em Reposição' : 'Crítico';
  };

  // Effect to auto-generate SKU when modal opens ONLY for new items
  useEffect(() => {
    if (isNewItemModalOpen && !editingItem) {
      setNewItemData(prev => ({ ...prev, sku: generateNextSku() }));
    }
  }, [isNewItemModalOpen, editingItem, inventory, generateNextSku]);

  // Unique Categories for Filter
  const categories = Array.from(new Set(inventory.map(i => i.category)));

  // Filter Logic
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || getItemDisplayStatus(item) === filterStatus || (filterStatus === 'Crítico' && item.status === 'Crítico'); 
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Reset pagination AND selection when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedItemId(null);
  }, [searchTerm, filterCategory, filterStatus]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredInventory.length / ITEMS_PER_PAGE);
  const paginatedInventory = filteredInventory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      setSelectedItemId(null);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      setSelectedItemId(null);
    }
  };

  // Handlers
  const handleOpenRequest = (item: InventoryItem) => {
    setSelectedItemForRequest(item);
    setRequestQty(Math.max(1, item.min_qty - item.current_qty + 5)); 
    setIsRequestModalOpen(true);
  };

  const handleOpenWithdraw = (item: InventoryItem) => {
    setSelectedItemForWithdraw(item);
    setWithdrawQty(1);
    setWithdrawReason('');
    setIsWithdrawModalOpen(true);
  };

  const handleEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setNewItemData({ ...item });
    setIsNewItemModalOpen(true);
  };

  const handleCloseItemModal = () => {
    setIsNewItemModalOpen(false);
    setEditingItem(null);
    // Reset form to default
    setNewItemData({
      name: '',
      sku: '',
      category: 'Geral',
      current_qty: 0,
      min_qty: 5,
      price: 0,
      status: 'Normal',
      unit: 'UN'
    });
  };

  const submitRequest = () => {
    if (selectedItemForRequest) {
      createRequest(selectedItemForRequest.id, requestQty, selectedItemForRequest.price);
      setIsRequestModalOpen(false);
      setSelectedItemForRequest(null);
      showToast('success', 'Solicitação de reposição criada.');
    }
  };

  const submitWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForWithdraw) return;

    if (withdrawQty > selectedItemForWithdraw.current_qty) {
      alert("Quantidade de retirada excede o estoque atual.");
      return;
    }

    if (withdrawQty <= 0) {
      alert("Quantidade deve ser maior que zero.");
      return;
    }

    withdrawItem(selectedItemForWithdraw.id, withdrawQty, withdrawReason);
    setIsWithdrawModalOpen(false);
    setSelectedItemForWithdraw(null);
    setWithdrawReason('');
    showToast('success', 'Saída de estoque registrada.');
  };

  const submitNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Strict Validation
    if (!newItemData.min_qty || newItemData.min_qty < 1) {
      alert("O Estoque Mínimo deve ser pelo menos 1.");
      return;
    }

    if (newItemData.name && newItemData.sku) {
      if (editingItem) {
        // Edit Mode
        updateItem(editingItem.id, newItemData);
        showToast('success', 'Item atualizado com sucesso');
      } else {
        // Create Mode
        addItem({
          name: newItemData.name,
          sku: newItemData.sku,
          category: newItemData.category || 'Geral',
          current_qty: 0, // Force 0 to ensure audit trail via PO
          min_qty: Number(newItemData.min_qty),
          price: Number(newItemData.price),
          status: 'Crítico', // Starts at 0, so it is Critical
          unit: newItemData.unit as UnitOfMeasure || 'UN'
        });
        showToast('success', 'Novo item criado com sucesso');
      }
      handleCloseItemModal();
    }
  };

  // Badge Logic Helper
  const getBadgeVariant = (status: ItemStatus) => {
    switch (status) {
      case 'Crítico': return 'danger';
      case 'Em Reposição': return 'warning';
      case 'Normal': return 'success';
      default: return 'outline';
    }
  };

  return (
    <div className="space-y-6 relative">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-5 z-50 flex items-center gap-2 text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertOctagon className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Gerenciamento de Estoque</h1>
        <div className="flex gap-2 w-full md:w-auto">
          {/* Top Action Bar - appears when an item is selected */}
          {canManageStock && selectedItemId && (
            <div className="flex gap-2 animate-in fade-in slide-in-from-right-5">
              <Button
                variant="outline"
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
                onClick={() => {
                  const item = inventory.find(i => i.id === selectedItemId);
                  if (item) handleEditItem(item);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar Selecionado
              </Button>
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                onClick={() => {
                  const item = inventory.find(i => i.id === selectedItemId);
                  if (item && window.confirm(`Tem certeza que deseja excluir '${item.name}'?`)) {
                    deleteItem(item.id);
                    showToast('success', 'Item removido.');
                    setSelectedItemId(null);
                  }
                }}
              >
                {/* pointer-events-none is mandatory here */}
                <Trash className="mr-2 h-4 w-4 pointer-events-none" />
                Excluir
              </Button>
            </div>
          )}

          <Button 
            variant={showFilters ? "secondary" : "outline"} 
            className="flex-1 md:flex-none"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
          </Button>

          {canManageStock && (
            <Button 
              variant="primary" 
              className="flex-1 md:flex-none"
              onClick={() => setIsNewItemModalOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo Item
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <input 
                type="text" 
                placeholder="Buscar por nome, SKU..." 
                className="w-full pl-10 pr-4 py-2 rounded-md border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Expanded Filters */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 animate-in slide-in-from-top-2">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Categoria</label>
                  <div className="relative">
                    <select 
                      className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 px-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                    >
                      <option value="all">Todas as Categorias</option>
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                  <div className="relative">
                    <select 
                      className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-700 py-2 px-3 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="all">Todos os Status</option>
                      <option value="Normal">Normal</option>
                      <option value="Crítico">Crítico</option>
                      <option value="Em Reposição">Em Reposição</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6 md:mx-0">
            <div className="inline-block min-w-full align-middle">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                  <tr>
                    <th className="px-4 py-3 rounded-l-md whitespace-nowrap">SKU</th>
                    <th className="px-4 py-3 min-w-[150px]">Item</th>
                    <th className="px-4 py-3 hidden md:table-cell">Categoria</th>
                    <th className="px-4 py-3 text-right">Preço Unit.</th>
                    <th className="px-4 py-3 text-right">Qtd.</th>
                    <th className="px-4 py-3 text-center hidden md:table-cell">Unid.</th>
                    <th className="px-4 py-3 text-right hidden md:table-cell">Mín.</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right rounded-r-md">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedInventory.map(item => {
                    const displayStatus = getItemDisplayStatus(item);
                    return (
                      <tr 
                        key={item.id} 
                        // If selected, use a distinct blue background, otherwise standard hover
                        className={`transition-colors cursor-pointer ${selectedItemId === item.id ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-slate-50'}`}
                        // Clicking the row sets it as selected. Clicking again deselects it.
                        onClick={() => setSelectedItemId(selectedItemId === item.id ? null : item.id)}
                      >
                        <td className="px-4 py-3 font-medium text-slate-600">{item.sku}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                        <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{item.category}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(item.price)}</td>
                        <td className="px-4 py-3 text-right font-bold">{item.current_qty}</td>
                        <td className="px-4 py-3 text-center text-slate-400 text-xs hidden md:table-cell">{item.unit}</td>
                        <td className="px-4 py-3 text-right text-slate-500 hidden md:table-cell">{item.min_qty}</td>
                        <td className="px-4 py-3">
                          <Badge variant={getBadgeVariant(displayStatus)}>
                            {displayStatus}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <div className="flex justify-end items-center gap-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700 hover:border-red-300 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenWithdraw(item);
                              }} 
                              title="Registrar Saída"
                            >
                              <Minus className="w-3 h-3 mr-1.5" />
                              Retirar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenRequest(item);
                              }} 
                              title="Solicitar Reposição"
                            >
                              <Plus className="w-3 h-3 mr-1.5" />
                              Repor
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredInventory.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                        Nenhum item encontrado com os filtros atuais.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {filteredInventory.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-4">
              <div className="text-sm text-slate-500">
                Página <span className="font-medium">{currentPage}</span> de <span className="font-medium">{totalPages}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={goToPrevPage} 
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={goToNextPage} 
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* New/Edit Item Modal */}
      {isNewItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <Card className="w-full max-w-lg animate-in fade-in zoom-in-95 duration-200 my-auto">
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle>{editingItem ? 'Editar Item' : 'Adicionar Novo Item'}</CardTitle>
              <button onClick={handleCloseItemModal} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitNewItem} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  
                  {/* Item Name */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Item</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: Teclado Mecânico"
                      className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={newItemData.name}
                      onChange={e => setNewItemData({...newItemData, name: e.target.value})}
                    />
                  </div>
                  
                  {/* SKU - Auto-Generated */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 flex justify-between">
                      SKU
                      {!editingItem && (
                        <span className="text-[10px] text-blue-600 font-normal self-center flex items-center gap-1">
                          <RefreshCw size={10} /> Automático
                        </span>
                      )}
                    </label>
                    <input 
                      readOnly
                      type="text" 
                      className="w-full p-2 border border-slate-200 bg-slate-100 text-slate-500 rounded-md cursor-not-allowed focus:outline-none"
                      value={newItemData.sku}
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                    <input 
                      type="text" 
                      list="category-suggestions"
                      placeholder="Ex: Periféricos"
                      className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={newItemData.category}
                      onChange={e => setNewItemData({...newItemData, category: e.target.value})}
                    />
                    <datalist id="category-suggestions">
                      {categories.map(c => <option key={c} value={c} />)}
                    </datalist>
                  </div>

                  {/* Price */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Preço Unit. (R$)</label>
                    <input 
                      type="number" step="0.01" min="0"
                      className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      value={newItemData.price}
                      onChange={e => setNewItemData({...newItemData, price: parseFloat(e.target.value)})}
                    />
                  </div>

                   {/* Unit (UoM) */}
                   <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Unidade</label>
                    <select 
                      className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                      value={newItemData.unit}
                      onChange={e => setNewItemData({...newItemData, unit: e.target.value as UnitOfMeasure})}
                    >
                      <option value="UN">UN - Unidade</option>
                      <option value="KG">KG - Quilograma</option>
                      <option value="CX">CX - Caixa</option>
                    </select>
                  </div>

                  {/* Quantities */}
                  <div className="col-span-2 grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 mt-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                        {editingItem ? 'Estoque Atual' : 'Estoque Inicial'} 
                        {!editingItem && <Lock className="w-3 h-3 text-slate-400" />}
                      </label>
                      <input 
                        readOnly={!editingItem} // Editable only in edit mode if needed, or keep locked? Usually stock adjustments are via logs. Keeping locked for audit trail.
                        type="number" 
                        className={`w-full p-2 border border-slate-200 bg-slate-100 text-slate-500 rounded-md focus:outline-none font-medium ${!editingItem ? 'cursor-not-allowed' : ''}`}
                        value={editingItem ? editingItem.current_qty : 0}
                        title={editingItem ? "Ajustes de quantidade devem ser feitos via Entrada/Saída" : "O estoque inicial deve ser 0 para manter a integridade da auditoria."}
                      />
                      {!editingItem && (
                        <p className="text-[10px] text-orange-600 mt-1 leading-tight">
                          A entrada de estoque deve ser feita exclusivamente via Solicitação de Compra.
                        </p>
                      )}
                      {editingItem && (
                        <p className="text-[10px] text-slate-400 mt-1 leading-tight">
                          Para ajustar a quantidade, utilize as funções Repor ou Retirar.
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1 flex justify-between">
                        Estoque Mín.
                        <span className="text-[10px] text-red-500 font-normal self-center">*Obrigatório</span>
                      </label>
                      <input 
                        required
                        type="number" min="1"
                        placeholder="Mín: 5"
                        className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        value={newItemData.min_qty}
                        onChange={e => setNewItemData({...newItemData, min_qty: parseInt(e.target.value)})}
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Padrão sugerido: 5</p>
                    </div>
                  </div>

                </div>
                
                <div className="pt-4 flex items-center justify-between">
                  {/* Left side: Delete Button (Only in Edit Mode) */}
                  <div>
                    {editingItem && (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                        onClick={() => {
                          if (window.confirm(`Tem certeza que deseja excluir ${editingItem.name} permanentemente?`)) {
                            deleteItem(editingItem.id);
                            showToast('success', 'Item removido do estoque.');
                            handleCloseItemModal();
                          }
                        }}
                      >
                        <Trash className="w-4 h-4 mr-2" />
                        Excluir Item
                      </Button>
                    )}
                  </div>
                  
                  {/* Right side: Cancel & Save */}
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" onClick={handleCloseItemModal}>Cancelar</Button>
                    <Button type="submit" variant="primary">{editingItem ? 'Salvar Alterações' : 'Criar Item'}</Button>
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Replenish Modal */}
      {isRequestModalOpen && selectedItemForRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle>Solicitar Reposição</CardTitle>
              <button onClick={() => setIsRequestModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-md border border-slate-100">
                  <p className="font-medium text-slate-900">{selectedItemForRequest.name}</p>
                  <p className="text-sm text-slate-500">SKU: {selectedItemForRequest.sku} | Atual: {selectedItemForRequest.current_qty} {selectedItemForRequest.unit}</p>
                  {selectedItemForRequest.status === 'Crítico' && (
                    <div className="mt-2 flex items-center text-xs text-red-600 font-medium">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      Item em estado crítico
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade ({selectedItemForRequest.unit})</label>
                  <input 
                    type="number" 
                    min="1"
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={requestQty}
                    onChange={(e) => setRequestQty(parseInt(e.target.value) || 0)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setIsRequestModalOpen(false)}>Cancelar</Button>
                  <Button variant="primary" onClick={submitRequest}>Confirmar Pedido</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Withdraw Modal */}
      {isWithdrawModalOpen && selectedItemForWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200 border-t-4 border-t-orange-500">
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-orange-700">Registrar Saída de Estoque</CardTitle>
              <button onClick={() => setIsWithdrawModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitWithdraw} className="space-y-4">
                <div className="bg-orange-50 p-3 rounded-md border border-orange-100">
                  <p className="font-medium text-slate-900">{selectedItemForWithdraw.name}</p>
                  <p className="text-sm text-slate-600">SKU: {selectedItemForWithdraw.sku}</p>
                  <div className="mt-2 text-sm text-orange-900 flex items-center gap-2">
                     <ClipboardList className="w-4 h-4" />
                     Saldo Atual: <span className="font-bold text-lg">{selectedItemForWithdraw.current_qty} {selectedItemForWithdraw.unit}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade a Retirar</label>
                  <input 
                    required
                    type="number" 
                    min="1"
                    max={selectedItemForWithdraw.current_qty}
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    value={withdrawQty}
                    onChange={(e) => setWithdrawQty(parseInt(e.target.value) || 0)}
                  />
                  {withdrawQty > selectedItemForWithdraw.current_qty && (
                    <p className="text-xs text-red-500 mt-1">Quantidade indisponível em estoque.</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Motivo / Destino <span className="text-red-500">*</span>
                  </label>
                  <textarea 
                    required
                    rows={3}
                    placeholder="Ex: Uso Interno - RH, Manutenção..."
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-orange-500 focus:outline-none text-sm resize-none"
                    value={withdrawReason}
                    onChange={(e) => setWithdrawReason(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setIsWithdrawModalOpen(false)}>Cancelar</Button>
                  <Button 
                    type="submit" 
                    variant="primary" 
                    className="bg-orange-600 hover:bg-orange-700 border-none"
                    disabled={withdrawQty > selectedItemForWithdraw.current_qty || withdrawQty <= 0}
                  >
                    Confirmar Saída
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};