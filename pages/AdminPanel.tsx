import React, { useState } from 'react';
import { useERP } from '../contexts/ERPContext';
import { useAuth } from '../contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Activity, Users, FileText, Plus, X, Lock, RotateCcw, CheckCircle, AlertOctagon, ChevronLeft, ChevronRight, Search, Trash } from 'lucide-react';
import { Role, User } from '../types';

export const AdminPanel: React.FC = () => {
  const { users, logs, updateUserRole, addUser, resetUserPassword, deactivateUser, activateUser } = useERP();
  const { user: currentUser } = useAuth();

  // State for Add User Modal
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
  const [newUserData, setNewUserData] = useState<{name: string, email: string, role: Role}>({
    name: '',
    email: '',
    role: 'COMUM'
  });

  // State for Reset Password Confirmation
  const [userToReset, setUserToReset] = useState<User | null>(null);
  
  // Feedback States
  const [toast, setToast] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // View Mode & Search State
  const [viewMode, setViewMode] = useState<'active' | 'inactive'>('active');
  const [searchTerm, setSearchTerm] = useState('');

  // Pagination for Logs
  const [logPage, setLogPage] = useState(1);
  const LOGS_PER_PAGE = 10;

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newUserData.name || !newUserData.email) return;

    setIsLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL;
      
      const response = await fetch(`${apiUrl}/api/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newUserData,
          department: 'Geral',
          password: 'Mudar@123'
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar usuário');
      }

      addUser({ ...data, is_active: true });

      setIsAddUserModalOpen(false);
      setNewUserData({ name: '', email: '', role: 'COMUM' });
      showToast('success', 'Usuário criado com sucesso!');

    } catch (error: any) {
      console.error(error);
      showToast('error', error.message || 'Erro ao conectar com o servidor');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = () => {
    if (userToReset) {
      resetUserPassword(userToReset.id);
      setUserToReset(null);
      showToast('success', 'Senha resetada com sucesso');
    }
  };

  if (!currentUser) return null;

  const isMaster = currentUser.role === 'ADM_MASTER';

  const filteredUsers = users.filter(user => {
    const matchesMode = viewMode === 'active' ? user.is_active : !user.is_active;
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      user.name.toLowerCase().includes(term) || 
      user.email.toLowerCase().includes(term);

    return matchesMode && matchesSearch;
  });

  const totalLogPages = Math.ceil(logs.length / LOGS_PER_PAGE);
  const paginatedLogs = logs.slice(
    (logPage - 1) * LOGS_PER_PAGE,
    logPage * LOGS_PER_PAGE
  );

  const goToNextLogPage = () => {
    if (logPage < totalLogPages) setLogPage(logPage + 1);
  };

  const goToPrevLogPage = () => {
    if (logPage > 1) setLogPage(logPage - 1);
  };

  return (
    <div className="space-y-6 relative">
      {toast && (
        <div className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-5 z-50 flex items-center gap-2 text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertOctagon className="w-5 h-5" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Painel Administrativo</h1>
          <p className="text-slate-500">Gerenciamento de usuários e auditoria do sistema</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="lg:col-span-2 space-y-6">
           <Card>
            <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-600" />
                Gerenciamento de Usuários
              </CardTitle>
              
              <div className="flex flex-col md:flex-row items-center gap-3 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar por nome ou e-mail..."
                    className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-md">
                     <button 
                       onClick={() => setViewMode('active')}
                       className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${viewMode === 'active' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                       Ativos
                     </button>
                     <button 
                       onClick={() => setViewMode('inactive')}
                       className={`px-3 py-1 text-xs font-medium rounded-sm transition-all ${viewMode === 'inactive' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                     >
                       Inativos
                     </button>
                  </div>
                  
                  {isMaster && (
                    <Button size="sm" onClick={() => setIsAddUserModalOpen(true)}>
                      <Plus className="w-4 h-4 mr-1" /> Novo
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                      <th className="px-4 py-3 rounded-l-md">Nome</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Função Atual</th>
                      <th className="px-4 py-3">Alterar Função</th>
                      <th className="px-4 py-3 text-center rounded-r-md">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredUsers.map(u => (
                      <tr key={u.id} className={`group hover:bg-slate-50 transition-colors ${!u.is_active ? 'opacity-60 bg-slate-50/50' : ''}`}>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          <div className="flex items-center gap-2">
                            {u.name} 
                            {u.id === currentUser.id && <span className="text-xs text-slate-400 font-normal">(Você)</span>}
                            {!u.is_active && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded border border-red-200">Inativo</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500">{u.email}</td>
                        <td className="px-4 py-3">
                           <Badge variant={!u.is_active ? 'outline' : 'default'}>{u.role}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <select 
                            className={`bg-white border border-slate-200 text-slate-700 text-xs rounded-md p-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none ${!isMaster || !u.is_active ? 'opacity-50 cursor-not-allowed bg-slate-100' : ''}`}
                            value={u.role}
                            disabled={!isMaster || u.id === currentUser.id || !u.is_active}
                            onChange={(e) => updateUserRole(u.id, e.target.value as Role)}
                          >
                            <option value="ADM_MASTER">Admin Master</option>
                            <option value="GESTOR">Gestor</option>
                            <option value="TI">TI</option>
                            <option value="COMUM">Comum</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-center h-12">
                          {isMaster && u.id !== currentUser.id && (
                            <div className="flex items-center justify-center gap-1">
                              {u.is_active ? (
                                <>
                                  <button
                                    onClick={() => setUserToReset(u)}
                                    className="text-slate-400 hover:text-orange-500 transition-colors p-2 rounded-full hover:bg-orange-50"
                                    title="Resetar para senha padrão (Mudar@123)"
                                  >
                                    <RotateCcw className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={async () => {
                                      if (window.confirm('Tem certeza que deseja desativar o usuário ' + u.name + '?')) {
                                        try {
                                          await deactivateUser(u.id);
                                          showToast('success', 'Usuário desativado com sucesso.');
                                        } catch (error: any) {
                                          showToast('error', error.message || 'Falha ao desativar usuário.');
                                        }
                                      }
                                    }}
                                    className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-full transition-colors"
                                    title="Desativar Usuário"
                                  >
                                    <Trash className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={async () => {
                                    if (window.confirm('Tem certeza que deseja reativar o usuário ' + u.name + '?')) {
                                      try {
                                        await activateUser(u.id);
                                        showToast('success', 'Usuário reativado com sucesso.');
                                      } catch (error: any) {
                                        showToast('error', error.message || 'Falha ao reativar usuário.');
                                      }
                                    }
                                  }}
                                  className="text-slate-400 hover:text-green-600 hover:bg-green-50 p-2 rounded-full transition-colors"
                                  title="Reativar Usuário"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-6 text-slate-500">
                          {searchTerm 
                            ? 'Nenhum usuário encontrado para a busca.' 
                            : 'Nenhum usuário encontrado nesta categoria.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
           <Card className="h-full max-h-[600px] flex flex-col">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-orange-500" />
                Log de Atividades
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0 flex flex-col">
               <div className="divide-y divide-slate-100 flex-1">
                 {paginatedLogs.map(log => (
                   <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors">
                     <div className="flex items-start justify-between mb-1">
                        <span className="font-semibold text-sm text-slate-800">{log.action}</span>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                     </div>
                     <p className="text-xs text-slate-600 mb-2">{log.description}</p>
                     
                     {log.previous_status && (
                       <div className="mb-2 text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded inline-block">
                         <span className="font-medium">Anterior:</span> {log.previous_status}
                       </div>
                     )}

                     <div className="flex items-center gap-1 text-[10px] text-slate-400">
                        <FileText className="w-3 h-3" />
                        <span>Por: {log.user_name}</span>
                     </div>
                   </div>
                 ))}
                 {logs.length === 0 && (
                   <div className="p-8 text-center text-slate-400 text-sm">
                     Nenhum registro encontrado.
                   </div>
                 )}
               </div>

               {logs.length > 0 && (
                  <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white shrink-0">
                     <div className="text-xs text-slate-500">
                       Página <span className="font-medium">{logPage}</span> de <span className="font-medium">{totalLogPages}</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <Button 
                           variant="outline" 
                           size="sm" 
                           onClick={goToPrevLogPage} 
                           disabled={logPage === 1}
                           className="h-8 w-8 p-0"
                        >
                           <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button 
                           variant="outline" 
                           size="sm" 
                           onClick={goToNextLogPage} 
                           disabled={logPage === totalLogPages}
                           className="h-8 w-8 p-0"
                        >
                           <ChevronRight className="h-4 w-4" />
                        </Button>
                     </div>
                  </div>
               )}
            </CardContent>
          </Card>
        </div>

      </div>

      {isAddUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle>Novo Usuário</CardTitle>
              <button onClick={() => setIsAddUserModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                  <input 
                    required
                    type="text" 
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={newUserData.name}
                    onChange={e => setNewUserData({...newUserData, name: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input 
                    required
                    type="email" 
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    value={newUserData.email}
                    onChange={e => setNewUserData({...newUserData, email: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Função</label>
                  <select 
                    className="w-full p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    value={newUserData.role}
                    onChange={(e) => setNewUserData({...newUserData, role: e.target.value as Role})}
                  >
                    <option value="ADM_MASTER">Admin Master (Acesso Total)</option>
                    <option value="GESTOR">Gestor (Aprovações)</option>
                    <option value="TI">TI (Solicitações)</option>
                    <option value="COMUM">Comum (Solicitações)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={() => setIsAddUserModalOpen(false)}>Cancelar</Button>
                  <Button type="submit" variant="primary" disabled={isLoading}>
                    {isLoading ? 'Salvando...' : 'Criar Usuário'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {userToReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <Card className="w-full max-w-sm animate-in fade-in zoom-in-95 duration-200 border-t-4 border-t-orange-500">
            <CardHeader className="relative flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-orange-700 flex items-center gap-2">
                 <Lock className="w-5 h-5" /> Resetar Senha
              </CardTitle>
              <button onClick={() => setUserToReset(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </CardHeader>
            <CardContent>
               <div className="space-y-4">
                 <p className="text-sm text-slate-600">
                   Deseja resetar a senha do usuário <span className="font-bold text-slate-900">{userToReset.name}</span> para o padrão?
                 </p>
                 <div className="bg-slate-100 p-2 rounded text-xs font-mono text-center border border-slate-200 text-slate-700">
                   Senha Padrão: Mudar@123
                 </div>
                 
                 <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setUserToReset(null)}>Cancelar</Button>
                  <Button variant="primary" className="bg-orange-600 hover:bg-orange-700 border-none" onClick={handleConfirmReset}>Confirmar Reset</Button>
                </div>
               </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
