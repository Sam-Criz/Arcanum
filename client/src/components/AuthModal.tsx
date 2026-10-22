import React, { useState } from 'react';
import { api, User } from '../services/api';
import { Lock, Mail, User as UserIcon, Sparkles } from 'lucide-react';

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
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-md border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden transition-all">
        {/* Subtle decorative glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-3 text-indigo-400 shadow-md">
            <Sparkles className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">
            {isRegister ? 'Criar Nova Conta' : 'Acessar Plataforma'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            {isRegister
              ? 'Cadastre-se para criar campanhas e mestrar suas histórias'
              : 'Entre com suas credenciais para gerenciar suas campanhas'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-950/60 border border-rose-800 text-rose-300 text-sm rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister ? (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Nome de Usuário
              </label>
              <div className="relative">
                <UserIcon className="w-5 h-5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ex: MestreDosDados"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm transition-all duration-200"
                />
              </div>
            </div>
          ) : null}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              {isRegister ? 'Email' : 'Email ou Usuário'}
            </label>
            <div className="relative">
              <Mail className="w-5 h-5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type={isRegister ? 'email' : 'text'}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isRegister ? 'seu@email.com' : 'seu@email.com ou MestreDosDados'}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm transition-all duration-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Senha
            </label>
            <div className="relative">
              <Lock className="w-5 h-5 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 text-sm transition-all duration-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Processando...' : isRegister ? 'Finalizar Cadastro' : 'Entrar na Plataforma'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-400">
          {isRegister ? 'Já possui uma conta?' : 'Ainda não possui conta?'}
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="ml-2 font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-4 transition-colors"
          >
            {isRegister ? 'Fazer login' : 'Cadastre-se'}
          </button>
        </div>
      </div>
    </div>
  );
};
