import React from 'react';
import { User } from '../services/api';
import { Shield, LogOut, Sparkles } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  onLogout: () => void;
  onBackToDashboard?: () => void;
  activeCampaignName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogout,
  onBackToDashboard,
  activeCampaignName
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between shadow-md">
      <div className="flex items-center space-x-3 cursor-pointer" onClick={onBackToDashboard}>
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
            ARCANUM VTT
          </span>
          <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 uppercase">
            Plataforma Modular
          </span>
        </div>
      </div>

      {activeCampaignName && (
        <div 
          onClick={onBackToDashboard}
          className="hidden md:flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-sm text-slate-300 hover:text-white cursor-pointer hover:border-indigo-500 transition-colors"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span className="text-slate-400">Campanha Ativa:</span>
          <span className="font-semibold text-white">{activeCampaignName}</span>
        </div>
      )}

      {user ? (
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2.5">
            <img
              src={user.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
              alt={user.username}
              className="w-8 h-8 rounded-full border border-indigo-500/50 bg-slate-800"
            />
            <div className="text-sm text-left">
              <p className="font-medium text-slate-200 leading-tight">{user.username}</p>
              <p className="text-xs text-slate-400 leading-tight">{user.email}</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            title="Sair da conta"
            className="p-2 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-800 transition-all"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      ) : null}
    </header>
  );
};
