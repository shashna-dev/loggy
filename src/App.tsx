import { useState, useEffect } from 'react';
import type { User, Worker, Client, Placement, Timesheet, Invoice } from './types';
import { mockUsers, mockWorkers, mockClients, mockPlacements, mockTimesheets } from './mockData';
import { WorkerPortal } from './components/WorkerPortal';
import { ClientPortal } from './components/ClientPortal';
import { AdminPortal } from './components/AdminPortal';
import { getProvinceTax } from './utils';
import { LogOut, RefreshCw } from 'lucide-react';

function App() {
  // 1. Initial State from localStorage or Mock Seed Data
  const [workers, setWorkers] = useState<Worker[]>(() => {
    const local = localStorage.getItem('agency_workers');
    return local ? JSON.parse(local) : mockWorkers;
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const local = localStorage.getItem('agency_clients');
    return local ? JSON.parse(local) : mockClients;
  });

  const [placements, setPlacements] = useState<Placement[]>(() => {
    const local = localStorage.getItem('agency_placements');
    return local ? JSON.parse(local) : mockPlacements;
  });

  const [timesheets, setTimesheets] = useState<Timesheet[]>(() => {
    const local = localStorage.getItem('agency_timesheets');
    return local ? JSON.parse(local) : mockTimesheets;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const local = localStorage.getItem('agency_invoices');
    return local ? JSON.parse(local) : [];
  });

  // Role switching control state
  const [currentUser, setCurrentUser] = useState<User>(() => {
    const saved = localStorage.getItem('agency_active_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Verify user exists in mockUsers
      const exists = mockUsers.find(u => u.id === parsed.id);
      if (exists) return exists;
    }
    return mockUsers[0]; // Default to Ilyas Jalalzai (Admin)
  });

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('agency_workers', JSON.stringify(workers));
  }, [workers]);

  useEffect(() => {
    localStorage.setItem('agency_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('agency_placements', JSON.stringify(placements));
  }, [placements]);

  useEffect(() => {
    localStorage.setItem('agency_timesheets', JSON.stringify(timesheets));
  }, [timesheets]);

  useEffect(() => {
    localStorage.setItem('agency_invoices', JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem('agency_active_user', JSON.stringify(currentUser));
  }, [currentUser]);

  // Reset to initial mock seeds handler
  const handleResetData = () => {
    if (confirm('Reset all databases back to default Canadian seed data? This will clear custom entries and invoices.')) {
      localStorage.removeItem('agency_workers');
      localStorage.removeItem('agency_clients');
      localStorage.removeItem('agency_placements');
      localStorage.removeItem('agency_timesheets');
      localStorage.removeItem('agency_invoices');
      localStorage.removeItem('agency_active_user');
      
      setWorkers(mockWorkers);
      setClients(mockClients);
      setPlacements(mockPlacements);
      setTimesheets(mockTimesheets);
      setInvoices([]);
      setCurrentUser(mockUsers[0]);
    }
  };

  // State modification callbacks
  const handleAddWorker = (w: Worker) => {
    setWorkers(prev => [...prev, w]);
  };

  const handleAddClient = (c: Client) => {
    setClients(prev => [...prev, c]);
  };

  const handleAddPlacement = (p: Placement) => {
    setPlacements(prev => [...prev, p]);
    
    // Auto-create initial timesheet draft for this new placement
    const now = new Date();
    const cycleStartDate = now.toISOString().split('T')[0];
    
    let cycleEndDate = cycleStartDate;
    if (p.payCycle === 'weekly') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(now.setDate(diff));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      cycleEndDate = sun.toISOString().split('T')[0];
    } else if (p.payCycle === 'biweekly') {
      const fortnite = new Date();
      fortnite.setDate(now.getDate() + 13);
      cycleEndDate = fortnite.toISOString().split('T')[0];
    } else if (p.payCycle === 'monthly') {
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      cycleEndDate = last.toISOString().split('T')[0];
    }

    const initialTimesheet: Timesheet = {
      id: `ts-${Date.now()}`,
      placementId: p.id,
      cycleStartDate,
      cycleEndDate,
      entries: [],
      status: 'draft',
      totalHours: 0,
      subtotalPay: 0,
      subtotalBill: 0,
      payCycle: p.payCycle
    };

    setTimesheets(prev => [...prev, initialTimesheet]);
  };

  const handleSaveTimesheet = (ts: Timesheet) => {
    setTimesheets(prev => prev.map(t => t.id === ts.id ? ts : t));
  };

  const handleSubmitTimesheet = (id: string) => {
    setTimesheets(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          status: 'pending_approval' as const,
          submittedAt: new Date().toISOString()
        };
      }
      return t;
    }));
  };

  const handleApproveTimesheet = (id: string) => {
    setTimesheets(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          status: 'approved' as const,
          clientFeedback: undefined
        };
      }
      return t;
    }));
  };

  const handleRejectTimesheet = (id: string, feedback: string) => {
    setTimesheets(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          status: 'rejected' as const,
          clientFeedback: feedback
        };
      }
      return t;
    }));
  };

  const handleGenerateInvoice = (clientId: string, tsIds: string[]) => {
    const cl = clients.find(c => c.id === clientId);
    if (!cl) return;

    const selectedSheets = timesheets.filter(t => tsIds.includes(t.id));
    
    // Sum hours and subtotals
    const subtotal = selectedSheets.reduce((sum, s) => sum + s.subtotalBill, 0);
    const tax = getProvinceTax(cl.province);
    
    let gstHstAmount = subtotal * tax.gstHstRate;
    let qstAmount = 0;
    
    if (tax.qstRate) {
      qstAmount = subtotal * tax.qstRate;
    }

    const total = subtotal + gstHstAmount + qstAmount;

    // Dates range
    const startDates = selectedSheets.map(s => new Date(s.cycleStartDate).getTime());
    const endDates = selectedSheets.map(s => new Date(s.cycleEndDate).getTime());
    const minStart = new Date(Math.min(...startDates)).toISOString().split('T')[0];
    const maxEnd = new Date(Math.max(...endDates)).toISOString().split('T')[0];

    const today = new Date().toISOString().split('T')[0];
    const due = new Date();
    due.setDate(due.getDate() + 14); // 14 days net payment term
    const dueStr = due.toISOString().split('T')[0];

    const newInvoice: Invoice = {
      id: `INV-${Date.now().toString().slice(-6)}`,
      clientId,
      invoiceDate: today,
      dueDate: dueStr,
      periodStartDate: minStart,
      periodEndDate: maxEnd,
      timesheetIds: tsIds,
      subtotal: Math.round(subtotal * 100) / 100,
      gstHstRate: tax.gstHstRate,
      gstHstAmount: Math.round(gstHstAmount * 100) / 100,
      qstRate: tax.qstRate,
      qstAmount: qstAmount ? Math.round(qstAmount * 100) / 100 : undefined,
      total: Math.round(total * 100) / 100,
      status: 'pending'
    };

    setInvoices(prev => [...prev, newInvoice]);
  };

  const handleUpdateInvoiceStatus = (id: string, status: 'pending' | 'paid') => {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status } : inv));
  };

  return (
    <div className="app-container">
      {/* Top Banner and Role Switcher */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-logo">L</div>
          <span className="brand-name">Loggy Staffing Portal</span>
          <div className="canadian-flag-badge">
            <span>CA Compliance</span>
          </div>
        </div>

        {/* Dynamic Testing Control Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={handleResetData}
            className="btn btn-secondary" 
            style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' }}
            title="Reset to default mock data"
          >
            <RefreshCw size={12} /> Reset Data
          </button>
          
          <div className="role-selector">
            <select
              className="form-control"
              style={{ background: 'transparent', border: 'none', fontSize: '0.85rem', width: '240px', padding: '4px 8px', color: 'var(--text-main)', cursor: 'pointer' }}
              value={JSON.stringify(currentUser)}
              onChange={(e) => setCurrentUser(JSON.parse(e.target.value))}
            >
              <optgroup label="Agency Administration">
                <option value={JSON.stringify(mockUsers[0])}>Ilyas Jalalzai (Agency Admin)</option>
              </optgroup>
              <optgroup label="Client Managers (Approvers)">
                <option value={JSON.stringify(mockUsers[1])}>Marcus V. (ON Client Manager)</option>
                <option value={JSON.stringify(mockUsers[2])}>Sarah L. (BC Client Manager)</option>
                <option value={JSON.stringify(mockUsers[3])}>Jean-Pierre M. (QC Client Manager)</option>
              </optgroup>
              <optgroup label="Placed Workers (Candidates)">
                <option value={JSON.stringify(mockUsers[4])}>Liam Patel (ON - Weekly Pay)</option>
                <option value={JSON.stringify(mockUsers[5])}>Sophia Chang (BC - Daily Wages)</option>
                <option value={JSON.stringify(mockUsers[6])}>Chloe Dubois (QC - Bi-weekly Pay)</option>
              </optgroup>
            </select>
          </div>
        </div>
      </header>

      {/* Main Workspace Body */}
      <main className="main-layout">
        <div className="content-workspace">
          
          {/* Active User Dashboard Banner */}
          <div style={{ 
            background: 'rgba(255,255,255,0.02)', 
            border: '1px solid var(--border-color)', 
            borderRadius: '8px', 
            padding: '10px 16px', 
            marginBottom: '20px', 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.85rem'
          }}>
            <div>
              <span>Viewing Environment as: </span>
              <strong style={{ color: 'var(--primary-hover)' }}>{currentUser.name}</strong>
              <span style={{ color: 'var(--text-sub)' }}> ({currentUser.role.toUpperCase()} MODE)</span>
            </div>
            {currentUser.role !== 'admin' && (
              <button 
                className="btn btn-secondary" 
                style={{ padding: '2px 8px', fontSize: '0.75rem', gap: '4px' }}
                onClick={() => setCurrentUser(mockUsers[0])}
              >
                <LogOut size={12} /> Return to Admin
              </button>
            )}
          </div>

          {/* Conditional Portals Rendering */}
          {currentUser.role === 'admin' && (
            <AdminPortal 
              workers={workers}
              clients={clients}
              placements={placements}
              timesheets={timesheets}
              invoices={invoices}
              onAddWorker={handleAddWorker}
              onAddClient={handleAddClient}
              onAddPlacement={handleAddPlacement}
              onSaveTimesheet={handleSaveTimesheet}
              onGenerateInvoice={handleGenerateInvoice}
              onUpdateInvoiceStatus={handleUpdateInvoiceStatus}
            />
          )}

          {currentUser.role === 'client' && currentUser.clientId && (
            <ClientPortal 
              clientId={currentUser.clientId}
              clients={clients}
              placements={placements}
              workers={workers}
              timesheets={timesheets}
              onSaveTimesheet={handleSaveTimesheet}
              onApproveTimesheet={handleApproveTimesheet}
              onRejectTimesheet={handleRejectTimesheet}
            />
          )}

          {currentUser.role === 'worker' && currentUser.workerId && (
            <WorkerPortal 
              workerId={currentUser.workerId}
              placements={placements}
              clients={clients}
              timesheets={timesheets}
              onSaveTimesheet={handleSaveTimesheet}
              onSubmitTimesheet={handleSubmitTimesheet}
            />
          )}

        </div>
      </main>
    </div>
  );
}

export default App;
