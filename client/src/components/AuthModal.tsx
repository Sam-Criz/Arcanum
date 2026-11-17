import React, { useState } from 'react';
import { api, User } from '../services/api';
import { KeyRound, Mail, User as UserIcon, ArrowRight, Feather, ShieldAlert } from 'lucide-react';

interface AuthModalProps {
  onSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const res = await api.register({ email, username, password });
        onSuccess(res.user);
      } else {
        const res = await api.login({ login: email || username, password });
        onSuccess(res.user);
      }
    } catch (err: any) {
      setError(err.message || 'Erro durante a autenticação.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-65px)] flex items-center justify-center px-4 py-12 bg-[#131211] text-[#ece3d0] select-none">
      <div className="w-full max-w-md bg-[#1a1816] border border-[#3a3530] rounded-2xl p-8 sm:p-10 shadow-2xl shadow-black/60 space-y-6">
        {/* Cabeçalho Editorial Centrado */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#131211] border border-[#3a3530] text-[#c9a04e] mb-1">
            <Feather className="w-5 h-5 text-[#c9a04e]" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-[#ece3d0] tracking-tight">
            Arcanum Dossiê
          </h1>
          <p className="text-xs text-[#8a8578] max-w-xs mx-auto">
            Plataforma editorial de RPG de mesa, combate tático e preservação de crônicas.
          </p>
        </div>

        {/* Alternância de Abas Minimalista */}
        <div className="flex border-b border-[#3a3530] text-xs font-mono uppercase tracking-wider">
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setError(null);
            }}
            className={`flex-1 pb-2.5 text-center transition-colors relative ${
              !isRegister ? 'text-[#c9a04e] font-bold' : 'text-[#8a8578] hover:text-[#ece3d0]'
            }`}
          >
            <span>Acesso</span>
            {!isRegister && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c9a04e]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegister(true);
              setError(null);
            }}
            className={`flex-1 pb-2.5 text-center transition-colors relative ${
              isRegister ? 'text-[#c9a04e] font-bold' : 'text-[#8a8578] hover:text-[#ece3d0]'
            }`}
          >
            <span>Registro</span>
            {isRegister && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c9a04e]" />
            )}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-[#1f1517] border border-[#b24a52]/60 text-[#e8b5b5] text-xs rounded-lg flex items-start space-x-2">
            <ShieldAlert className="w-4 h-4 text-[#b24a52] shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div className="space-y-1">
              <label className="block text-xs font-mono text-[#8a8578] flex items-center space-x-1.5">
                <UserIcon className="w-3.5 h-3.5 text-[#c9a04e]" />
                <span>Nome de Usuário</span>
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: ExploradorDoNorte"
                className="w-full px-3.5 py-2.5 bg-[#131211] border border-[#3a3530] focus:border-[#c9a04e] rounded-xl text-sm text-[#ece3d0] placeholder-[#8a8578] focus:outline-none transition-colors"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-mono text-[#8a8578] flex items-center space-x-1.5">
              <Mail className="w-3.5 h-3.5 text-[#c9a04e]" />
              <span>{isRegister ? 'Endereço de Email' : 'Email ou Usuário'}</span>
            </label>
            <input
              type={isRegister ? 'email' : 'text'}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isRegister ? 'explorador@reino.com' : 'seu@email.com ou Usuário'}
              className="w-full px-3.5 py-2.5 bg-[#131211] border border-[#3a3530] focus:border-[#c9a04e] rounded-xl text-sm text-[#ece3d0] placeholder-[#8a8578] focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-mono text-[#8a8578] flex items-center space-x-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#c9a04e]" />
              <span>Palavra-Passe</span>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-[#131211] border border-[#3a3530] focus:border-[#c9a04e] rounded-xl text-sm text-[#ece3d0] placeholder-[#8a8578] focus:outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-[#c9a04e] hover:bg-[#d4ad5e] text-[#131211] transition-all duration-300 disabled:opacity-50 flex items-center justify-center space-x-2 active:scale-95 pt-3"
          >
            <span>{loading ? 'Consultando...' : isRegister ? 'Confirmar Registro' : 'Acessar Arquivo'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-[#8a8578]">
          <span>
            {isRegister ? 'Já possui registro ativo? ' : 'Ainda não possui registro? '}
          </span>
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="font-medium text-[#c9a04e] hover:text-[#d4ad5e] transition-colors underline underline-offset-4"
          >
            {isRegister ? 'Fazer login' : 'Criar nova conta'}
          </button>
        </div>
      </div>
    </div>
  );
};
