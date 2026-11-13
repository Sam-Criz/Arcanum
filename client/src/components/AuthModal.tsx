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
    <div className="min-h-[calc(100vh-65px)] flex items-center justify-center px-4 py-12 bg-[#141716] text-[#ebe7de] select-none">
      <div className="w-full max-w-md bg-[#1c201e] border border-[#343b37] rounded-xl p-8 sm:p-10 shadow-2xl space-y-6">
        {/* Cabeçalho Editorial Centrado */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#141716] border border-[#343b37] text-[#c86d51] mb-1">
            <Feather className="w-5 h-5 text-[#c86d51]" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-[#ebe7de] tracking-tight">
            Arcanum Dossiê
          </h1>
          <p className="text-xs text-[#9b9689] max-w-xs mx-auto">
            Plataforma editorial de RPG de mesa, combate tático e preservação de crônicas.
          </p>
        </div>

        {/* Alternância de Abas Minimalista */}
        <div className="flex border-b border-[#343b37] text-xs font-mono uppercase tracking-wider">
          <button
            type="button"
            onClick={() => {
              setIsRegister(false);
              setError(null);
            }}
            className={`flex-1 pb-2.5 text-center transition-colors relative ${
              !isRegister ? 'text-[#c86d51] font-bold' : 'text-[#9b9689] hover:text-[#ebe7de]'
            }`}
          >
            <span>Acesso</span>
            {!isRegister && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c86d51]" />
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setIsRegister(true);
              setError(null);
            }}
            className={`flex-1 pb-2.5 text-center transition-colors relative ${
              isRegister ? 'text-[#c86d51] font-bold' : 'text-[#9b9689] hover:text-[#ebe7de]'
            }`}
          >
            <span>Registro</span>
            {isRegister && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#c86d51]" />
            )}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-[#241a1a] border border-[#b84a48]/60 text-[#e8b5b5] text-xs rounded-lg flex items-start space-x-2">
            <ShieldAlert className="w-4 h-4 text-[#b84a48] shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div className="space-y-1">
              <label className="block text-xs font-mono text-[#9b9689] flex items-center space-x-1.5">
                <UserIcon className="w-3.5 h-3.5 text-[#c86d51]" />
                <span>Nome de Usuário</span>
              </label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Ex: ExploradorDoNorte"
                className="w-full px-3.5 py-2.5 bg-[#141716] border border-[#343b37] focus:border-[#c86d51] rounded-lg text-sm text-[#ebe7de] placeholder-[#959085] focus:outline-none transition-colors"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="block text-xs font-mono text-[#9b9689] flex items-center space-x-1.5">
              <Mail className="w-3.5 h-3.5 text-[#c86d51]" />
              <span>{isRegister ? 'Endereço de Email' : 'Email ou Usuário'}</span>
            </label>
            <input
              type={isRegister ? 'email' : 'text'}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={isRegister ? 'explorador@reino.com' : 'seu@email.com ou Usuário'}
              className="w-full px-3.5 py-2.5 bg-[#141716] border border-[#343b37] focus:border-[#c86d51] rounded-lg text-sm text-[#ebe7de] placeholder-[#959085] focus:outline-none transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-mono text-[#9b9689] flex items-center space-x-1.5">
              <KeyRound className="w-3.5 h-3.5 text-[#c86d51]" />
              <span>Palavra-Passe</span>
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-[#141716] border border-[#343b37] focus:border-[#c86d51] rounded-lg text-sm text-[#ebe7de] placeholder-[#959085] focus:outline-none transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg font-bold text-xs uppercase tracking-wider bg-[#c86d51] hover:bg-[#d67b5f] text-[#141716] transition-all disabled:opacity-50 flex items-center justify-center space-x-2 active:scale-95 pt-3"
          >
            <span>{loading ? 'Consultando...' : isRegister ? 'Confirmar Registro' : 'Acessar Arquivo'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-[#9b9689]">
          <span>
            {isRegister ? 'Já possui registro ativo? ' : 'Ainda não possui registro? '}
          </span>
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="font-medium text-[#c86d51] hover:text-[#d67b5f] transition-colors underline underline-offset-4"
          >
            {isRegister ? 'Fazer login' : 'Criar nova conta'}
          </button>
        </div>
      </div>
    </div>
  );
};
