import React, { useState, useMemo } from 'react';
import { useERP } from '../contexts/ERPContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { AlertTriangle, Clock, DollarSign, TrendingUp, Filter, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export const Dashboard: React.FC = () => {
  const { inventory, requests } = useERP();
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');

  // 1. Extract Unique Categories for Filter
  const categories = useMemo(() => {
    const cats = Array.from(new Set(inventory.map(i => i.category)));
    return ['Todas', ...cats];
  }, [inventory]);

  // 2. Filter Data based on Selection
  const filteredInventory = useMemo(() => {
    if (selectedCategory === 'Todas') return inventory;
    return inventory.filter(i => i.category === selectedCategory);
  }, [inventory, selectedCategory]);

  const filteredRequests = useMemo(() => {
    if (selectedCategory === 'Todas') return requests;
    return requests.filter(req => {
      // Logic: Match request to item category, or check custom category for new items
      const item = inventory.find(i => i.id === req.item_id);
      if (item) return item.category === selectedCategory;
      return req.custom_category === selectedCategory;
    });
  }, [requests, inventory, selectedCategory]);

  // 3. Recalculate Metrics Locally
  const metrics = useMemo(() => {
    const criticalItemsCount = filteredInventory.filter(i => i.status === 'Crítico').length;
    const pendingRequestsCount = filteredRequests.filter(r => r.status === 'PENDENTE').length;
    const totalStockValue = filteredInventory.reduce((acc, item) => acc + (item.price * item.current_qty), 0);
    
    // Calculate Average Minimum Stock for the Reference Line
    const totalMinQty = filteredInventory.reduce((acc, item) => acc + item.min_qty, 0);
    const avgMinQty = filteredInventory.length > 0 ? Math.ceil(totalMinQty / filteredInventory.length) : 0;

    return {
      criticalItemsCount,
      pendingRequestsCount,
      totalStockValue,
      avgMinQty
    };
  }, [filteredInventory, filteredRequests]);

  // 4. Prepare Chart Data
  const chartData = filteredInventory.map(item => ({
    name: item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name,
    qty: item.current_qty,
    min: item.min_qty, // Individual item min
    status: item.status
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Visão Geral</h1>
          <p className="text-slate-500">Acompanhe os principais indicadores do ERP</p>
        </div>

        {/* Global Category Filter */}
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-md border border-slate-200 shadow-sm">
          <Filter className="w-4 h-4 text-slate-400 ml-2" />
          <select 
            className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer pr-8"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Critical Items Card */}
        <Card className="border-l-4 border-l-red-500 transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Itens Críticos
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-bold text-slate-900">{metrics.criticalItemsCount}</div>
              <div className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 px-2 py-1 rounded-full mb-1">
                +5% <ArrowUpRight className="w-3 h-3" />
                <span className="text-slate-400 font-normal ml-1 hidden xl:inline">vs mês anterior</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">Abaixo do estoque mínimo</p>
          </CardContent>
        </Card>

        {/* Pending Requests Card */}
        <Card className="border-l-4 border-l-yellow-500 transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Pedidos Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
             <div className="flex items-end justify-between">
              <div className="text-2xl font-bold text-slate-900">{metrics.pendingRequestsCount}</div>
              <div className="flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full mb-1">
                0% <Minus className="w-3 h-3" />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">Aguardando aprovação</p>
          </CardContent>
        </Card>

        {/* Total Stock Value Card */}
        <Card className="border-l-4 border-l-green-500 transition-all hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              Valor Total em Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div className="text-2xl font-bold text-slate-900">{formatCurrency(metrics.totalStockValue)}</div>
              <div className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full mb-1">
                +12% <ArrowUpRight className="w-3 h-3" />
                <span className="text-slate-400 font-normal ml-1 hidden xl:inline">vs mês anterior</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-1">Patrimônio atual investido</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                Níveis de Estoque por Item
              </CardTitle>
              {/* Legend for the Reference Line */}
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="block w-4 h-0.5 border-t border-dashed border-red-500"></span>
                <span>Média de Estoque Mínimo ({metrics.avgMinQty})</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="w-full flex justify-center overflow-hidden">
              {/* Temporarily using fixed dimensions to solve the build warning */}
              <BarChart 
                width={600} 
                height={300} 
                data={chartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="qty" fill="#3b82f6" name="Quantidade" />
              </BarChart>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};