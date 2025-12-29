/// <reference types="vite/client" />
import React, { createContext, useContext, useState, useEffect } from 'react';

// Tipagem do Usuário
interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Ao iniciar, verifica se já tem usuário salvo no navegador (persistência)
  useEffect(() => {
    const savedUser = localStorage.getItem('erp_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      // Pega a URL da API do arquivo .env (http://localhost:5000)
      // A linha /// <reference... no topo corrige o erro aqui
      const apiUrl = import.meta.env.VITE_API_BASE_URL;

      // Faz a chamada real para o seu Docker Backend
      const response = await fetch(`${apiUrl}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Falha no login');
      }

      // Se deu certo, salva o usuário
      setUser(data);
      localStorage.setItem('erp_user', JSON.stringify(data));
      
    } catch (error) {
      console.error('Erro de login:', error);
      throw error; // Joga o erro para a tela de Login exibir o alerta
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('erp_user');
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      isAuthenticated: !!user,
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}