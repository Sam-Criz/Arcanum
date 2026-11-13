import React from 'react';
import { User } from '../services/api';
import { LogOut, ChevronLeft, Shield, Feather } from 'lucide-react';

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
    <header className="border-b border-[#343b37]/70 bg-[#141716]/95 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-6 py-2.5 flex items-center justify-between select-none transition-all">
      <div className="flex items-center space-x-3 cursor-pointer group" onClick={onBackToDashboard}>
        <div className="w-8 h-8 rounded-lg bg-[#1c201e] border border-[#343b37] flex items-center justify-center text-[#c86d51] group-hover:border-[#c86d51]/70 transition-all">
          <Feather className="w-4 h-4 text-[#c86d51]" />
        </div>
        <div className="flex items-center space-x-2.5">
          <span className="font-serif italic font-bold text-2xl tracking-tight text-[#ebe7de] group-hover:text-[#c86d51] transition-colors">
            Arcanum
          </span>
          <span className="text-xs font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-[#1c201e] text-[#9b9689] border border-[#343b37]">
            Dossiê VTT
          </span>
        </div>
        {activeCampaignName && (
          <div className="hidden sm:flex items-center space-x-2 pl-3 border-l border-[#343b37]">
            <ChevronLeft className="w-3.5 h-3.5 text-[#9b9689] group-hover:text-[#c86d51] transition-colors" />
            <span className="font-serif text-sm font-medium text-[#ebe7de] group-hover:text-[#c86d51] transition-colors">
              {activeCampaignName}
            </span>
          </div>
        )}
      </div>

      {user ? (
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="text-right text-xs hidden sm:block">
            <div className="font-medium text-[#ebe7de] flex items-center justify-end space-x-1.5">
              <span>{user.username}</span>
              <Shield className="w-3 h-3 text-[#6d9775]" />
            </div>
            <span className="text-[#9b9689] font-mono text-[11px]">{user.email}</span>
          </div>

          <button
            onClick={onLogout}
            title="Encerrar sessão"
            className="px-3 py-1.5 rounded-lg bg-[#1c201e] hover:bg-[#252a27] text-[#ebe7de] border border-[#343b37] hover:border-[#b84a48]/60 text-xs font-medium flex items-center space-x-1.5 transition-all active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5 text-[#b84a48]" />
            <span className="hidden sm:inline">Encerrar</span>
          </button>
        </div>
      ) : null}
    </header>
  );
};
