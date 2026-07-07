import React, { useState } from 'react';
import type { Worker, Client, Placement, Timesheet, Invoice, CanadianProvince, PayCycle } from '../types';
import { evaluateEntryGps, getProvinceTax, getMapLink } from '../utils';
import { 
  Building2, 
  Users, 
  Briefcase, 
  TrendingUp, 
  Plus, 
  DollarSign, 
  Check, 
  FileSpreadsheet
} from 'lucide-react';

interface AdminPortalProps {
  workers: Worker[];
  clients: Client[];
  placements: Placement[];
  timesheets: Timesheet[];
  invoices: Invoice[];
  onAddWorker: (w: Worker) => void;
  onAddClient: (c: Client) => void;
  onAddPlacement: (p: Placement) => void;
  onSaveTimesheet: (ts: Timesheet) => void;
  onGenerateInvoice: (clientId: string, tsIds: string[]) => void;
  onUpdateInvoiceStatus: (id: string, status: 'pending' | 'paid') => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({
  workers,
  clients,
  placements,
  timesheets,
  invoices,
  onAddWorker,
  onAddClient,
  onAddPlacement,
  onSaveTimesheet,
  onGenerateInvoice,
  onUpdateInvoiceStatus
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'workers' | 'placements' | 'approvals' | 'invoices'>('overview');

  // Modals state
  const [showClientModal, setShowClientModal] = useState(false);
  const [showWorkerModal, setShowWorkerModal] = useState(false);
  const [showPlacementModal, setShowPlacementModal] = useState(false);

  // Form State: Client
  const [companyName, setCompanyName] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientProvince, setClientProvince] = useState<CanadianProvince>('ON');
  const [clientTaxNum, setClientTaxNum] = useState('');
  const [clientBillRate, setClientBillRate] = useState(40.0);

  // Form State: Worker
  const [workerName, setWorkerName] = useState('');
  const [workerEmail, setWorkerEmail] = useState('');
  const [workerPhone, setWorkerPhone] = useState('');
  const [workerProvince, setWorkerProvince] = useState<CanadianProvince>('ON');
  const [workerPayRate, setWorkerPayRate] = useState(25.0);
  const [workerBankName, setWorkerBankName] = useState('RBC Royal Bank');
  const [workerBankAccount, setWorkerBankAccount] = useState('****-1234');

  // Form State: Placement
  const [placementWorkerId, setPlacementWorkerId] = useState('');
  const [placementClientId, setPlacementClientId] = useState('');
  const [placementRole, setPlacementRole] = useState('');
  const [placementPay, setPlacementPay] = useState(25.0);
  const [placementBill, setPlacementBill] = useState(40.0);
  const [placementStart, setPlacementStart] = useState(new Date().toISOString().split('T')[0]);
  const [placementCycle, setPlacementCycle] = useState<PayCycle>('weekly');

  // Invoicing selection state
  const [selectedTimesheets, setSelectedTimesheets] = useState<string[]>([]);
  const [invoiceClientId, setInvoiceClientId] = useState('');

  // 1. Calculations for Financial Dashboard
  const approvedTimesheets = timesheets.filter(t => t.status === 'approved');
  const pendingTimesheets = timesheets.filter(t => t.status === 'pending_approval');
  
  // Total billing and pay based on APPROVED timesheets
  let totalBilled = 0;
  let totalPaid = 0;
  let totalHours = 0;
  
  approvedTimesheets.forEach(ts => {
    totalBilled += ts.subtotalBill;
    totalPaid += ts.subtotalPay;
    totalHours += ts.totalHours;
  });

  const grossMargin = totalBilled - totalPaid;
  const grossMarginPercent = totalBilled > 0 ? (grossMargin / totalBilled) * 100 : 0;

  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPaidInvoices = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.total, 0);
  const totalOutstanding = totalInvoiced - totalPaidInvoices;

  // Add handlers
  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    const newClient: Client = {
      id: `c-${Date.now()}`,
      companyName,
      contactName: clientContact,
      contactEmail: clientEmail,
      contactPhone: clientPhone,
      province: clientProvince,
      taxNumber: clientTaxNum || 'Pending Registration',
      baseBillRate: Number(clientBillRate)
    };
    onAddClient(newClient);
    setShowClientModal(false);
    // Reset Form
    setCompanyName('');
    setClientContact('');
    setClientEmail('');
    setClientPhone('');
    setClientTaxNum('');
  };

  const handleAddWorker = (e: React.FormEvent) => {
    e.preventDefault();
    const newWorker: Worker = {
      id: `w-${Date.now()}`,
      name: workerName,
      email: workerEmail,
      phone: workerPhone,
      province: workerProvince,
      basePayRate: Number(workerPayRate),
      bankName: workerBankName,
      bankAccount: workerBankAccount
    };
    onAddWorker(newWorker);
    setShowWorkerModal(false);
    // Reset Form
    setWorkerName('');
    setWorkerEmail('');
    setWorkerPhone('');
  };

  const handleAddPlacement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!placementWorkerId || !placementClientId) return;
    
    // Find worker province for placement defaults
    const selectedWorker = workers.find(w => w.id === placementWorkerId);

    const newPlacement: Placement = {
      id: `p-${Date.now()}`,
      workerId: placementWorkerId,
      clientId: placementClientId,
      roleTitle: placementRole,
      payRate: Number(placementPay),
      billRate: Number(placementBill),
      startDate: placementStart,
      payCycle: placementCycle,
      province: selectedWorker?.province || 'ON'
    };
    onAddPlacement(newPlacement);
    setShowPlacementModal(false);
    // Reset Form
    setPlacementRole('');
  };

  // Handles client selection for invoicing
  const handleInvoiceClientChange = (cId: string) => {
    setInvoiceClientId(cId);
    setSelectedTimesheets([]);
  };

  const toggleTimesheetSelection = (tsId: string) => {
    setSelectedTimesheets(prev => 
      prev.includes(tsId) ? prev.filter(id => id !== tsId) : [...prev, tsId]
    );
  };

  const handleCreateInvoiceSubmit = () => {
    if (!invoiceClientId || selectedTimesheets.length === 0) return;
    onGenerateInvoice(invoiceClientId, selectedTimesheets);
    setSelectedTimesheets([]);
    setInvoiceClientId('');
    setActiveTab('invoices');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Admin Title Banner */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem' }}>Apex Staffing: Agency Operations Panel</h2>
          <p style={{ color: 'var(--text-sub)' }}>Manage Canadian client accounts, worker payrolls, placements and invoicing compliance.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-control">
        <button className={`tab-link ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>Overview</button>
        <button className={`tab-link ${activeTab === 'clients' ? 'active' : ''}`} onClick={() => setActiveTab('clients')}>Clients</button>
        <button className={`tab-link ${activeTab === 'workers' ? 'active' : ''}`} onClick={() => setActiveTab('workers')}>Workers</button>
        <button className={`tab-link ${activeTab === 'placements' ? 'active' : ''}`} onClick={() => setActiveTab('placements')}>Placements</button>
        <button className={`tab-link ${activeTab === 'approvals' ? 'active' : ''}`} onClick={() => setActiveTab('approvals')}>Approvals Center ({pendingTimesheets.length})</button>
        <button className={`tab-link ${activeTab === 'invoices' ? 'active' : ''}`} onClick={() => setActiveTab('invoices')}>Billing & Invoices</button>
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Key Metrics */}
          <div className="dashboard-grid">
            <div className="glass-card metric-card">
              <div className="metric-header">
                <span>Gross Revenue (Billed)</span>
                <div className="metric-icon-wrap"><TrendingUp size={18} /></div>
              </div>
              <div className="metric-value">CAD ${(totalBilled).toFixed(2)}</div>
              <p className="metric-subtext">Cumulative from approved hours</p>
            </div>

            <div className="glass-card metric-card">
              <div className="metric-header">
                <span>Payroll Liability (Paid)</span>
                <div className="metric-icon-wrap"><Users size={18} /></div>
              </div>
              <div className="metric-value">CAD ${(totalPaid).toFixed(2)}</div>
              <p className="metric-subtext">Owed to placed workers</p>
            </div>

            <div className="glass-card metric-card">
              <div className="metric-header">
                <span>Agency Gross Margin</span>
                <div className="metric-icon-wrap" style={{ color: 'var(--color-success)' }}><DollarSign size={18} /></div>
              </div>
              <div className="metric-value" style={{ color: 'var(--color-success)' }}>
                CAD ${grossMargin.toFixed(2)}
              </div>
              <p className="metric-subtext">{grossMarginPercent.toFixed(1)}% Average Markup Margin</p>
            </div>

            <div className="glass-card metric-card">
              <div className="metric-header">
                <span>Outstanding Invoices</span>
                <div className="metric-icon-wrap" style={{ color: 'var(--color-warning)' }}><Briefcase size={18} /></div>
              </div>
              <div className="metric-value" style={{ color: 'var(--color-warning)' }}>
                CAD ${totalOutstanding.toFixed(2)}
              </div>
              <p className="metric-subtext">Total generated pending payment</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="form-row">
            {/* Quick Actions Panel */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                Quick Agency Configuration
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setShowClientModal(true)} style={{ height: '80px', flexDirection: 'column', gap: '6px' }}>
                  <Building2 size={20} style={{ color: 'var(--primary)' }} />
                  <span>Onboard Client</span>
                </button>
                <button className="btn btn-secondary" onClick={() => setShowWorkerModal(true)} style={{ height: '80px', flexDirection: 'column', gap: '6px' }}>
                  <Users size={20} style={{ color: 'var(--primary)' }} />
                  <span>Onboard Worker</span>
                </button>
                <button className="btn btn-secondary" onClick={() => {
                  if (workers.length > 0 && clients.length > 0) {
                    setPlacementWorkerId(workers[0].id);
                    setPlacementClientId(clients[0].id);
                    setPlacementPay(workers[0].basePayRate);
                    setPlacementBill(clients[0].baseBillRate);
                  }
                  setShowPlacementModal(true);
                }} style={{ height: '80px', flexDirection: 'column', gap: '6px', gridColumn: 'span 2' }}>
                  <Briefcase size={20} style={{ color: 'var(--primary)' }} />
                  <span>Create Placement Contract</span>
                </button>
              </div>
            </div>

            {/* Pending Approvals Tracker */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                Approvals Alert Queue
              </h3>
              {pendingTimesheets.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  No timesheets require client approval at the moment.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pendingTimesheets.map(ts => {
                    const pl = placements.find(p => p.id === ts.placementId);
                    const wr = pl ? workers.find(w => w.id === pl.workerId) : undefined;
                    const cl = pl ? clients.find(c => c.id === pl.clientId) : undefined;
                    return (
                      <div key={ts.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '8px', background: 'rgba(255,255,255,0.01)' }}>
                        <div>
                          <strong style={{ fontSize: '0.85rem' }}>{wr?.name} @ {cl?.companyName}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{ts.totalHours} hrs • Pay Cycle: {ts.payCycle}</div>
                        </div>
                        <button className="btn btn-secondary" onClick={() => setActiveTab('approvals')} style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                          Manage
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CLIENTS TAB */}
      {activeTab === 'clients' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.2rem' }}>Registered Client Companies</h3>
            <button className="btn btn-primary" onClick={() => setShowClientModal(true)}>
              <Plus size={16} /> Onboard New Client
            </button>
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Contact Person</th>
                  <th>Province</th>
                  <th>Tax Number</th>
                  <th>Base Bill Rate</th>
                </tr>
              </thead>
              <tbody>
                {clients.map(c => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.companyName}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>ID: {c.id}</div>
                    </td>
                    <td>
                      <div>{c.contactName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{c.contactEmail} • {c.contactPhone}</div>
                    </td>
                    <td>
                      <span className="badge badge-approved" style={{ background: 'rgba(227, 27, 35, 0.1)', color: 'var(--primary-hover)', border: '1px solid rgba(227,27,35,0.2)' }}>
                        {c.province}
                      </span>
                    </td>
                    <td><code style={{ fontSize: '0.8rem', color: 'var(--color-info)' }}>{c.taxNumber}</code></td>
                    <td>CAD ${c.baseBillRate.toFixed(2)}/hr</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WORKERS TAB */}
      {activeTab === 'workers' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.2rem' }}>Staff Candidates / Placed Workers</h3>
            <button className="btn btn-primary" onClick={() => setShowWorkerModal(true)}>
              <Plus size={16} /> Onboard New Worker
            </button>
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Worker Name</th>
                  <th>Contact Details</th>
                  <th>Province</th>
                  <th>Base Pay Rate</th>
                  <th>Direct Deposit Bank</th>
                </tr>
              </thead>
              <tbody>
                {workers.map(w => (
                  <tr key={w.id}>
                    <td>
                      <strong>{w.name}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>ID: {w.id}</div>
                    </td>
                    <td>
                      <div>{w.email}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{w.phone}</div>
                    </td>
                    <td>
                      <span className="badge badge-draft">{w.province}</span>
                    </td>
                    <td>CAD ${w.basePayRate.toFixed(2)}/hr</td>
                    <td>
                      <div>{w.bankName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{w.bankAccount}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PLACEMENTS TAB */}
      {activeTab === 'placements' && (
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '1.2rem' }}>Placement Contracts</h3>
            <button className="btn btn-primary" onClick={() => {
              if (workers.length > 0 && clients.length > 0) {
                setPlacementWorkerId(workers[0].id);
                setPlacementClientId(clients[0].id);
                setPlacementPay(workers[0].basePayRate);
                setPlacementBill(clients[0].baseBillRate);
              }
              setShowPlacementModal(true);
            }}>
              <Plus size={16} /> Create Placement
            </button>
          </div>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Placement ID</th>
                  <th>Worker Name</th>
                  <th>Client Company</th>
                  <th>Role Title</th>
                  <th>Hourly (Pay / Bill)</th>
                  <th>Prov. Rules</th>
                  <th>Pay Cycle</th>
                </tr>
              </thead>
              <tbody>
                {placements.map(p => {
                  const wr = workers.find(w => w.id === p.workerId);
                  const cl = clients.find(c => c.id === p.clientId);
                  return (
                    <tr key={p.id}>
                      <td><code style={{ fontSize: '0.8rem' }}>{p.id}</code></td>
                      <td><strong>{wr?.name}</strong></td>
                      <td>{cl?.companyName}</td>
                      <td>{p.roleTitle}</td>
                      <td>
                        <div>Pay: <strong style={{ color: 'var(--color-success)' }}>${p.payRate.toFixed(2)}/h</strong></div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Bill: <strong>${p.billRate.toFixed(2)}/h</strong></div>
                      </td>
                      <td><span className="badge badge-approved" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>{p.province}</span></td>
                      <td><span className="badge badge-draft" style={{ textTransform: 'capitalize' }}>{p.payCycle}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* APPROVALS CENTER TAB */}
      {activeTab === 'approvals' && (
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            Approvals Audit Center
          </h3>
          <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem', marginBottom: '20px' }}>
            As Agency Admin, you can review submitted timesheets and override approval decisions to ensure timely billing and payroll cycles.
          </p>

          {timesheets.filter(t => t.status === 'pending_approval').length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No timesheets are currently pending manager review.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {timesheets.filter(t => t.status === 'pending_approval').map(ts => {
                const pl = placements.find(p => p.id === ts.placementId);
                const wr = pl ? workers.find(w => w.id === pl.workerId) : undefined;
                const cl = pl ? clients.find(c => c.id === pl.clientId) : undefined;
                if (!pl || !wr || !cl) return null;

                const gpsChecks = ts.entries.map(entry => evaluateEntryGps(entry, pl));
                const hasGpsEntries = gpsChecks.some(check => check.status !== 'missing');
                const needsGpsReview = gpsChecks.some(check => check.status === 'warning');

                const handleAdminApprove = () => {
                  if (confirm('Approve this timesheet on behalf of client manager?')) {
                    const updated = { ...ts, status: 'approved' as const };
                    onSaveTimesheet(updated);
                  }
                };

                const handleAdminReject = () => {
                  const reason = prompt('Enter change request feedback for worker:') || 'Admin rejected timesheet. Please correct hours.';
                  const updated = { ...ts, status: 'rejected' as const, clientFeedback: reason };
                  onSaveTimesheet(updated);
                };

                return (
                  <div key={ts.id} className="time-row-card" style={{ border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.01)', padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px', marginBottom: '12px' }}>
                      <div>
                        <h4 style={{ fontSize: '1.1rem' }}>{wr.name} placed @ {cl.companyName}</h4>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                          Role: {pl.roleTitle} | Period: {ts.cycleStartDate} to {ts.cycleEndDate} ({ts.payCycle})
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-danger" onClick={handleAdminReject} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Reject</button>
                        <button className="btn btn-success" onClick={handleAdminApprove} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>Approve</button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '0.85rem' }}>
                      <div>Total Hours: <strong>{ts.totalHours} hrs</strong></div>
                      <div>Worker Payroll Cost: <strong style={{ color: 'var(--color-success)' }}>CAD ${ts.subtotalPay.toFixed(2)}</strong></div>
                      <div>Client Billable Amount: <strong style={{ color: '#FFFFFF' }}>CAD ${ts.subtotalBill.toFixed(2)}</strong></div>
                      <div>Agency Gross Margin: <strong style={{ color: 'var(--color-info)' }}>CAD ${(ts.subtotalBill - ts.subtotalPay).toFixed(2)}</strong></div>
                      <div>
                        GPS Flag:{' '}
                        <span className={`badge ${needsGpsReview ? 'badge-pending' : hasGpsEntries ? 'badge-approved' : 'badge-draft'}`}>
                          {needsGpsReview ? 'Review required' : hasGpsEntries ? 'Verified' : 'Missing'}
                        </span>
                      </div>
                    </div>

                    {/* GPS verification listing */}
                    {hasGpsEntries && (
                      <div style={{ marginTop: '12px', background: needsGpsReview ? 'rgba(245, 158, 11, 0.05)' : 'rgba(6, 182, 212, 0.05)', border: `1px dashed ${needsGpsReview ? 'rgba(245, 158, 11, 0.35)' : 'rgba(6, 182, 212, 0.2)'}`, padding: '10px 14px', borderRadius: '6px' }}>
                        <span style={{ fontSize: '0.75rem', color: needsGpsReview ? 'var(--color-warning)' : 'var(--color-info)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                          Clocking Map Coordinates Captured ({needsGpsReview ? 'review location drift' : 'GPS verified'}):
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
                          {ts.entries.map(entry => {
                            if (!entry.clockInGPS && !entry.clockOutGPS) return null;
                            const gpsCheck = evaluateEntryGps(entry, pl);
                            const gpsBadgeClass = gpsCheck.status === 'verified'
                              ? 'badge-approved'
                              : gpsCheck.status === 'warning'
                                ? 'badge-pending'
                                : 'badge-draft';
                            return (
                              <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px' }}>
                                <span>Date: {entry.date} ({entry.startTime} - {entry.endTime})</span>
                                <div style={{ display: 'flex', gap: '12px' }}>
                                  <span className={`badge ${gpsBadgeClass}`} style={{ fontSize: '0.68rem' }}>{gpsCheck.label}</span>
                                  {entry.clockInGPS && (
                                    <a href={getMapLink(entry.clockInGPS.latitude, entry.clockInGPS.longitude)} target="_blank" rel="noreferrer" style={{ color: 'var(--color-info)', textDecoration: 'underline' }}>
                                      In: Map Link
                                    </a>
                                  )}
                                  {entry.clockOutGPS && (
                                    <a href={getMapLink(entry.clockOutGPS.latitude, entry.clockOutGPS.longitude)} target="_blank" rel="noreferrer" style={{ color: 'var(--color-info)', textDecoration: 'underline' }}>
                                      Out: Map Link
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* BILLING & INVOICES TAB */}
      {activeTab === 'invoices' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '24px' }} className="form-row">
          
          {/* Left panel: Generate Invoices */}
          <div className="glass-card" style={{ height: 'fit-content' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Create Client Invoice
            </h3>
            
            <div className="form-group">
              <label>Select Client Business</label>
              <select 
                className="form-control"
                value={invoiceClientId}
                onChange={e => handleInvoiceClientChange(e.target.value)}
              >
                <option value="">-- Choose Client --</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>{c.companyName} ({c.province})</option>
                ))}
              </select>
            </div>

            {invoiceClientId && (
              <div>
                <h4 style={{ fontSize: '0.85rem', color: 'var(--text-sub)', marginBottom: '8px' }}>
                  Unbilled Approved Timesheets:
                </h4>
                
                {(() => {
                  const unbilledSheets = approvedTimesheets.filter(ts => {
                    const pl = placements.find(p => p.id === ts.placementId);
                    const isClientMatch = pl?.clientId === invoiceClientId;
                    // Check if already in an invoice
                    const isAlreadyInvoiced = invoices.some(inv => inv.timesheetIds.includes(ts.id));
                    return isClientMatch && !isAlreadyInvoiced;
                  });

                  if (unbilledSheets.length === 0) {
                    return <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No unbilled approved timesheets for this client.</p>;
                  }

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                      {unbilledSheets.map(ts => {
                        const pl = placements.find(p => p.id === ts.placementId);
                        const wr = pl ? workers.find(w => w.id === pl.workerId) : undefined;
                        return (
                          <div 
                            key={ts.id}
                            onClick={() => toggleTimesheetSelection(ts.id)}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '10px', 
                              padding: '10px', 
                              border: '1px solid var(--border-color)', 
                              borderRadius: '6px', 
                              cursor: 'pointer',
                              background: selectedTimesheets.includes(ts.id) ? 'rgba(227, 27, 35, 0.05)' : 'transparent',
                              borderColor: selectedTimesheets.includes(ts.id) ? 'var(--primary)' : 'var(--border-color)'
                            }}
                          >
                            <input 
                              type="checkbox" 
                              checked={selectedTimesheets.includes(ts.id)} 
                              readOnly 
                              style={{ accentColor: 'var(--primary)' }}
                            />
                            <div style={{ fontSize: '0.8rem' }}>
                              <strong>{wr?.name}</strong> ({pl?.roleTitle})
                              <div style={{ color: 'var(--text-sub)' }}>
                                Period: {ts.cycleStartDate} to {ts.cycleEndDate} • {ts.totalHours} hrs • Billed: ${ts.subtotalBill.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                <button 
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  disabled={selectedTimesheets.length === 0}
                  onClick={handleCreateInvoiceSubmit}
                >
                  <FileSpreadsheet size={16} /> Generate Invoice (CAD)
                </button>
              </div>
            )}
          </div>

          {/* Right panel: Invoice History & Details */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Invoice Registry (Compliance & Taxes)
            </h3>
            {invoices.length === 0 ? (
              <div style={{ padding: '40px', color: 'var(--text-muted)', textAlign: 'center' }}>
                No client invoices have been generated yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {invoices.map(inv => {
                  const cl = clients.find(c => c.id === inv.clientId);
                  const provTax = cl ? getProvinceTax(cl.province) : { gstHstRate: 0.05, label: '5% GST' };

                  return (
                    <div key={inv.id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', background: 'rgba(0,0,0,0.15)', overflow: 'hidden' }}>
                      {/* Invoice Top Bar */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 18px', borderBottom: '1px solid var(--border-color)' }}>
                        <div>
                          <code style={{ color: 'var(--color-info)', fontSize: '0.85rem' }}>#{inv.id}</code>
                          <strong style={{ marginLeft: '12px' }}>{cl?.companyName}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span className={`badge ${inv.status === 'paid' ? 'badge-approved' : 'badge-pending'}`}>
                            {inv.status}
                          </span>
                          {inv.status === 'pending' && (
                            <button 
                              className="btn btn-success" 
                              onClick={() => onUpdateInvoiceStatus(inv.id, 'paid')}
                              style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                            >
                              <Check size={12} /> Mark Paid
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Invoice Details */}
                      <div style={{ padding: '18px', fontSize: '0.85rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', color: 'var(--text-sub)' }}>
                          <div>Invoice Date: <strong>{inv.invoiceDate}</strong></div>
                          <div>Due Date: <strong>{inv.dueDate}</strong></div>
                          <div>Billing Period: <strong>{inv.periodStartDate} to {inv.periodEndDate}</strong></div>
                          <div>Province Rate: <strong>{provTax.label}</strong></div>
                        </div>

                        {/* Financial calculation rows */}
                        <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Subtotal (Net Hours Billed)</span>
                            <strong>CAD ${inv.subtotal.toFixed(2)}</strong>
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-sub)' }}>
                            <span>GST/HST ({(inv.gstHstRate * 100).toFixed(0)}%)</span>
                            <span>CAD ${inv.gstHstAmount.toFixed(2)}</span>
                          </div>

                          {inv.qstAmount && inv.qstRate && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-sub)' }}>
                              <span>QST ({(inv.qstRate * 100).toFixed(3)}%)</span>
                              <span>CAD ${inv.qstAmount.toFixed(2)}</span>
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '8px', color: '#FFFFFF' }}>
                            <strong>Grand Total (Gross Billed)</strong>
                            <strong style={{ color: 'var(--primary-hover)' }}>CAD ${inv.total.toFixed(2)}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Add Client */}
      {showClientModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Onboard Canadian Client Account</h3>
              <button className="close-btn" onClick={() => setShowClientModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddClient}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Company Legal Name</label>
                  <input type="text" className="form-control" value={companyName} onChange={e => setCompanyName(e.target.value)} required placeholder="e.g. Ontario Warehousing Ltee." />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Primary Contact Name</label>
                    <input type="text" className="form-control" value={clientContact} onChange={e => setClientContact(e.target.value)} required placeholder="Jane Doe" />
                  </div>
                  <div className="form-group">
                    <label>Contact Phone</label>
                    <input type="text" className="form-control" value={clientPhone} onChange={e => setClientPhone(e.target.value)} required placeholder="416-555-0100" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Contact Email</label>
                  <input type="email" className="form-control" value={clientEmail} onChange={e => setClientEmail(e.target.value)} required placeholder="billing@company.ca" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Province of Business (Tax Rule)</label>
                    <select className="form-control" value={clientProvince} onChange={e => setClientProvince(e.target.value as CanadianProvince)}>
                      <option value="ON">Ontario (13% HST)</option>
                      <option value="BC">British Columbia (5% GST)</option>
                      <option value="QC">Quebec (5% GST + 9.975% QST)</option>
                      <option value="AB">Alberta (5% GST)</option>
                      <option value="OTHER">Other Territory (5% GST)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>GST/HST Number</label>
                    <input type="text" className="form-control" value={clientTaxNum} onChange={e => setClientTaxNum(e.target.value)} required placeholder="GST123456789-RT0001" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Standard Hourly Bill Rate (CAD)</label>
                  <input type="number" step="0.5" className="form-control" value={clientBillRate} onChange={e => setClientBillRate(Number(e.target.value))} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowClientModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Client</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Worker */}
      {showWorkerModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Onboard Worker Candidate</h3>
              <button className="close-btn" onClick={() => setShowWorkerModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddWorker}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Worker Full Name</label>
                  <input type="text" className="form-control" value={workerName} onChange={e => setWorkerName(e.target.value)} required placeholder="John Smith" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Email Address</label>
                    <input type="email" className="form-control" value={workerEmail} onChange={e => setWorkerEmail(e.target.value)} required placeholder="john@worker.ca" />
                  </div>
                  <div className="form-group">
                    <label>Phone Number</label>
                    <input type="text" className="form-control" value={workerPhone} onChange={e => setWorkerPhone(e.target.value)} required placeholder="647-555-0133" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Home Province (Overtime Rules)</label>
                    <select className="form-control" value={workerProvince} onChange={e => setWorkerProvince(e.target.value as CanadianProvince)}>
                      <option value="ON">Ontario (44h OT Rule)</option>
                      <option value="BC">British Columbia (8h/day, 40h OT)</option>
                      <option value="QC">Quebec (40h OT)</option>
                      <option value="AB">Alberta (8h/day, 44h OT)</option>
                      <option value="OTHER">Other (Standard 40h OT)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Default Payroll Hourly Rate (CAD)</label>
                    <input type="number" step="0.5" className="form-control" value={workerPayRate} onChange={e => setWorkerPayRate(Number(e.target.value))} required />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Direct Deposit Bank Name</label>
                    <input type="text" className="form-control" value={workerBankName} onChange={e => setWorkerBankName(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Account Number (Mocked)</label>
                    <input type="text" className="form-control" value={workerBankAccount} onChange={e => setWorkerBankAccount(e.target.value)} required />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowWorkerModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Worker</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Placement */}
      {showPlacementModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create Placement Assignment Contract</h3>
              <button className="close-btn" onClick={() => setShowPlacementModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleAddPlacement}>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label>Select Worker</label>
                    <select 
                      className="form-control" 
                      value={placementWorkerId} 
                      onChange={e => {
                        setPlacementWorkerId(e.target.value);
                        const wr = workers.find(w => w.id === e.target.value);
                        if (wr) setPlacementPay(wr.basePayRate);
                      }}
                      required
                    >
                      {workers.map(w => (
                        <option key={w.id} value={w.id}>{w.name} (Base Rate: ${w.basePayRate}/h)</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Select Client Business</label>
                    <select 
                      className="form-control" 
                      value={placementClientId} 
                      onChange={e => {
                        setPlacementClientId(e.target.value);
                        const cl = clients.find(c => c.id === e.target.value);
                        if (cl) setPlacementBill(cl.baseBillRate);
                      }}
                      required
                    >
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.companyName} (Base Bill: ${c.baseBillRate}/h)</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Job / Role Title</label>
                  <input type="text" className="form-control" value={placementRole} onChange={e => setPlacementRole(e.target.value)} required placeholder="e.g. Lead Developer, General Laborer" />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Hourly Pay Rate (Paid to Worker)</label>
                    <input type="number" step="0.5" className="form-control" value={placementPay} onChange={e => setPlacementPay(Number(e.target.value))} required />
                  </div>
                  <div className="form-group">
                    <label>Hourly Bill Rate (Charged to Client)</label>
                    <input type="number" step="0.5" className="form-control" value={placementBill} onChange={e => setPlacementBill(Number(e.target.value))} required />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Assignment Start Date</label>
                    <input type="date" className="form-control" value={placementStart} onChange={e => setPlacementStart(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Payroll / Billing Frequency</label>
                    <select className="form-control" value={placementCycle} onChange={e => setPlacementCycle(e.target.value as PayCycle)}>
                      <option value="daily">Daily Wages</option>
                      <option value="weekly">Weekly Cycle (Mon-Sun)</option>
                      <option value="biweekly">Bi-weekly Cycle (Every 2 weeks)</option>
                      <option value="monthly">Monthly Cycle (Calendar month)</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPlacementModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!placementWorkerId || !placementClientId || !placementRole.trim()}>Save Contract</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
