import React, { useState } from 'react';
import { useERP } from '../contexts/ERPContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Check, X, ShoppingCart, User, MessageSquare, Lock, Sparkles, CheckSquare, Square, AlertCircle } from 'lucide-react';

export const Approvals: React.FC = () => {
  const { requests, updateRequestStatus, inventory } = useERP();
  const { user } = useAuth();
  
  // Local state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Guard: Ensure user is logged in
  if (!user) return null;

  const isManager = ['GESTOR', 'ADM_MASTER'].includes(user.role);

  // Strict Access Control
  if (!isManager) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] space-y-4">
        <div className="p-4 bg-slate-100 rounded-full">
          <Lock className="w-8 h-8 text-slate-400" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-900">Acesso Restrito</h2>
          <p className="text-slate-500 max-w-md mx-auto">
            Apenas Gestores e Administradores possuem acesso à Central de Aprovações. 
            Verifique seus pedidos na tela "Meus Pedidos".
          </p>
        </div>
      </div>
    );
  }

  // Enrich requests
  const enrichedRequests = requests.map(req => {
    const item = req.item_id ? inventory.find(i => i.id === req.item_id) : null;
    return { ...req, itemDetails: item };
  });

  // Filter only pending for bulk actions
  const pendingRequests = enrichedRequests.filter(r => r.status === 'PENDENTE');

  // --- Bulk Action Handlers ---
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pendingRequests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingRequests.map(r => r.id)));
    }
  };

  const handleBulkApprove = () => {
    if (window.confirm(`Confirma a aprovação de ${selectedIds.size} pedidos selecionados?`)) {
      selectedIds.forEach(id => {
        updateRequestStatus(id, 'APROVADO');
      });
      setSelectedIds(new Set());
    }
  };

  const handleReject = (id: string) => {
    const reason = window.prompt("Por favor, informe o motivo da rejeição:");
    if (reason !== null) { 
       updateRequestStatus(id, 'REJEITADO', reason);
    }
  };

  // --- UI Helpers ---
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'PENDENTE': return <Badge variant="warning">Pendente</Badge>;
      case 'APROVADO': return <Badge variant="success">Aprovado</Badge>;
      case 'REJEITADO': return <Badge variant="danger">Rejeitado</Badge>;
      case 'COMPRADO': return <Badge variant="default">Comprado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Header with Bulk Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Central de Aprovações</h1>
          <div className="flex gap-2 mt-1">
            <Badge variant="warning">{pendingRequests.length} Pendentes</Badge>
          </div>
        </div>

        {/* Bulk Actions Controls */}
        {pendingRequests.length > 0 && (
          <div className="flex items-center gap-3 bg-white p-2 rounded-md border border-slate-200 shadow-sm animate-in fade-in">
             <div className="flex items-center gap-2 px-2 border-r border-slate-200 pr-4">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  checked={selectedIds.size > 0 && selectedIds.size === pendingRequests.length}
                  onChange={toggleSelectAll}
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-sm font-medium text-slate-700 cursor-pointer select-none">
                  Selecionar Todos
                </label>
             </div>
             
             <Button 
               size="sm" 
               variant={selectedIds.size > 0 ? "primary" : "secondary"}
               disabled={selectedIds.size === 0}
               onClick={handleBulkApprove}
               className="transition-all"
             >
               <CheckSquare className="w-4 h-4 mr-2" />
               Aprovar Selecionados ({selectedIds.size})
             </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {enrichedRequests.map(req => {
          const isNewItemRequest = !req.itemDetails && !!req.custom_item_name;
          const unitPrice = req.unit_price || 0;
          const totalValue = unitPrice * req.quantity;
          const isSelected = selectedIds.has(req.id);
          
          // Stock Logic
          const currentStock = req.itemDetails?.current_qty || 0;
          const minStock = req.itemDetails?.min_qty || 0;
          const isLowStock = req.itemDetails && currentStock <= minStock;

          return (
            <Card 
              key={req.id} 
              className={`
                transition-all hover:shadow-md border-l-4 
                ${isNewItemRequest ? 'border-l-purple-500' : 'border-l-blue-500'}
                ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/30' : ''}
              `}
            >
              <CardContent className="p-0">
                <div className="flex">
                  
                  {/* Checkbox Column for Pending Items */}
                  {req.status === 'PENDENTE' && (
                    <div className="flex items-center justify-center w-12 border-r border-slate-100 bg-slate-50/50 rounded-l-lg shrink-0" onClick={() => toggleSelection(req.id)}>
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        onChange={() => toggleSelection(req.id)}
                        className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </div>
                  )}

                  <div className="flex-1 p-5">
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      
                      {/* Info Section */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-lg text-slate-900 flex items-center gap-2">
                            {req.itemDetails ? req.itemDetails.name : req.custom_item_name || 'Item Desconhecido'}
                          </h3>
                          
                          {/* Feature: High Contrast New Item Badge */}
                          {isNewItemRequest && (
                            <span className="flex items-center text-xs bg-purple-600 text-white px-2 py-0.5 rounded shadow-sm font-semibold animate-pulse">
                              <Sparkles className="w-3 h-3 mr-1" />
                              NOVO ITEM
                            </span>
                          )}

                          {getStatusBadge(req.status)}
                        </div>
                        
                        <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" /> Solicitado por: <span className="font-medium text-slate-700">{req.requester_name}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            Data: {new Date(req.date).toLocaleDateString('pt-BR')}
                          </span>
                          <span className="font-medium text-slate-700">
                            Qtd: {req.quantity}
                          </span>
                          
                          {/* Feature: Stock Context Highlighting */}
                           {req.itemDetails ? (
                            <span className={`flex items-center gap-1 ${isLowStock ? 'text-red-600 font-bold bg-red-50 px-1 rounded' : 'text-slate-400'}`}>
                               (Estoque Atual: {currentStock})
                               {isLowStock && <AlertCircle className="w-3 h-3" />}
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              (Categoria sugerida: {req.custom_category})
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 py-1">
                            <div className="text-xs bg-slate-50 px-2 py-1 rounded border border-slate-100 text-slate-600">
                                Valor Unit: <span className="font-medium text-slate-900">{formatCurrency(unitPrice)}</span>
                            </div>
                            <div className="text-xs bg-slate-50 px-2 py-1 rounded border border-slate-100 text-slate-600">
                                Valor Total: <span className="font-bold text-slate-900">{formatCurrency(totalValue)}</span>
                            </div>
                        </div>

                        {req.observation && (
                          <div className="mt-2 p-2 bg-slate-50 border border-slate-100 rounded text-sm text-slate-700 flex gap-2 items-start max-w-2xl">
                             <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                             <span className="italic">"{req.observation}"</span>
                          </div>
                        )}
                      </div>

                      {/* Actions Section */}
                      <div className="flex items-center gap-2 self-end md:self-center mt-2 md:mt-0">
                        {req.status === 'PENDENTE' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="destructive" 
                              className="bg-red-600 text-white hover:bg-red-700 border-none shadow-none"
                              onClick={() => handleReject(req.id)}
                            >
                              <X className="w-4 h-4 mr-1" /> Rejeitar
                            </Button>
                            <Button 
                              size="sm" 
                              className={`${isNewItemRequest ? 'bg-purple-600 hover:bg-purple-700' : 'bg-green-600 hover:bg-green-700'} text-white`}
                              onClick={() => updateRequestStatus(req.id, 'APROVADO')}
                              title={isNewItemRequest ? "Aprovar irá criar este item automaticamente no estoque" : "Aprovar solicitação"}
                            >
                              <Check className="w-4 h-4 mr-1" /> 
                              {isNewItemRequest ? 'Aprovar e Cadastrar' : 'Aprovar'}
                            </Button>
                          </>
                        )}

                        {req.status === 'APROVADO' && (
                          <Button 
                            size="sm" 
                            variant="primary"
                            onClick={() => updateRequestStatus(req.id, 'COMPRADO')}
                          >
                            <ShoppingCart className="w-4 h-4 mr-2" />
                            Marcar Comprado
                          </Button>
                        )}
                        
                        {(req.status === 'REJEITADO' || req.status === 'COMPRADO') && (
                           <span className="text-sm text-slate-400 italic px-3 border border-slate-100 rounded-md bg-slate-50">
                             {req.status === 'COMPRADO' ? 'Solicitação Finalizada' : 'Solicitação Encerrada'}
                           </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {enrichedRequests.length === 0 && (
          <div className="text-center py-10 text-slate-500 bg-white rounded-lg border border-dashed border-slate-300">
            Nenhuma solicitação encontrada na fila.
          </div>
        )}
      </div>
    </div>
  );
};
