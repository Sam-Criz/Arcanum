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
    <header className="border-b border-slate-800/80 bg-slate-900/70 backdrop-blur-md sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between shadow-lg transition-all">
      <div className="flex items-center space-x-3 cursor-pointer group" onClick={onBackToDashboard}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-700 flex items-center justify-center text-white shadow-lg shadow-indigo-500/25 transition-transform duration-200 group-hover:scale-105">
          <Shield className="w-6 h-6" />
        </div>
        <div>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
            ARCANUM VTT
          </span>
          <span className="ml-2 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 uppercase">
            Plataforma Modular
          </span>
        </div>
      </div>

      {activeCampaignName && (
        <div 
          onClick={onBackToDashboard}
          className="hidden md:flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-sm text-slate-300 hover:text-white cursor-pointer hover:border-indigo-500/60 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
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
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700/80 hover:border-rose-800/80 transition-all duration-200 hover:scale-[1.05] active:scale-[0.95]"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      ) : null}
    </header>
  );
};
