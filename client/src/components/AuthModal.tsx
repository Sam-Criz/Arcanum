import React, { useState } from 'react';
import { api, User } from '../services/api';

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
    <div className="min-h-[88vh] flex items-stretch">
      {/* Coluna Esquerda: Preview da Mesa e Logotipo */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 bg-[#131211] border-r border-[#2c2825] relative overflow-hidden">
        {/* Grid de fundo sutil */}
        <div className="absolute inset-0 opacity-15 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(to right, #2c2825 1px, transparent 1px), linear-gradient(to bottom, #2c2825 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />

        {/* Mock visual tático do mapa similar à imagem 3 */}
        <div className="relative my-auto mx-auto w-full max-w-lg aspect-[4/3] bg-[#1a1816] border border-[#2c2825] rounded-lg p-6 shadow-2xl flex items-center justify-center">
          <div className="w-full h-full border border-[#574e45]/40 rounded relative flex items-center justify-center">
            {/* Tokens táticos estilizados */}
            <div className="absolute top-1/3 left-1/4 w-12 h-12 rounded-full border-2 border-[#c9a04e] bg-[#1a1816] flex items-center justify-center shadow-lg font-serif text-lg font-bold text-[#c9a04e]">
              A
            </div>
            <div className="absolute top-1/4 right-1/3 w-12 h-12 rounded-full border-2 border-[#8a2c38] bg-[#1a1816] flex items-center justify-center shadow-lg font-serif text-lg font-bold text-[#b24a52]">
              G
            </div>
            <div className="absolute bottom-0 left-0 right-1/2 h-1/3 bg-[#131211]/80 border-t border-dashed border-[#574e45]/60" />
          </div>
        </div>

        {/* Assinatura inferior */}
        <div className="relative z-10">
          <h1 className="font-serif italic text-4xl text-[#c9a04e] font-bold tracking-tight">Arcanum</h1>
          <p className="text-sm text-[#aaa292] mt-1 font-sans">
            Mesa virtual de RPG. Cada campanha com as suas próprias regras, fichas e mapas.
          </p>
        </div>
      </div>

      {/* Coluna Direita: Formulário de Autenticação */}
      <div className="w-full lg:w-[480px] shrink-0 flex items-center justify-center p-8 sm:p-12 bg-[#131211]">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="text-3xl font-serif text-[#ece3d0] font-bold tracking-tight">
              {isRegister ? 'Criar conta' : 'Entrar'}
            </h2>
            <p className="text-xs text-[#aaa292] mt-1">
              {isRegister
                ? 'Cadastre-se para criar ou participar de campanhas.'
                : 'Use seu email ou nome de usuário para voltar às suas campanhas.'}
            </p>
          </div>

          {error && (
            <div className="p-3 bg-[#8a2c38]/20 border border-[#8a2c38] text-[#ece3d0] text-xs rounded">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div>
                <label className="block text-xs font-mono text-[#aaa292] mb-1">
                  Nome de usuário
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ex: MestreDosDados"
                  className="w-full px-3.5 py-2.5 bg-[#1a1816] border border-[#2c2825] focus:border-[#c9a04e] rounded text-sm text-[#ece3d0] placeholder-[#574e45] focus:outline-none transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-mono text-[#aaa292] mb-1">
                {isRegister ? 'Email' : 'Email ou usuário'}
              </label>
              <input
                type={isRegister ? 'email' : 'text'}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={isRegister ? 'seu@email.com' : 'seu@email.com ou MestreDosDados'}
                className="w-full px-3.5 py-2.5 bg-[#1a1816] border border-[#2c2825] focus:border-[#c9a04e] rounded text-sm text-[#ece3d0] placeholder-[#574e45] focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-[#aaa292] mb-1">
                Senha
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-[#1a1816] border border-[#2c2825] focus:border-[#c9a04e] rounded text-sm text-[#ece3d0] placeholder-[#574e45] focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded font-bold text-xs bg-[#c9a04e] hover:bg-[#c9a04e]/90 text-[#131211] transition-all disabled:opacity-50"
            >
              {loading ? 'Processando...' : isRegister ? 'Cadastrar e entrar' : 'Entrar na plataforma'}
            </button>
          </form>

          <div className="pt-4 border-t border-[#2c2825] text-xs text-[#aaa292] flex items-center justify-between">
            <span>{isRegister ? 'Já tem uma conta?' : 'Ainda não tem conta?'}</span>
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
              }}
              className="font-medium text-[#c9a04e] hover:underline"
            >
              {isRegister ? 'Entrar' : 'Criar conta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
