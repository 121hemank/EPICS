import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function DashboardLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="dashboard-glass-wrapper">
      <div className="glass-orb glass-orb-1" />
      <div className="glass-orb glass-orb-2" />
      <div className="glass-orb glass-orb-3" />
      <Topbar />
      <div className="container">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
        <main className="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
