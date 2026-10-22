import React from 'react';
import { User } from '../services/api';

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
    <header className="border-b border-[#2c2825] bg-[#1a1816]/95 backdrop-blur-md sticky top-0 z-50 px-6 py-3 flex items-center justify-between shadow-md transition-all">
      <div className="flex items-center space-x-3 cursor-pointer group" onClick={onBackToDashboard}>
        <span className="font-serif italic font-bold text-2xl tracking-normal text-[#c9a04e] group-hover:text-[#c9a04e]/90 transition-colors">
          Arcanum
        </span>
        {activeCampaignName && (
          <div className="hidden sm:flex items-center space-x-2 pl-3 border-l border-[#2c2825]">
            <span className="font-serif text-lg font-bold text-[#ece3d0]">{activeCampaignName}</span>
          </div>
        )}
      </div>

      {user ? (
        <div className="flex items-center space-x-4">
          <div className="text-right text-xs">
            <span className="font-medium text-[#ece3d0]">{user.username}</span>
            <span className="text-[#aaa292] mx-1.5">·</span>
            <span className="text-[#aaa292] font-mono">{user.email}</span>
          </div>

          <button
            onClick={onLogout}
            title="Sair da conta"
            className="px-3.5 py-1.5 rounded bg-transparent hover:bg-[#2c2825] text-[#ece3d0] border border-[#2c2825] hover:border-[#574e45] text-xs font-medium transition-all duration-150"
          >
            Sair
          </button>
        </div>
      ) : null}
    </header>
  );
};
