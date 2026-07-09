import { useState, useEffect } from 'react';
import type { User, Worker, Client, Placement, Timesheet, Invoice, AuditEvent, AuditEntityType, DocumentRecord } from './types';
import { mockUsers, mockWorkers, mockClients, mockPlacements, mockTimesheets } from './mockData';
import { WorkerPortal } from './components/WorkerPortal';
import { ClientPortal } from './components/ClientPortal';
import { AdminPortal } from './components/AdminPortal';
import { getProvinceTax } from './utils';
import { LogOut, RefreshCw } from 'lucide-react';

function normalizeTimesheetStatus(status: string): Timesheet['status'] {
  if (status === 'pending_approval') return 'submitted';
  if (status === 'approved') return 'agency_approved';
  return status as Timesheet['status'];
}

function normalizeTimesheets(items: Timesheet[]): Timesheet[] {
  return items.map(item => ({ ...item, status: normalizeTimesheetStatus(item.status) }));
}

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
    return local ? normalizeTimesheets(JSON.parse(local)) : normalizeTimesheets(mockTimesheets);
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const local = localStorage.getItem('agency_invoices');
    return local ? JSON.parse(local) : [];
  });

  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(() => {
    const local = localStorage.getItem('agency_audit_events');
    return local ? JSON.parse(local) : [];
  });

  const [documentRecords, setDocumentRecords] = useState<DocumentRecord[]>(() => {
    const local = localStorage.getItem('agency_documents');
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

  useEffect(() => {
    localStorage.setItem('agency_audit_events', JSON.stringify(auditEvents));
  }, [auditEvents]);

  useEffect(() => {
    localStorage.setItem('agency_documents', JSON.stringify(documentRecords));
  }, [documentRecords]);

  const addAuditEvent = (
    action: string,
    entityType: AuditEntityType,
    summary: string,
    entityId?: string,
    metadata?: AuditEvent['metadata']
  ) => {
    const event: AuditEvent = {
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      actorId: currentUser.id,
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action,
      entityType,
      entityId,
      summary,
      metadata
    };
    setAuditEvents(prev => [event, ...prev].slice(0, 1000));
  };

  // Reset to initial mock seeds handler
  const handleResetData = () => {
    if (confirm('Reset all databases back to default Canadian seed data? This will clear custom entries and invoices.')) {
      localStorage.removeItem('agency_workers');
      localStorage.removeItem('agency_clients');
      localStorage.removeItem('agency_placements');
      localStorage.removeItem('agency_timesheets');
      localStorage.removeItem('agency_invoices');
      localStorage.removeItem('agency_active_user');
      localStorage.removeItem('agency_audit_events');
      localStorage.removeItem('agency_documents');
      
      setWorkers(mockWorkers);
      setClients(mockClients);
      setPlacements(mockPlacements);
      setTimesheets(mockTimesheets);
      setInvoices([]);
      setAuditEvents([]);
      setDocumentRecords([]);
      setCurrentUser(mockUsers[0]);
    }
  };

  // State modification callbacks
  const handleAddWorker = (w: Worker) => {
    setWorkers(prev => [...prev, w]);
    addAuditEvent('Worker Created', 'worker', `Created worker ${w.name}`, w.id, {
      province: w.province,
      basePayRate: w.basePayRate
    });
  };

  const handleAddClient = (c: Client) => {
    setClients(prev => [...prev, c]);
    addAuditEvent('Client Created', 'client', `Created client ${c.companyName}`, c.id, {
      province: c.province,
      baseBillRate: c.baseBillRate
    });
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
    addAuditEvent('Placement Created', 'placement', `Created placement ${p.roleTitle}`, p.id, {
      workerId: p.workerId,
      clientId: p.clientId,
      payCycle: p.payCycle
    });
    addAuditEvent('Timesheet Created', 'timesheet', `Created initial ${p.payCycle} timesheet`, initialTimesheet.id, {
      placementId: p.id,
      status: initialTimesheet.status
    });
  };

  const handleSaveTimesheet = (ts: Timesheet) => {
    const existing = timesheets.find(t => t.id === ts.id);
    setTimesheets(prev => {
      const exists = prev.some(t => t.id === ts.id);
      return exists ? prev.map(t => t.id === ts.id ? ts : t) : [...prev, ts];
    });
    if (!existing) {
      addAuditEvent('Timesheet Created', 'timesheet', `Created timesheet ${ts.cycleStartDate} to ${ts.cycleEndDate}`, ts.id, {
        status: ts.status,
        entries: ts.entries.length,
        totalHours: ts.totalHours
      });
      return;
    }
    if (existing.status !== ts.status) {
      addAuditEvent('Timesheet Status Changed', 'timesheet', `Timesheet moved from ${existing.status} to ${ts.status}`, ts.id, {
        previousStatus: existing.status,
        nextStatus: ts.status,
        totalHours: ts.totalHours
      });
      return;
    }
    addAuditEvent('Timesheet Updated', 'timesheet', `Updated timesheet ${ts.cycleStartDate} to ${ts.cycleEndDate}`, ts.id, {
      entriesBefore: existing.entries.length,
      entriesAfter: ts.entries.length,
      totalHours: ts.totalHours
    });
  };

  const handleSubmitTimesheet = (id: string) => {
    setTimesheets(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          status: 'submitted' as const,
          submittedAt: new Date().toISOString()
        };
      }
      return t;
    }));
    addAuditEvent('Timesheet Submitted', 'timesheet', 'Worker submitted timesheet to client review', id);
  };

  const handleApproveTimesheet = (id: string) => {
    setTimesheets(prev => prev.map(t => {
      if (t.id === id) {
        return {
          ...t,
          status: 'client_approved' as const,
          clientFeedback: undefined
        };
      }
      return t;
    }));
    addAuditEvent('Client Approved Timesheet', 'timesheet', 'Client manager approved timesheet for agency review', id);
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
    addAuditEvent('Timesheet Rejected', 'timesheet', 'Timesheet rejected for worker correction', id, {
      feedback
    });
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
    setTimesheets(prev => prev.map(t => (
      tsIds.includes(t.id) ? { ...t, status: 'invoiced' as const } : t
    )));
    addAuditEvent('Invoice Generated', 'invoice', `Generated invoice ${newInvoice.id}`, newInvoice.id, {
      clientId,
      timesheetCount: tsIds.length,
      total: newInvoice.total
    });
  };

  const handleUpdateInvoiceStatus = (id: string, status: 'pending' | 'paid') => {
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status } : inv));
    if (status === 'paid') {
      const invoice = invoices.find(inv => inv.id === id);
      if (invoice) {
        setTimesheets(prev => prev.map(ts => (
          invoice.timesheetIds.includes(ts.id) ? { ...ts, status: 'paid' as const } : ts
        )));
      }
    }
    addAuditEvent('Invoice Status Changed', 'invoice', `Invoice ${id} marked ${status}`, id, {
      status
    });
  };

  const handleClosePayroll = (timesheetId: string) => {
    setTimesheets(prev => prev.map(ts => (
      ts.id === timesheetId ? { ...ts, status: 'payroll_closed' as const } : ts
    )));
    addAuditEvent('Payroll Closed', 'payroll', 'Payroll closed for timesheet', timesheetId);
  };

  const handleAddDocument = (documentRecord: DocumentRecord) => {
    setDocumentRecords(prev => [documentRecord, ...prev]);
    addAuditEvent('Document Uploaded', 'document', `Uploaded ${documentRecord.fileName}`, documentRecord.id, {
      category: documentRecord.category,
      linkedEntityType: documentRecord.linkedEntityType,
      linkedEntityId: documentRecord.linkedEntityId || '',
      fileSize: documentRecord.fileSize
    });
  };

  const handleDeleteDocument = (documentId: string) => {
    const documentRecord = documentRecords.find(doc => doc.id === documentId);
    setDocumentRecords(prev => prev.filter(doc => doc.id !== documentId));
    if (documentRecord) {
      addAuditEvent('Document Deleted', 'document', `Deleted ${documentRecord.fileName}`, documentId, {
        category: documentRecord.category,
        linkedEntityType: documentRecord.linkedEntityType
      });
    }
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
                <option value={JSON.stringify(mockUsers[4])}>Tasal Ashna (Dairan Gasht - Weekly Pay)</option>
                <option value={JSON.stringify(mockUsers[5])}>Ilyas Jalalzai (Lab-laboo - Bi-weekly Pay)</option>
                <option value={JSON.stringify(mockUsers[6])}>Muska Jalalzai (Jogayee - Daily Wages)</option>
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
              auditEvents={auditEvents}
              documentRecords={documentRecords}
              onAddWorker={handleAddWorker}
              onAddClient={handleAddClient}
              onAddPlacement={handleAddPlacement}
              onSaveTimesheet={handleSaveTimesheet}
              onGenerateInvoice={handleGenerateInvoice}
              onUpdateInvoiceStatus={handleUpdateInvoiceStatus}
              onClosePayroll={handleClosePayroll}
              onAddDocument={handleAddDocument}
              onDeleteDocument={handleDeleteDocument}
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
