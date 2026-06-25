import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import ModulePage from './pages/ModulePage';
import ForecastPage from './pages/ForecastPage';
import AppShell from './pages/app/AppShell';
import MarketDashboard from './pages/app/MarketDashboard';
import RawMaterials from './pages/app/RawMaterials';
import MarketAnalyst from './pages/app/MarketAnalyst';
import FeedSight from './pages/app/FeedSight';
import FeedSightAccuracy from './pages/app/FeedSightAccuracy';

export default function App() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) setShowLoginModal(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <Layout
              user={user}
              loading={loading}
              showLoginModal={showLoginModal}
              setShowLoginModal={setShowLoginModal}
              handleLogout={handleLogout}
            />
          }
        >
          <Route index element={<LandingPage />} />
          <Route path="forecast" element={<ForecastPage />} />
          <Route path="module/:id" element={<ModulePage />} />
        </Route>
        <Route
          path="/app"
          element={<AppShell user={user} loading={loading} handleLogout={handleLogout} />}
        >
          <Route index element={<MarketDashboard />} />
          <Route path="feedsight" element={<FeedSight />} />
          <Route path="feedsight/accuracy" element={<FeedSightAccuracy />} />
          <Route path="raw-materials" element={<RawMaterials />} />
          <Route path="analyst" element={<MarketAnalyst />} />
        </Route>
      </Routes>
    </Router>
  );
}
