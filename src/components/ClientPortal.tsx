import React, { useState } from 'react';
import type { Placement, Worker, Timesheet, Client } from '../types';
import {
  calculateTimesheetTotals,
  evaluateEntryGps,
  getMapLink,
  getTimesheetStatusClass,
  getTimesheetStatusLabel,
  hasBlockingValidationIssues,
  isSubmittedForClientStatus,
  validateTimesheetEntries
} from '../utils';
import { importedRowsToTimeEntries, type ImportedTimesheetRow } from '../timesheetImport';
import { TimesheetImportModal } from './TimesheetImportModal';
import { 
  Users, 
  CheckCircle, 
  XCircle, 
  MapPin, 
  Eye, 
  AlertCircle,
  Upload
} from 'lucide-react';

interface ClientPortalProps {
  clientId: string;
  clients: Client[];
  placements: Placement[];
  workers: Worker[];
  timesheets: Timesheet[];
  onSaveTimesheet: (timesheet: Timesheet) => void;
  onApproveTimesheet: (timesheetId: string) => void;
  onRejectTimesheet: (timesheetId: string, feedback: string) => void;
}

export const ClientPortal: React.FC<ClientPortalProps> = ({
  clientId,
  clients,
  placements,
  workers,
  timesheets,
  onSaveTimesheet,
  onApproveTimesheet,
  onRejectTimesheet
}) => {
  const client = clients.find(c => c.id === clientId);
  
  // Find placements under this client
  const clientPlacements = placements.filter(p => p.clientId === clientId);
  const placementIds = clientPlacements.map(p => p.id);

  // Filter timesheets for this client
  const clientTimesheets = timesheets.filter(t => placementIds.includes(t.placementId));
  
  // Sort timesheets
  const pendingTimesheets = clientTimesheets.filter(t => isSubmittedForClientStatus(t.status));
  const pastTimesheets = clientTimesheets.filter(t => !isSubmittedForClientStatus(t.status));

  // Active viewing timesheet state
  const [viewingTimesheet, setViewingTimesheet] = useState<Timesheet | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [importTarget, setImportTarget] = useState<{ timesheet: Timesheet; placement: Placement; workerName?: string } | null>(null);

  // Stats
  const activeRosterCount = clientPlacements.length;
  const pendingCount = pendingTimesheets.length;
  
  const handleApprove = (id: string) => {
    const timesheet = timesheets.find(ts => ts.id === id);
    if (timesheet && hasBlockingValidationIssues(timesheet.entries)) {
      alert('This timesheet has validation errors. Request changes before approving.');
      return;
    }
    if (confirm('Are you sure you want to approve this timesheet? It will move to agency review before invoicing.')) {
      onApproveTimesheet(id);
      setViewingTimesheet(null);
    }
  };

  const handleOpenReject = () => {
    setRejectFeedback('');
    setShowRejectModal(true);
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingTimesheet || !rejectFeedback.trim()) return;
    onRejectTimesheet(viewingTimesheet.id, rejectFeedback.trim());
    setShowRejectModal(false);
    setViewingTimesheet(null);
  };

  const handleApplyImportedRows = (rows: ImportedTimesheetRow[]) => {
    if (!importTarget) return;

    const importedEntries = importedRowsToTimeEntries(rows, 'client manager upload');
    const updatedTimesheet: Timesheet = {
      ...importTarget.timesheet,
      entries: [...importTarget.timesheet.entries, ...importedEntries]
    };
    const recalculated = calculateTimesheetTotals(updatedTimesheet.entries, importTarget.placement);
    const savedTimesheet = {
      ...updatedTimesheet,
      entries: recalculated.entries,
      totalHours: recalculated.totalHours,
      subtotalPay: recalculated.subtotalPay,
      subtotalBill: recalculated.subtotalBill
    };

    onSaveTimesheet(savedTimesheet);
    setViewingTimesheet(savedTimesheet);
    setImportTarget(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Client Header Info */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem' }}>Client Portal: {client?.companyName}</h2>
          <p style={{ color: 'var(--text-sub)' }}>
            Approve timesheets for placed workers and verify location compliance. (Province: {client?.province})
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="badge badge-approved" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
            <Users size={14} /> Active Roster: {activeRosterCount}
          </div>
          {pendingCount > 0 && (
            <div className="badge badge-pending" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
              <AlertCircle size={14} /> Pending Review: {pendingCount}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: viewingTimesheet ? '1.2fr 1.8fr' : '1fr', gap: '24px' }} className="form-row">
        
        {/* Left Side: Pending Approvals Queue and Roster */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Pending Reviews Card */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Pending Timesheet Approvals
            </h3>
            
            {pendingTimesheets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                No timesheets are currently pending your approval. Good job!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {pendingTimesheets.map(ts => {
                  const pl = placements.find(p => p.id === ts.placementId);
                  const wr = pl ? workers.find(w => w.id === pl.workerId) : undefined;
                  return (
                    <div 
                      key={ts.id} 
                      className={`time-row-card ${viewingTimesheet?.id === ts.id ? 'active' : ''}`}
                      onClick={() => setViewingTimesheet(ts)}
                      style={{ 
                        cursor: 'pointer',
                        borderColor: viewingTimesheet?.id === ts.id ? 'var(--primary)' : 'var(--border-color)',
                        background: viewingTimesheet?.id === ts.id ? 'rgba(227, 27, 35, 0.03)' : 'rgba(255, 255, 255, 0.02)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ color: '#FFFFFF', fontSize: '0.95rem' }}>{wr?.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '2px' }}>
                            {pl?.roleTitle} • Period: {ts.cycleStartDate} to {ts.cycleEndDate}
                          </div>
                        </div>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                          <Eye size={12} /> Review
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Roster List */}
          <div className="glass-card">
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              Your Active Staffing Roster
            </h3>
            {clientPlacements.length === 0 ? (
              <div style={{ padding: '20px', color: 'var(--text-muted)', textAlign: 'center' }}>
                No active workers are currently placed at your company.
              </div>
            ) : (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Worker</th>
                      <th>Role Title</th>
                      <th>Pay Cycle</th>
                      <th>Bill Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientPlacements.map(pl => {
                      const wr = workers.find(w => w.id === pl.workerId);
                      return (
                        <tr key={pl.id}>
                          <td>
                            <strong>{wr?.name}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{wr?.email}</div>
                          </td>
                          <td>{pl.roleTitle}</td>
                          <td><span className="badge badge-draft">{pl.payCycle}</span></td>
                          <td>CAD ${pl.billRate.toFixed(2)}/hr</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Detailed Timesheet Review Panel (GPS maps, daily grids, invoice estimation) */}
        {viewingTimesheet && (
          <div className="glass-card" style={{ border: '1px solid var(--primary-glow)' }}>
            {(() => {
              const pl = placements.find(p => p.id === viewingTimesheet.placementId);
              const wr = pl ? workers.find(w => w.id === pl.workerId) : undefined;
              if (!pl || !wr) return null;

              const gpsChecks = viewingTimesheet.entries.map(entry => evaluateEntryGps(entry, pl));
              const hasGpsEntries = gpsChecks.some(check => check.status !== 'missing');
              const needsGpsReview = gpsChecks.some(check => check.status === 'warning');
              const validationIssues = validateTimesheetEntries(viewingTimesheet.entries);
              const validationErrors = validationIssues.filter(issue => issue.severity === 'error').length;
              const validationWarnings = validationIssues.filter(issue => issue.severity === 'warning').length;

              return (
                <div>
                  {/* Detailed Panel Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)', fontWeight: 600 }}>APPROVING MANAGER AUDIT</span>
                      <h3 style={{ fontSize: '1.4rem', marginTop: '2px' }}>{wr.name}</h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                        Role: {pl.roleTitle} | Period: {viewingTimesheet.cycleStartDate} to {viewingTimesheet.cycleEndDate}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.78rem' }} onClick={() => setImportTarget({ timesheet: viewingTimesheet, placement: pl, workerName: wr.name })}>
                        <Upload size={14} /> Import
                      </button>
                      <button className="close-btn" onClick={() => setViewingTimesheet(null)}>&times;</button>
                    </div>
                  </div>

                  {/* Highlight GPS Tracking Info */}
                  <div style={{ background: needsGpsReview ? 'rgba(245, 158, 11, 0.08)' : 'rgba(6, 182, 212, 0.08)', border: `1px dashed ${needsGpsReview ? 'var(--color-warning)' : 'var(--color-info)'}`, borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
                    <h4 style={{ color: needsGpsReview ? 'var(--color-warning)' : 'var(--color-info)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <MapPin size={14} /> GPS Location Verification Flag: {needsGpsReview ? 'Review Required' : hasGpsEntries ? 'Verified' : 'Missing'}
                      </h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>
                        {needsGpsReview
                          ? 'One or more clock points are outside the expected job-site radius. Open the map links below before approving.'
                          : hasGpsEntries
                            ? 'Clock points were captured near the expected job site. Map links remain available for spot checks.'
                            : 'No GPS points were captured for this timesheet. Review worker notes before approving.'}
                      </p>
                  </div>

                  {validationIssues.length > 0 && (
                    <div style={{ background: validationErrors > 0 ? 'var(--color-error-bg)' : 'var(--color-warning-bg)', border: `1px solid ${validationErrors > 0 ? 'var(--color-error)' : 'rgba(245, 158, 11, 0.35)'}`, borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
                      <h4 style={{ color: validationErrors > 0 ? 'var(--color-error)' : 'var(--color-warning)', fontSize: '0.9rem', marginBottom: '4px' }}>
                        Validation: {validationErrors} error{validationErrors === 1 ? '' : 's'}, {validationWarnings} warning{validationWarnings === 1 ? '' : 's'}
                      </h4>
                      <p style={{ color: 'var(--text-sub)', fontSize: '0.75rem' }}>
                        Errors must be corrected before this timesheet can be approved.
                      </p>
                    </div>
                  )}

                  {/* Calculations summary */}
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    <div style={{ flex: 1, minWidth: '120px', background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Billable Hours</span>
                      <h4 style={{ fontSize: '1.25rem', marginTop: '4px' }}>{viewingTimesheet.totalHours} hrs</h4>
                    </div>
                    <div style={{ flex: 1, minWidth: '120px', background: 'rgba(255, 255, 255, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Subtotal Billing</span>
                      <h4 style={{ fontSize: '1.25rem', marginTop: '4px', color: '#FFFFFF' }}>
                        CAD ${viewingTimesheet.subtotalBill.toFixed(2)}
                      </h4>
                    </div>
                  </div>

                  {/* Daily Shifts Table */}
                  <h4 style={{ fontSize: '0.95rem', marginBottom: '10px' }}>Shift Details</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                    {viewingTimesheet.entries.map(entry => {
                      const gpsCheck = evaluateEntryGps(entry, pl);
                      const entryIssues = validationIssues.filter(issue => issue.entryId === entry.id);
                      const gpsBadgeClass = gpsCheck.status === 'verified'
                        ? 'badge-approved'
                        : gpsCheck.status === 'warning'
                          ? 'badge-pending'
                          : 'badge-draft';

                      return (
                      <div key={entry.id} className="time-row-card" style={{ padding: '12px', background: 'rgba(0,0,0,0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600 }}>
                          <span style={{ color: 'var(--primary-hover)' }}>{entry.date}</span>
                          <span>{entry.startTime} - {entry.endTime} ({entry.breakMinutes}m break)</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginTop: '6px' }}>
                          <span style={{ color: 'var(--text-sub)' }}>Notes: "{entry.notes}"</span>
                          <span style={{ fontWeight: 600 }}>
                            Hours: {entry.regularHours + entry.overtimeHours + entry.doubleTimeHours}h
                            {entry.overtimeHours > 0 && <span style={{ color: 'var(--color-warning)', marginLeft: '6px' }}>({entry.overtimeHours}h OT)</span>}
                            {entry.doubleTimeHours > 0 && <span style={{ color: 'var(--color-error)', marginLeft: '6px' }}>({entry.doubleTimeHours}h DT)</span>}
                          </span>
                        </div>
                        <div style={{ marginTop: '8px' }}>
                          <span className={`badge ${gpsBadgeClass}`} style={{ fontSize: '0.72rem' }}>
                            {gpsCheck.label}
                          </span>
                        </div>

                        {entryIssues.length > 0 && (
                          <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '0.74rem' }}>
                            {entryIssues.map((issue, issueIndex) => (
                              <span key={`${entry.id}-${issueIndex}`} style={{ color: issue.severity === 'error' ? 'var(--color-error)' : 'var(--color-warning)' }}>
                                {issue.severity === 'error' ? 'Error' : 'Warning'}: {issue.message}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* GPS Log visualization */}
                        {(entry.clockInGPS || entry.clockOutGPS) && (
                          <div style={{ marginTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.04)', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
                            {entry.clockInGPS && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-info)' }}>
                                <MapPin size={12} />
                                <span>Clocked In: <strong>{entry.clockInGPS.address || 'Address Verified'}</strong></span>
                                <a href={getMapLink(entry.clockInGPS.latitude, entry.clockInGPS.longitude)} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', color: 'var(--color-info)' }}>
                                  ({entry.clockInGPS.latitude}, {entry.clockInGPS.longitude})
                                </a>
                              </div>
                            )}
                            {entry.clockOutGPS && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-info)' }}>
                                <MapPin size={12} />
                                <span>Clocked Out: <strong>{entry.clockOutGPS.address || 'Address Verified'}</strong></span>
                                <a href={getMapLink(entry.clockOutGPS.latitude, entry.clockOutGPS.longitude)} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', color: 'var(--color-info)' }}>
                                  ({entry.clockOutGPS.latitude}, {entry.clockOutGPS.longitude})
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>

                  {/* Actions buttons */}
                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <button className="btn btn-danger" onClick={handleOpenReject}>
                      <XCircle size={16} /> Request Changes
                    </button>
                    <button className="btn btn-success" onClick={() => handleApprove(viewingTimesheet.id)}>
                      <CheckCircle size={16} /> Approve Timesheet
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* History Log Card */}
      {pastTimesheets.length > 0 && (
        <div className="glass-card">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
            Historical Timesheets Billed
          </h3>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Placed Worker</th>
                  <th>Billing Rate</th>
                  <th>Hours Worked</th>
                  <th>Subtotal Bill</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pastTimesheets.map(ts => {
                  const pl = placements.find(p => p.id === ts.placementId);
                  const wr = pl ? workers.find(w => w.id === pl.workerId) : undefined;
                  return (
                    <tr key={ts.id}>
                      <td>
                        <strong>{ts.cycleStartDate} to {ts.cycleEndDate}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{ts.payCycle} cycle</div>
                      </td>
                      <td>
                        <strong>{wr?.name}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{pl?.roleTitle}</div>
                      </td>
                      <td>CAD ${pl?.billRate.toFixed(2)}/hr</td>
                      <td>{ts.totalHours} hrs</td>
                      <td>CAD ${ts.subtotalBill.toFixed(2)}</td>
                      <td>
                        <span className={`badge ${getTimesheetStatusClass(ts.status)}`}>{getTimesheetStatusLabel(ts.status)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Change Request Feedback Modal */}
      {showRejectModal && viewingTimesheet && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Request Timesheet Revision</h3>
              <button className="close-btn" onClick={() => setShowRejectModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleRejectSubmit}>
              <div className="modal-body">
                <div style={{ display: 'flex', gap: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                  <AlertCircle size={18} style={{ color: 'var(--color-error)' }} />
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                    Provide specific feedback explaining why the timesheet was rejected. The worker will see this feedback in their portal and will be allowed to modify the entries and submit again.
                  </p>
                </div>
                <div className="form-group">
                  <label>Change Request Notes</label>
                  <textarea 
                    className="form-control" 
                    value={rejectFeedback} 
                    onChange={e => setRejectFeedback(e.target.value)} 
                    placeholder="e.g., Please check hours for Tuesday, client roster says you logged out at 16:00..."
                    rows={4}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRejectModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={!rejectFeedback.trim()}>Send back to Worker</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importTarget && (
        <TimesheetImportModal
          title="Import Client Timesheet"
          targetLabel={`${importTarget.workerName || 'Worker'} | ${importTarget.timesheet.cycleStartDate} to ${importTarget.timesheet.cycleEndDate}`}
          onClose={() => setImportTarget(null)}
          onApply={handleApplyImportedRows}
        />
      )}
    </div>
  );
};
