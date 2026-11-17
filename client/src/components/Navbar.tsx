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
    <header className="border-b border-[#3a3530]/70 bg-[#131211]/95 backdrop-blur-md sticky top-0 z-50 px-4 sm:px-6 py-2.5 flex items-center justify-between select-none transition-all duration-300 ease-in-out">
      <div className="flex items-center space-x-3 cursor-pointer group" onClick={onBackToDashboard}>
        <div className="w-8 h-8 rounded-xl bg-[#1a1816] border border-[#3a3530] flex items-center justify-center text-[#c9a04e] group-hover:border-[#c9a04e]/70 transition-all duration-300 ease-in-out">
          <Feather className="w-4 h-4 text-[#c9a04e]" />
        </div>
        <div className="flex items-center space-x-2.5">
          <span className="font-serif italic font-bold text-2xl tracking-tight text-[#ece3d0] group-hover:text-[#c9a04e] transition-colors duration-300 ease-in-out">
            Arcanum
          </span>
          <span className="text-xs font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-[#1a1816] text-[#8a8578] border border-[#3a3530]">
            Dossiê VTT
          </span>
        </div>
        {activeCampaignName && (
          <div className="hidden sm:flex items-center space-x-2 pl-3 border-l border-[#3a3530]">
            <ChevronLeft className="w-3.5 h-3.5 text-[#8a8578] group-hover:text-[#c9a04e] transition-colors duration-300 ease-in-out" />
            <span className="font-serif text-sm font-medium text-[#ece3d0] group-hover:text-[#c9a04e] transition-colors duration-300 ease-in-out">
              {activeCampaignName}
            </span>
          </div>
        )}
      </div>

      {user ? (
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="text-right text-xs hidden sm:block">
            <div className="font-medium text-[#ece3d0] flex items-center justify-end space-x-1.5">
              <span>{user.username}</span>
              <Shield className="w-3 h-3 text-[#5a7a5a]" />
            </div>
            <span className="text-[#8a8578] font-mono text-[11px]">{user.email}</span>
          </div>

          <button
            onClick={onLogout}
            title="Encerrar sessão"
            className="px-3 py-1.5 rounded-xl bg-[#1a1816] hover:bg-[#2c2825] text-[#ece3d0] border border-[#3a3530] hover:border-[#b24a52]/60 text-xs font-medium flex items-center space-x-1.5 transition-all duration-300 ease-in-out active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5 text-[#b24a52]" />
            <span className="hidden sm:inline">Encerrar</span>
          </button>
        </div>
      ) : null}
    </header>
  );
};
