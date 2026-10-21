import React, { useState, useEffect } from 'react';
import { api, User, Campaign } from './services/api';
import { Navbar } from './components/Navbar';
import { AuthModal } from './components/AuthModal';
import { CampaignList } from './components/CampaignList';
import { CampaignWorkspace } from './components/CampaignWorkspace';

export const App: React.FC = () => {
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
      if (window.location.hash.includes('campaign=')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    }
  };

  const handleAuthSuccess = async (authUser: User) => {
    setUser(authUser);
    await loadCampaigns();
  };

  const handleLogout = () => {
    api.logout();
    localStorage.removeItem('arcanum_active_campaign_id');
    if (window.location.hash.includes('campaign=')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    setUser(null);
    setSelectedCampaign(null);
    setCampaigns([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-indigo-400">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-sm font-semibold tracking-wider uppercase text-slate-400">Iniciando Arcanum VTT...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      <Navbar
        user={user}
        onLogout={handleLogout}
        onBackToDashboard={() => handleSelectCampaign(null)}
        activeCampaignName={selectedCampaign?.name}
      />

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
          />
        ) : (
          <CampaignList
            campaigns={campaigns}
            onSelectCampaign={(c) => handleSelectCampaign(c)}
            onRefreshCampaigns={loadCampaigns}
          />
        )}
      </main>
    </div>
  );
};
export default App;
