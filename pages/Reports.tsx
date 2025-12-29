import React, { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useERP } from '../contexts/ERPContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Lock, FileText, Package, ShoppingCart, Activity, Filter, Calendar, User as UserIcon, ListFilter, Download } from 'lucide-react';
import { InventoryItem, ItemStatus } from '../types';

export const Reports: React.FC = () => {
  const { inventory, requests, logs, users, addLog } = useERP();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'stock' | 'orders' | 'logs'>('stock');

  // --- Filter States ---
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterUser, setFilterUser] = useState('all');

  // --- Access Control ---
  if (!user) return null;
  const hasAccess = ['ADM_MASTER', 'GESTOR'].includes(user.role);

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  // --- Helpers ---
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const getItemDisplayStatus = (item: InventoryItem): ItemStatus => {
    if (item.status === 'Normal') return 'Normal';
    const hasPendingReplenishment = requests.some(
      r => r.item_id === item.id && r.status === 'APROVADO'
    );
    return hasPendingReplenishment ? 'Em Reposição' : 'Crítico';
  };

  const getBadgeVariant = (status: string) => {
    switch (status) {
      case 'Crítico': return 'danger';
      case 'Em Reposição': return 'warning';
      case 'Normal': return 'success';
      case 'APROVADO': return 'success';
      case 'REJEITADO': return 'danger';
      case 'PENDENTE': return 'warning';
      case 'COMPRADO': return 'default';
      default: return 'outline';
    }
  };

  // --- Derived Data for Selects ---
  const categories = useMemo(() => {
    const cats = new Set(inventory.map(i => i.category));
    // Also include categories from custom requests
    requests.forEach(r => { if(r.custom_category) cats.add(r.custom_category); });
    return Array.from(cats);
  }, [inventory, requests]);

  // --- Filter Logic ---
  const filteredStock = useMemo(() => {
    return inventory.filter(item => {
      const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
      const status = getItemDisplayStatus(item);
      const matchesStatus = filterStatus === 'all' || status === filterStatus;
      return matchesCategory && matchesStatus;
    });
  }, [inventory, filterCategory, filterStatus, requests]);

  const filteredOrders = useMemo(() => {
    return requests.filter(req => {
      // Date Range
      const reqDate = req.date; // YYYY-MM-DD
      const matchesDate = (!startDate || reqDate >= startDate) && (!endDate || reqDate <= endDate);
      
      // User - CORRIGIDO: Comparar como string para evitar erro de tipo
      const matchesUser = filterUser === 'all' || String(req.requester_id) === filterUser;

      // Category
      const item = inventory.find(i => i.id === req.item_id);
      const category = item ? item.category : req.custom_category || 'Outros';
      const matchesCategory = filterCategory === 'all' || category === filterCategory;

      return matchesDate && matchesUser && matchesCategory;
    });
  }, [requests, inventory, startDate, endDate, filterUser, filterCategory]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Date Range (Log timestamp is ISO)
      const logDate = log.timestamp.split('T')[0];
      const matchesDate = (!startDate || logDate >= startDate) && (!endDate || logDate <= endDate);

      // User - CORRIGIDO: Comparar como string para evitar erro de tipo
      const matchesUser = filterUser === 'all' || String(log.user_id) === filterUser;
      
      // Category is not applicable to logs directly, so we ignore it or could filter description text.
      
      return matchesDate && matchesUser;
    });
  }, [logs, startDate, endDate, filterUser]);

  // --- Export Logic ---
  const handleExport = () => {
    const dateStr = new Date().toISOString().split('T')[0];
    const BOM = "\uFEFF";
    let csvContent = BOM; // UTF-8 BOM
    let fileName = '';
    
    // Helper to safely format CSV fields with semicolons
    const safeStr = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      // Quote strings that might contain delimiters or newlines
      if (str.includes(';') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    if (activeTab === 'stock') {
      fileName = `Relatorio_Estoque_${dateStr}.csv`;
      const headers = ['SKU', 'Item', 'Categoria', 'Qtd Atual', 'Unidade', 'Preço Unit', 'Valor Total', 'Status'];
      csvContent += headers.join(';') + '\n';
      
      csvContent += filteredStock.map(item => {
        const totalValue = item.price * item.current_qty;
        const status = getItemDisplayStatus(item);
        return [
          item.sku,
          item.name,
          item.category,
          item.current_qty,
          item.unit,
          item.price.toFixed(2), // Raw number, 2 decimals
          totalValue.toFixed(2),
          status
        ].map(safeStr).join(';');
      }).join('\n');

    } else if (activeTab === 'orders') {
      fileName = `Relatorio_Pedidos_${dateStr}.csv`;
      const headers = ['ID', 'Data', 'Solicitante', 'Item', 'Categoria', 'Qtd', 'Preço Unit', 'Valor Total', 'Status', 'Observacao'];
      csvContent += headers.join(';') + '\n';

      csvContent += filteredOrders.map(req => {
        const item = inventory.find(i => String(i.id) === String(req.item_id));
        const itemName = item ? item.name : req.custom_item_name || 'Item Desconhecido';
        const category = item ? item.category : req.custom_category || 'Outros';
        
        // CORRIGIDO: Garantir que os valores são numéricos antes de calcular e formatar
        const unitPrice = Number(req.unit_price) || 0;
        const quantity = Number(req.quantity) || 0;
        const totalValue = unitPrice * quantity;

        return [
          req.id,
          req.date,
          req.requester_name,
          itemName,
          category,
          quantity,
          unitPrice.toFixed(2),
          totalValue.toFixed(2),
          req.status,
          req.observation || ''
        ].map(safeStr).join(';');
      }).join('\n');

    } else if (activeTab === 'logs') {
      fileName = `Relatorio_Logs_${dateStr}.csv`;
      const headers = ['Data Hora', 'Usuario', 'Acao', 'Descricao'];
      csvContent += headers.join(';') + '\n';

      csvContent += filteredLogs.map(log => [
        new Date(log.timestamp).toLocaleString('pt-BR'),
        log.user_name,
        log.action,
        log.description
      ].map(safeStr).join(';')).join('\n');
    }

    // Trigger Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Audit Log
    const reportNames = {
      'stock': 'Estoque Atual',
      'orders': 'Histórico de Pedidos',
      'logs': 'Log de Movimentações'
    };
    addLog('Exportação CSV', `${user.name} baixou o relatório: ${reportNames[activeTab]}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Relatórios Gerenciais</h1>
          <p className="text-slate-500">Visualização consolidada de dados do sistema</p>
        </div>
        <Button variant="outline" onClick={handleExport} title="Exportar dados da aba atual para CSV">
          <Download className="w-4 h-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* --- Global Filter Bar --- */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-end md:items-center justify-between animate-in fade-in slide-in-from-top-2">
         <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
            <Filter className="w-4 h-4 text-blue-600" />
            Filtros do Relatório
         </div>

         <div className="flex flex-wrap gap-3 items-center flex-1 justify-end">
            
            {/* Condition: Stock Tab -> Category & Status */}
            {activeTab === 'stock' && (
              <>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-500">Categoria</label>
                    <select 
                      className="form-select text-sm border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1.5"
                      value={filterCategory}
                      onChange={e => setFilterCategory(e.target.value)}
                    >
                      <option value="all">Todas as Categorias</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-500">Status</label>
                    <select 
                      className="form-select text-sm border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1.5"
                      value={filterStatus}
                      onChange={e => setFilterStatus(e.target.value)}
                    >
                      <option value="all">Todos os Status</option>
                      <option value="Normal">Normal</option>
                      <option value="Crítico">Crítico</option>
                      <option value="Em Reposição">Em Reposição</option>
                    </select>
                </div>
              </>
            )}

            {/* Condition: Orders OR Logs -> Date, User, Category */}
            {(activeTab === 'orders' || activeTab === 'logs') && (
              <>
                 <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Período
                    </label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="date" 
                        className="text-sm border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1.5"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                      />
                      <span className="text-slate-400">-</span>
                      <input 
                        type="date" 
                        className="text-sm border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1.5"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                      />
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <UserIcon className="w-3 h-3" /> Usuário
                    </label>
                    <select 
                      className="form-select text-sm border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1.5 min-w-[150px]"
                      value={filterUser}
                      onChange={e => setFilterUser(e.target.value)}
                    >
                      <option value="all">Todos os Usuários</option>
                      {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                </div>

                <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
                      <ListFilter className="w-3 h-3" /> Categoria
                    </label>
                    <select 
                      className={`form-select text-sm border-slate-300 rounded-md focus:ring-blue-500 focus:border-blue-500 py-1.5 ${activeTab === 'logs' ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                      value={filterCategory}
                      onChange={e => setFilterCategory(e.target.value)}
                      disabled={activeTab === 'logs'}
                      title={activeTab === 'logs' ? "Filtro de categoria não aplicável para logs" : ""}
                    >
                      <option value="all">Todas as Categorias</option>
                      {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
              </>
            )}
         </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => { setActiveTab('stock'); setFilterCategory('all'); setFilterStatus('all'); }}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
            activeTab === 'stock' 
              ? 'bg-white border-x border-t border-slate-200 text-blue-600 -mb-[1px]' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Package className="w-4 h-4" />
          Estoque Atual
        </button>
        <button
          onClick={() => { setActiveTab('orders'); setFilterCategory('all'); setFilterUser('all'); setStartDate(''); setEndDate(''); }}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
            activeTab === 'orders' 
              ? 'bg-white border-x border-t border-slate-200 text-blue-600 -mb-[1px]' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <ShoppingCart className="w-4 h-4" />
          Histórico de Pedidos
        </button>
        <button
          onClick={() => { setActiveTab('logs'); setFilterCategory('all'); setFilterUser('all'); setStartDate(''); setEndDate(''); }}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 ${
            activeTab === 'logs' 
              ? 'bg-white border-x border-t border-slate-200 text-blue-600 -mb-[1px]' 
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Activity className="w-4 h-4" />
          Log de Movimentações
        </button>
      </div>

      {/* Tab Content */}
      <Card className="min-h-[400px]">
        <CardContent className="p-0">
          
          {/* TAB: STOCK */}
          {activeTab === 'stock' && (
            <div className="overflow-x-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                  <tr>
                    <th className="px-6 py-4">SKU</th>
                    <th className="px-6 py-4">Item</th>
                    <th className="px-6 py-4">Categoria</th>
                    <th className="px-6 py-4 text-right">Qtd. Atual</th>
                    <th className="px-6 py-4 text-center">Unid.</th>
                    <th className="px-6 py-4 text-right">Preço Unit.</th>
                    <th className="px-6 py-4 text-right">Valor Total</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredStock.map(item => {
                    const status = getItemDisplayStatus(item);
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 font-medium text-slate-600">{item.sku}</td>
                        <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                        <td className="px-6 py-4 text-slate-500">{item.category}</td>
                        <td className="px-6 py-4 text-right font-bold">{item.current_qty}</td>
                        <td className="px-6 py-4 text-center text-slate-400 text-xs">{item.unit}</td>
                        <td className="px-6 py-4 text-right text-slate-600">{formatCurrency(item.price)}</td>
                        <td className="px-6 py-4 text-right font-medium text-slate-900">
                           {formatCurrency(item.price * item.current_qty)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={getBadgeVariant(status)}>{status}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredStock.length === 0 && (
                     <tr><td colSpan={8} className="text-center py-8 text-slate-500">Nenhum item encontrado com os filtros selecionados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: ORDERS */}
          {activeTab === 'orders' && (
            <div className="overflow-x-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
               <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                  <tr>
                    <th className="px-6 py-4">ID</th>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Solicitante</th>
                    <th className="px-6 py-4">Item</th>
                    <th className="px-6 py-4 text-center">Qtd.</th>
                    <th className="px-6 py-4 text-right">Valor Total</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOrders.map(req => {
                     const item = inventory.find(i => i.id === req.item_id);
                     const itemName = item ? item.name : req.custom_item_name || 'Item Desconhecido';
                     return (
                      <tr key={req.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-slate-500 font-mono text-xs">#{req.id}</td>
                        <td className="px-6 py-4 text-slate-600">{new Date(req.date).toLocaleDateString('pt-BR')}</td>
                        <td className="px-6 py-4 text-slate-900 font-medium">{req.requester_name}</td>
                        <td className="px-6 py-4 text-slate-600">{itemName}</td>
                        <td className="px-6 py-4 text-center">{req.quantity}</td>
                        <td className="px-6 py-4 text-right text-slate-600">
                          {formatCurrency((req.unit_price || 0) * req.quantity)}
                        </td>
                        <td className="px-6 py-4">
                          <Badge variant={getBadgeVariant(req.status)}>{req.status}</Badge>
                        </td>
                      </tr>
                     );
                  })}
                  {filteredOrders.length === 0 && (
                     <tr><td colSpan={7} className="text-center py-8 text-slate-500">Nenhum pedido encontrado no período selecionado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB: LOGS */}
          {activeTab === 'logs' && (
            <div className="overflow-x-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
               <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 font-medium">
                  <tr>
                    <th className="px-6 py-4">Data/Hora</th>
                    <th className="px-6 py-4">Usuário</th>
                    <th className="px-6 py-4">Ação</th>
                    <th className="px-6 py-4">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-slate-500 text-xs whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-900">{log.user_name}</td>
                      <td className="px-6 py-4 text-slate-600">
                         <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-xs font-medium">
                           {log.action}
                         </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 max-w-lg truncate" title={log.description}>
                        {log.description}
                      </td>
                    </tr>
                  ))}
                  {filteredLogs.length === 0 && (
                     <tr><td colSpan={4} className="text-center py-8 text-slate-500">Nenhum registro de atividade encontrado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

        </CardContent>
      </Card>
    </div>
  );
};
