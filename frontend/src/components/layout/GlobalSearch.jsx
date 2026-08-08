import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrganization } from '../../context/OrganizationContext';
import { loadVendors, loadLeads, loadCustomers } from '../../lib/supabase';

const PAGES = [
  { label: 'Dashboard', to: '/' },
  { label: 'Customers', to: '/customers' },
  { label: 'Leads', to: '/leads' },
  { label: 'Vendors', to: '/vendors' },
  { label: 'Pipeline', to: '/pipeline' },
  { label: 'Analytics', to: '/analytics' },
  { label: 'Performance', to: '/performance' },
  { label: 'Settings', to: '/settings' },
  { label: 'Vendor Onboarding', to: '/onboard' }
];

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [vendors, setVendors] = useState([]);
  const [leads, setLeads] = useState([]);
  const [customers, setCustomers] = useState([]);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    const [v, l, c] = await Promise.all([loadVendors(orgId), loadLeads(orgId), loadCustomers(orgId)]);
    setVendors(v);
    setLeads(l);
    setCustomers(c);
  }, [orgId]);

  useEffect(() => {
    if (open) {
      loadData();
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open, loadData]);

  const q = query.trim().toLowerCase();
  const matches = (s) => (s || '').toLowerCase().includes(q);

  const results = !q ? [] : [
    ...PAGES.filter(p => p.label.toLowerCase().includes(q)).map(r => ({ kind: 'Page', label: r.label, to: r.to, sub: 'Navigate to page' })),
    ...vendors.filter(v => matches(v.vendor_name)).slice(0, 5).map(v => ({ kind: 'Vendor', label: v.vendor_name, to: '/vendors', sub: v.contact_person || 'Vendor' })),
    ...leads.filter(l => matches(l.vendor_name) || matches(l.contact_person)).slice(0, 5).map(l => ({ kind: 'Lead', label: l.vendor_name, to: '/leads', sub: l.contact_person || 'Lead' })),
    ...customers.filter(c => matches(c.customer_name)).slice(0, 5).map(c => ({ kind: 'Customer', label: c.customer_name, to: '/customers', sub: c.vendor_name || 'Customer' }))
  ];

  useEffect(() => { setActive(0); }, [q]);

  const go = (index) => {
    const item = results[index];
    if (!item) return;
    setOpen(false);
    navigate(item.to);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(a => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(a => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(active);
    }
  };

  return (
    <>
      <button
        type="button"
        className="global-search-btn"
        onClick={() => setOpen(true)}
        aria-label="Quick search (Ctrl/Cmd + K)"
        title="Quick search (Ctrl/Cmd + K)"
      >
        <SearchIcon />
        <span className="search-btn-hint">Search</span>
        <kbd>Ctrl K</kbd>
      </button>
      {open && <div className="search-overlay" onClick={() => setOpen(false)} role="presentation">
      <div className="search-modal" onClick={e => e.stopPropagation()} role="dialog" aria-label="Quick search">
        <div className="search-input-row">
          <SearchIcon />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search vendors, leads, customers, pages..."
            aria-label="Quick search"
          />
          <kbd>ESC</kbd>
        </div>
        {results.length === 0 ? (
          <p className="search-empty">
            {q ? 'No results found.' : 'Type to search across vendors, leads, customers, and pages.'}
          </p>
        ) : (
          <ul className="search-results">
            {results.map((r, i) => (
              <li key={`${r.kind}-${r.label}-${i}`}>
                <button
                  type="button"
                  className={`search-result-item${i === active ? ' active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(i)}
                >
                  <span className="search-kind">{r.kind}</span>
                  <span className="search-label">{r.label}</span>
                  <span className="search-sub">{r.sub}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>}
    </>
  );
}
