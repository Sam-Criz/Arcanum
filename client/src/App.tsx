import React, { useState, useEffect } from 'react';
import { api, User, Campaign } from './services/api';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { CampaignList } from './components/CampaignList';
import { CampaignWorkspace } from './components/CampaignWorkspace';
import { NotificationProvider } from './components/NotificationProvider';

export const AppContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = api.getToken();
      if (token) {
        const res = await api.getMe();
        setUser(res.user);
        await loadCampaigns();
      }
    } catch {
      api.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loadCampaigns = async () => {
    try {
      const list = await api.getCampaigns();
      setCampaigns(list);

      // Restauração de sessão ativa de campanha após atualizar a página (F5)
      const hashMatch = window.location.hash.match(/campaign=([^&]+)/);
      const savedCampaignId = (hashMatch ? hashMatch[1] : null) || localStorage.getItem('arcanum_active_campaign_id');

      if (savedCampaignId) {
        const found = list.find(c => c.id === savedCampaignId);
        if (found) {
          setSelectedCampaign(found);
          localStorage.setItem('arcanum_active_campaign_id', found.id);
          window.location.hash = `campaign=${found.id}`;
        } else {
          localStorage.removeItem('arcanum_active_campaign_id');
        }
      }
      return list;
    } catch (err) {
      console.error('Erro ao buscar campanhas:', err);
      return [];
    }
  };

  const handleSelectCampaign = (c: Campaign | null) => {
    setSelectedCampaign(c);
    if (c) {
      localStorage.setItem('arcanum_active_campaign_id', c.id);
      window.location.hash = `campaign=${c.id}`;
    } else {
      localStorage.removeItem('arcanum_active_campaign_id');
      window.location.hash = '';
    }
  };

  const handleLogout = () => {
    api.logout();
    setUser(null);
    setSelectedCampaign(null);
    localStorage.removeItem('arcanum_active_campaign_id');
    window.location.hash = '';
  };

  const handleAuthSuccess = (u: User) => {
    setUser(u);
    loadCampaigns();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#141716] text-[#c86d51]">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-9 h-9 border-2 border-[#252a27] border-t-[#c86d51] rounded-full animate-spin" />
          <p className="text-xs font-mono uppercase tracking-widest text-[#9b9689]">Iniciando Arquivo Arcanum...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141716] text-[#ebe7de] flex flex-col font-sans selection:bg-[#c86d51] selection:text-[#141716]">
      {!selectedCampaign && (
        <Navbar
          user={user}
          onLogout={handleLogout}
          onBackToDashboard={() => handleSelectCampaign(null)}
          activeCampaignName={undefined}
        />
      )}

      <main className="flex-1">
        {!user ? (
          <AuthModal onSuccess={handleAuthSuccess} />
        ) : selectedCampaign ? (
          <CampaignWorkspace
            campaign={selectedCampaign}
            user={user}
            onBack={() => {
              handleSelectCampaign(null);
              loadCampaigns();
            }}
            onLogout={handleLogout}
          />
        ) : (
          <CampaignList
            campaigns={campaigns}
            onSelectCampaign={(c) => handleSelectCampaign(c)}
            onRefreshCampaigns={loadCampaigns}
            isLoading={loading}
          />
        )}
      </main>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
};

export default App;
