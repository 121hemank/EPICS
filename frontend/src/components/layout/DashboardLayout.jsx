import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function DashboardLayout() {
  const [collapsed] = useState(false);

  return (
    <>
      <Topbar />
      <div className="container">
        <Sidebar collapsed={collapsed} />
        <main className="main">
          <Outlet />
        </main>
      </div>
    </>
  );
}
