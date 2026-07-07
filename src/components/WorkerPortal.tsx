import React, { useState, useEffect } from 'react';
import type { Placement, Client, Timesheet, TimeEntry, GPSLocation } from '../types';
import {
  calculateTimesheetTotals,
  getMapLink,
  getTimesheetStatusClass,
  getTimesheetStatusLabel,
  isWorkerEditableStatus
} from '../utils';
import { parseTimesheetText, type ImportedTimesheetRow } from '../timesheetImport';
import { gpsCoordinates } from '../mockData';
import { 
  Play, 
  Square, 
  MapPin, 
  Plus, 
  CheckCircle, 
  AlertTriangle, 
  Calendar, 
  Clock, 
  FileText,
  Trash2,
  Edit2,
  Upload
} from 'lucide-react';

interface WorkerPortalProps {
  workerId: string;
  placements: Placement[];
  clients: Client[];
  timesheets: Timesheet[];
  onSaveTimesheet: (timesheet: Timesheet) => void;
  onSubmitTimesheet: (timesheetId: string) => void;
}

export const WorkerPortal: React.FC<WorkerPortalProps> = ({
  workerId,
  placements,
  clients,
  timesheets,
  onSaveTimesheet,
  onSubmitTimesheet
}) => {
  // Find placements for this worker
  const workerPlacements = placements.filter(p => p.workerId === workerId);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string>(
    workerPlacements[0]?.id || ''
  );
  
  const activePlacement = placements.find(p => p.id === selectedPlacementId);
  const client = activePlacement ? clients.find(c => c.id === activePlacement.clientId) : undefined;
  
  // Find timesheets for the selected placement
  const placementTimesheets = timesheets.filter(t => t.placementId === selectedPlacementId);
  
  // Sort timesheets: editable first, then by date desc
  const sortedTimesheets = [...placementTimesheets].sort((a, b) => {
    if (isWorkerEditableStatus(a.status)) return -1;
    if (isWorkerEditableStatus(b.status)) return 1;
    return new Date(b.cycleStartDate).getTime() - new Date(a.cycleStartDate).getTime();
  });

  const [activeTimesheet, setActiveTimesheet] = useState<Timesheet | undefined>(undefined);
  
  useEffect(() => {
    // Select the first editable timesheet, or the most recent one
    const current = sortedTimesheets[0];
    setActiveTimesheet(current);
  }, [selectedPlacementId, timesheets]);

  // Clock state
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<string>('');
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsInfo, setGpsInfo] = useState<GPSLocation | null>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  // Manual entry modal state
  const [showManualModal, setShowManualModal] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [manualDate, setManualDate] = useState(new Date().toISOString().split('T')[0]);
  const [manualStart, setManualStart] = useState('09:00');
  const [manualEnd, setManualEnd] = useState('17:00');
  const [manualBreak, setManualBreak] = useState(30);
  const [manualNotes, setManualNotes] = useState('');

  // Timesheet import / OCR modal state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFileName, setImportFileName] = useState('');
  const [importRawText, setImportRawText] = useState('');
  const [importRows, setImportRows] = useState<ImportedTimesheetRow[]>([]);
  const [importProcessing, setImportProcessing] = useState(false);
  const [importError, setImportError] = useState('');

  // Check if worker is currently clocked in across timesheets
  useEffect(() => {
    if (!activeTimesheet) return;
    const clockedInEntry = activeTimesheet.entries.find(e => e.isClockedIn);
    if (clockedInEntry) {
      setIsClockedIn(true);
      setClockInTime(clockedInEntry.startTime);
      setActiveEntryId(clockedInEntry.id);
      if (clockedInEntry.clockInGPS) {
        setGpsInfo(clockedInEntry.clockInGPS);
      }
    } else {
      setIsClockedIn(false);
      setClockInTime('');
      setActiveEntryId(null);
      setGpsInfo(null);
    }
  }, [activeTimesheet]);

  // Timer counter effect
  useEffect(() => {
    let timer: any;
    if (isClockedIn && clockInTime) {
      const updateTimer = () => {
        const [h, m] = clockInTime.split(':').map(Number);
        const start = new Date();
        start.setHours(h, m, 0, 0);
        
        const now = new Date();
        // Handle overnight shifts
        if (now < start) {
          start.setDate(start.getDate() - 1);
        }
        
        const diffMs = now.getTime() - start.getTime();
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffMins = Math.floor((diffMs % 3600000) / 60000);
        const diffSecs = Math.floor((diffMs % 60000) / 1000);
        
        setElapsedTime(
          `${diffHrs.toString().padStart(2, '0')}:${diffMins.toString().padStart(2, '0')}:${diffSecs.toString().padStart(2, '0')}`
        );
      };
      
      updateTimer();
      timer = setInterval(updateTimer, 1000);
    } else {
      setElapsedTime('00:00:00');
    }
    return () => clearInterval(timer);
  }, [isClockedIn, clockInTime]);

  if (workerPlacements.length === 0) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
        <AlertTriangle size={48} className="text-warning" style={{ margin: '0 auto 16px', color: 'var(--color-warning)' }} />
        <h2>No Placements Found</h2>
        <p style={{ color: 'var(--text-sub)', marginTop: '8px' }}>
          You do not have any active work placements. Please contact Apex Staffing Agency.
        </p>
      </div>
    );
  }

  // Fetch coordinates using Geolocation or mock fallback
  const getCoordinates = (): Promise<GPSLocation> => {
    return new Promise((resolve) => {
      if ('geolocation' in navigator) {
        setGpsLoading(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setGpsLoading(false);
            resolve({
              latitude: Number(position.coords.latitude.toFixed(6)),
              longitude: Number(position.coords.longitude.toFixed(6)),
              timestamp: position.timestamp,
              accuracy: Math.round(position.coords.accuracy),
              address: 'GPS Verified Location'
            });
          },
          () => {
            // Permission denied or error - fallback to simulated Canadian city coordinates
            setGpsLoading(false);
            const prov = activePlacement?.province || 'ON';
            let ref = gpsCoordinates.toronto;
            if (prov === 'BC') ref = gpsCoordinates.vancouver;
            if (prov === 'QC') ref = gpsCoordinates.montreal;
            
            // Add a tiny random jitter so coordinates aren't exactly identical
            const jitterLat = (Math.random() - 0.5) * 0.0005;
            const jitterLng = (Math.random() - 0.5) * 0.0005;

            resolve({
              latitude: Number((ref.lat + jitterLat).toFixed(6)),
              longitude: Number((ref.lng + jitterLng).toFixed(6)),
              timestamp: Date.now(),
              accuracy: 15,
              address: ref.address,
              isSimulated: true
            });
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else {
        // No geolocation support
        const prov = activePlacement?.province || 'ON';
        const ref = prov === 'BC' ? gpsCoordinates.vancouver : prov === 'QC' ? gpsCoordinates.montreal : gpsCoordinates.toronto;
        resolve({
          latitude: ref.lat,
          longitude: ref.lng,
          timestamp: Date.now(),
          address: ref.address,
          isSimulated: true
        });
      }
    });
  };

  // Clock In Action
  const handleClockIn = async () => {
    if (!activeTimesheet || !activePlacement) return;
    
    const location = await getCoordinates();
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const dateStr = now.toISOString().split('T')[0];

    const newEntry: TimeEntry = {
      id: `te-${Date.now()}`,
      date: dateStr,
      startTime: timeStr,
      endTime: '',
      breakMinutes: 0,
      notes: 'Clocked In via mobile portal.',
      regularHours: 0,
      overtimeHours: 0,
      doubleTimeHours: 0,
      clockInGPS: location,
      isClockedIn: true
    };

    const updatedTimesheet: Timesheet = {
      ...activeTimesheet,
      entries: [...activeTimesheet.entries, newEntry]
    };

    // Calculate totals
    const recalculated = calculateTimesheetTotals(updatedTimesheet.entries, activePlacement);
    onSaveTimesheet({
      ...updatedTimesheet,
      entries: recalculated.entries,
      totalHours: recalculated.totalHours,
      subtotalPay: recalculated.subtotalPay,
      subtotalBill: recalculated.subtotalBill
    });
  };

  // Clock Out Action
  const handleClockOut = async () => {
    if (!activeTimesheet || !activePlacement || !activeEntryId) return;

    const location = await getCoordinates();
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // Prompt worker for details of tasks done
    const notesInput = prompt('Briefly describe your tasks completed today:') || 'Completed assigned shift duties.';
    const breakInput = prompt('Enter unpaid break duration in minutes (default is 30):') || '30';
    const breakMin = Math.max(0, parseInt(breakInput, 10) || 0);

    const updatedEntries = activeTimesheet.entries.map(entry => {
      if (entry.id === activeEntryId) {
        return {
          ...entry,
          endTime: timeStr,
          breakMinutes: breakMin,
          notes: notesInput,
          clockOutGPS: location,
          isClockedIn: false
        };
      }
      return entry;
    });

    const updatedTimesheet: Timesheet = {
      ...activeTimesheet,
      entries: updatedEntries
    };

    const recalculated = calculateTimesheetTotals(updatedTimesheet.entries, activePlacement);
    onSaveTimesheet({
      ...updatedTimesheet,
      entries: recalculated.entries,
      totalHours: recalculated.totalHours,
      subtotalPay: recalculated.subtotalPay,
      subtotalBill: recalculated.subtotalBill
    });
  };

  // Start new timesheet cycle if none exists
  const handleStartNewTimesheet = () => {
    if (!activePlacement) return;
    const now = new Date();
    const cycleStartDate = now.toISOString().split('T')[0]; // Simple fallback
    
    // Set appropriate start date based on cycle
    let cycleEndDate = cycleStartDate;
    if (activePlacement.payCycle === 'weekly') {
      // Find Monday
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(now.setDate(diff));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      
      const monStr = mon.toISOString().split('T')[0];
      const sunStr = sun.toISOString().split('T')[0];
      
      const newSheet: Timesheet = {
        id: `ts-${Date.now()}`,
        placementId: activePlacement.id,
        cycleStartDate: monStr,
        cycleEndDate: sunStr,
        entries: [],
        status: 'draft',
        totalHours: 0,
        subtotalPay: 0,
        subtotalBill: 0,
        payCycle: 'weekly'
      };
      onSaveTimesheet(newSheet);
      return;
    } else if (activePlacement.payCycle === 'daily') {
      cycleEndDate = cycleStartDate;
    } else if (activePlacement.payCycle === 'biweekly') {
      const nextFortnight = new Date();
      nextFortnight.setDate(now.getDate() + 13);
      cycleEndDate = nextFortnight.toISOString().split('T')[0];
    } else if (activePlacement.payCycle === 'monthly') {
      const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      cycleEndDate = lastDayOfMonth.toISOString().split('T')[0];
    }

    const newSheet: Timesheet = {
      id: `ts-${Date.now()}`,
      placementId: activePlacement.id,
      cycleStartDate,
      cycleEndDate,
      entries: [],
      status: 'draft',
      totalHours: 0,
      subtotalPay: 0,
      subtotalBill: 0,
      payCycle: activePlacement.payCycle
    };
    onSaveTimesheet(newSheet);
  };

  // Manual Modal Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTimesheet || !activePlacement) return;

    let updatedEntries = [...activeTimesheet.entries];
    
    if (editingEntryId) {
      updatedEntries = updatedEntries.map(entry => {
        if (entry.id === editingEntryId) {
          return {
            ...entry,
            date: manualDate,
            startTime: manualStart,
            endTime: manualEnd,
            breakMinutes: Number(manualBreak),
            notes: manualNotes
          };
        }
        return entry;
      });
    } else {
      const newEntry: TimeEntry = {
        id: `te-${Date.now()}`,
        date: manualDate,
        startTime: manualStart,
        endTime: manualEnd,
        breakMinutes: Number(manualBreak),
        notes: manualNotes,
        regularHours: 0,
        overtimeHours: 0,
        doubleTimeHours: 0
      };
      updatedEntries.push(newEntry);
    }

    const updatedTimesheet: Timesheet = {
      ...activeTimesheet,
      entries: updatedEntries
    };

    const recalculated = calculateTimesheetTotals(updatedTimesheet.entries, activePlacement);
    
    onSaveTimesheet({
      ...updatedTimesheet,
      entries: recalculated.entries,
      totalHours: recalculated.totalHours,
      subtotalPay: recalculated.subtotalPay,
      subtotalBill: recalculated.subtotalBill
    });

    setShowManualModal(false);
    setEditingEntryId(null);
    setManualNotes('');
  };

  // Open manual edit modal
  const openEditModal = (entry: TimeEntry) => {
    setEditingEntryId(entry.id);
    setManualDate(entry.date);
    setManualStart(entry.startTime);
    setManualEnd(entry.endTime);
    setManualBreak(entry.breakMinutes);
    setManualNotes(entry.notes);
    setShowManualModal(true);
  };

  // Delete manual entry
  const handleDeleteEntry = (entryId: string) => {
    if (!activeTimesheet || !activePlacement) return;
    if (!confirm('Are you sure you want to delete this time entry?')) return;

    const updatedEntries = activeTimesheet.entries.filter(e => e.id !== entryId);
    const updatedTimesheet: Timesheet = {
      ...activeTimesheet,
      entries: updatedEntries
    };

    const recalculated = calculateTimesheetTotals(updatedTimesheet.entries, activePlacement);
    onSaveTimesheet({
      ...updatedTimesheet,
      entries: recalculated.entries,
      totalHours: recalculated.totalHours,
      subtotalPay: recalculated.subtotalPay,
      subtotalBill: recalculated.subtotalBill
    });
  };

  const resetImportState = () => {
    setImportFileName('');
    setImportRawText('');
    setImportRows([]);
    setImportError('');
    setImportProcessing(false);
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;

    setImportFileName(file.name);
    setImportError('');
    setImportRows([]);
    setImportProcessing(true);

    try {
      let text = '';
      if (file.type.startsWith('image/')) {
        const { recognize } = await import('tesseract.js');
        const result = await recognize(file, 'eng');
        text = result.data.text;
      } else {
        text = await file.text();
      }

      const parsedRows = parseTimesheetText(text);
      setImportRawText(text);
      setImportRows(parsedRows);

      if (parsedRows.length === 0) {
        setImportError('No complete shifts were found. Try a clearer image or paste text with date, start time, and end time.');
      }
    } catch (error) {
      console.error(error);
      setImportError('Could not read this file. Use a clear image, .txt, .csv, or pasted timesheet text.');
    } finally {
      setImportProcessing(false);
    }
  };

  const handleParseImportText = () => {
    const parsedRows = parseTimesheetText(importRawText);
    setImportRows(parsedRows);
    setImportError(parsedRows.length === 0 ? 'No complete shifts were found in the pasted text.' : '');
  };

  const handleApplyImportedRows = () => {
    if (!activeTimesheet || !activePlacement || importRows.length === 0) return;

    const importedEntries: TimeEntry[] = importRows.map((row, index) => ({
      id: `te-import-${Date.now()}-${index}`,
      date: row.date,
      startTime: row.startTime,
      endTime: row.endTime,
      breakMinutes: row.breakMinutes,
      notes: row.workerName
        ? `${row.notes} Source worker: ${row.workerName}.`
        : row.notes,
      regularHours: 0,
      overtimeHours: 0,
      doubleTimeHours: 0
    }));

    const updatedTimesheet: Timesheet = {
      ...activeTimesheet,
      entries: [...activeTimesheet.entries, ...importedEntries]
    };

    const recalculated = calculateTimesheetTotals(updatedTimesheet.entries, activePlacement);
    onSaveTimesheet({
      ...updatedTimesheet,
      entries: recalculated.entries,
      totalHours: recalculated.totalHours,
      subtotalPay: recalculated.subtotalPay,
      subtotalBill: recalculated.subtotalBill
    });

    setShowImportModal(false);
    resetImportState();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Banner and Placement Selector */}
      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem' }}>Worker Portal</h2>
          <p style={{ color: 'var(--text-sub)' }}>Log hours, view payouts, and clock-in with GPS verification.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: 600 }}>Active Job Assignment:</label>
          <select 
            className="form-control" 
            style={{ width: '220px', padding: '8px 12px' }}
            value={selectedPlacementId}
            onChange={(e) => setSelectedPlacementId(e.target.value)}
          >
            {workerPlacements.map(p => {
              const cl = clients.find(c => c.id === p.clientId);
              return (
                <option key={p.id} value={p.id}>
                  {p.roleTitle} @ {cl?.companyName || 'Unknown'}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {activePlacement && client && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', flexWrap: 'wrap' }} className="form-row">
          
          {/* Left Hand Card: Shift Operations (GPS Clock In/Out) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-card gps-clock-card" style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Active Shift Tracker</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', marginBottom: '16px' }}>
                Your current location will be logged for agency and client verification.
              </p>

              {activeTimesheet && isWorkerEditableStatus(activeTimesheet.status) ? (
                <>
                  <div className={`status-ring ${isClockedIn ? 'active' : ''}`}>
                    <div className="pulse-ring"></div>
                    <Clock size={36} style={{ color: isClockedIn ? 'var(--color-success)' : 'var(--text-muted)' }} />
                  </div>

                  {isClockedIn ? (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ fontSize: '1.8rem', fontFamily: 'monospace', margin: '4px 0' }}>{elapsedTime}</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 600 }}>
                        ON THE CLOCK (Started: {clockInTime})
                      </p>
                      {gpsInfo && (
                        <div className="gps-badge">
                          <MapPin size={12} />
                          <span>GPS Active: {gpsInfo.latitude}, {gpsInfo.longitude}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ fontSize: '1rem', color: 'var(--text-muted)', margin: '4px 0' }}>Not Clocked In</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>
                        Select Clock In to start recording shift.
                      </p>
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {isClockedIn ? (
                      <button className="btn btn-danger" onClick={handleClockOut} style={{ width: '100%' }} disabled={gpsLoading}>
                        <Square size={16} fill="white" />
                        {gpsLoading ? 'Retrieving GPS...' : 'Clock Out Shift'}
                      </button>
                    ) : (
                      <button className="btn btn-primary" onClick={handleClockIn} style={{ width: '100%' }} disabled={gpsLoading}>
                        <Play size={16} fill="white" />
                        {gpsLoading ? 'Retrieving GPS...' : 'Clock In Shift'}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div style={{ padding: '20px 0' }}>
                  <AlertTriangle size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-sub)' }}>
                    {activeTimesheet 
                      ? `This timesheet is ${getTimesheetStatusLabel(activeTimesheet.status)} and is locked for worker edits.`
                      : 'Please start a new timesheet period below to begin clocking in.'}
                  </p>
                  {!activeTimesheet && (
                    <button 
                      className="btn btn-primary" 
                      onClick={handleStartNewTimesheet} 
                      style={{ marginTop: '16px', width: '100%' }}
                    >
                      <Plus size={16} /> Start Timesheet Period
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Placement Details Box */}
            <div className="glass-card">
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                Assignment Overview
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-sub)' }}>Role Title:</span>
                  <span style={{ fontWeight: 600 }}>{activePlacement.roleTitle}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-sub)' }}>Business:</span>
                  <span style={{ fontWeight: 600 }}>{client.companyName}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-sub)' }}>Province of Work:</span>
                  <span style={{ fontWeight: 600 }}>{activePlacement.province}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-sub)' }}>Pay Rate:</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>${activePlacement.payRate.toFixed(2)}/hr</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-sub)' }}>Pay Frequency:</span>
                  <span className="badge badge-draft" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    {activePlacement.payCycle}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Hand Card: Current Timesheet Details & Logs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-card">
              
              {/* Timesheet header / selection */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={18} style={{ color: 'var(--primary)' }} />
                    Timesheet Summary
                  </h3>
                  {activeTimesheet && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                      Period: {activeTimesheet.cycleStartDate} to {activeTimesheet.cycleEndDate} ({activeTimesheet.payCycle})
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {activeTimesheet && (
                    <span className={`badge ${getTimesheetStatusClass(activeTimesheet.status)}`}>
                      {getTimesheetStatusLabel(activeTimesheet.status)}
                    </span>
                  )}
                  {activeTimesheet && isWorkerEditableStatus(activeTimesheet.status) && (
                    <>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => {
                          resetImportState();
                          setShowImportModal(true);
                        }}
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        <Upload size={14} /> Import Timesheet
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => {
                          setEditingEntryId(null);
                          setManualDate(new Date().toISOString().split('T')[0]);
                          setManualNotes('');
                          setShowManualModal(true);
                        }}
                        style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                      >
                        <Plus size={14} /> Log Hours
                      </button>
                    </>
                  )}
                </div>
              </div>

              {activeTimesheet ? (
                <div>
                  {activeTimesheet.status === 'rejected' && activeTimesheet.clientFeedback && (
                    <div style={{ background: 'var(--color-error-bg)', border: '1px solid var(--color-error)', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px' }}>
                      <h4 style={{ color: 'var(--color-error)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <AlertTriangle size={14} /> Correction Needed
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>"{activeTimesheet.clientFeedback}"</p>
                    </div>
                  )}

                  {/* Calculations breakdown */}
                  <div className="dashboard-grid" style={{ marginBottom: '24px' }}>
                    <div className="glass-card" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Total Logged Hours</span>
                      <h4 style={{ fontSize: '1.5rem', marginTop: '4px' }}>{activeTimesheet.totalHours} hrs</h4>
                    </div>
                    <div className="glass-card" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Gross Earnings (Est)</span>
                      <h4 style={{ fontSize: '1.5rem', marginTop: '4px', color: 'var(--color-success)' }}>
                        CAD ${activeTimesheet.subtotalPay.toFixed(2)}
                      </h4>
                    </div>
                  </div>

                  {/* List of logged entries */}
                  <h4 style={{ fontSize: '1rem', marginBottom: '12px' }}>Daily Hours Log</h4>
                  {activeTimesheet.entries.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)' }}>
                      No time entries logged for this period yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {activeTimesheet.entries.map((entry) => (
                        <div 
                          key={entry.id} 
                          className="time-row-card"
                          style={{ borderLeft: entry.isClockedIn ? '4px solid var(--color-success)' : '1px solid var(--border-color)' }}
                        >
                          <div className="time-row-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <Calendar size={14} style={{ color: 'var(--primary)' }} />
                              <strong style={{ fontSize: '0.9rem' }}>{entry.date}</strong>
                              {entry.isClockedIn && (
                                <span className="badge badge-approved" style={{ padding: '2px 6px', fontSize: '0.65rem' }}>Active Duty</span>
                              )}
                            </div>
                            
                            {/* Entry Actions */}
                            {(!entry.isClockedIn && isWorkerEditableStatus(activeTimesheet.status)) && (
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button 
                                  onClick={() => openEditModal(entry)} 
                                  style={{ background: 'transparent', border: 'none', color: 'var(--text-sub)', cursor: 'pointer' }}
                                  title="Edit Entry"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteEntry(entry.id)} 
                                  style={{ background: 'transparent', border: 'none', color: 'var(--color-error)', cursor: 'pointer' }}
                                  title="Delete Entry"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px', fontSize: '0.85rem' }}>
                            <div>
                              <span style={{ color: 'var(--text-sub)' }}>Shift: </span>
                              <span>{entry.startTime} - {entry.endTime || 'Active'}</span>
                              {entry.breakMinutes > 0 && (
                                <span style={{ color: 'var(--text-muted)' }}> (Unpaid Break: {entry.breakMinutes}m)</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                              <span>Reg: <strong>{entry.regularHours}h</strong></span>
                              {entry.overtimeHours > 0 && (
                                <span style={{ color: 'var(--color-warning)' }}>OT: <strong>{entry.overtimeHours}h</strong></span>
                              )}
                              {entry.doubleTimeHours > 0 && (
                                <span style={{ color: 'var(--color-error)' }}>DT: <strong>{entry.doubleTimeHours}h</strong></span>
                              )}
                            </div>
                          </div>
                          
                          {entry.notes && (
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-sub)', background: 'rgba(0,0,0,0.1)', padding: '6px 10px', borderRadius: '4px' }}>
                              <strong>Notes:</strong> {entry.notes}
                            </p>
                          )}

                          {/* Show GPS info logs */}
                          {(entry.clockInGPS || entry.clockOutGPS) && (
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                              {entry.clockInGPS && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-info)' }}>
                                  <MapPin size={12} />
                                  <span>Clock In GPS: </span>
                                  <a href={getMapLink(entry.clockInGPS.latitude, entry.clockInGPS.longitude)} target="_blank" rel="noreferrer" style={{ color: 'var(--color-info)', textDecoration: 'underline' }}>
                                    {entry.clockInGPS.latitude.toFixed(4)}, {entry.clockInGPS.longitude.toFixed(4)}
                                  </a>
                                  {entry.clockInGPS.isSimulated && <span style={{ color: 'var(--text-muted)' }}>(Simulated)</span>}
                                </div>
                              )}
                              {entry.clockOutGPS && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-info)' }}>
                                  <MapPin size={12} />
                                  <span>Clock Out GPS: </span>
                                  <a href={getMapLink(entry.clockOutGPS.latitude, entry.clockOutGPS.longitude)} target="_blank" rel="noreferrer" style={{ color: 'var(--color-info)', textDecoration: 'underline' }}>
                                    {entry.clockOutGPS.latitude.toFixed(4)}, {entry.clockOutGPS.longitude.toFixed(4)}
                                  </a>
                                  {entry.clockOutGPS.isSimulated && <span style={{ color: 'var(--text-muted)' }}>(Simulated)</span>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Submission Flow */}
                  {isWorkerEditableStatus(activeTimesheet.status) && (
                    <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn btn-success"
                        disabled={activeTimesheet.entries.length === 0 || isClockedIn}
                        onClick={() => onSubmitTimesheet(activeTimesheet.id)}
                      >
                        <CheckCircle size={16} /> Submit Timesheet to Client
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <AlertTriangle size={32} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
                  <p style={{ color: 'var(--text-sub)', marginBottom: '16px' }}>
                    No timesheet file generated for this job period yet.
                  </p>
                  <button className="btn btn-primary" onClick={handleStartNewTimesheet}>
                    <Plus size={16} /> Generate Timesheet Period
                  </button>
                </div>
              )}
            </div>

            {/* Historical list */}
            {sortedTimesheets.length > 1 && (
              <div className="glass-card">
                <h3 style={{ fontSize: '1.1rem', marginBottom: '12px' }}>Previous Submissions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sortedTimesheets.slice(1).map(ts => (
                    <div 
                      key={ts.id} 
                      onClick={() => setActiveTimesheet(ts)}
                      style={{ 
                        padding: '12px 16px', 
                        border: '1px solid var(--border-color)', 
                        borderRadius: '8px', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        cursor: 'pointer',
                        background: activeTimesheet?.id === ts.id ? 'rgba(255,255,255,0.05)' : 'transparent'
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Period: {ts.cycleStartDate} - {ts.cycleEndDate}</span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '2px' }}>
                          Hours: {ts.totalHours}h | Earnings: CAD ${ts.subtotalPay.toFixed(2)}
                        </div>
                      </div>
                      <span className={`badge ${getTimesheetStatusClass(ts.status)}`}>{getTimesheetStatusLabel(ts.status)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {showManualModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingEntryId ? 'Edit Logged Time' : 'Log Hours Manually'}</h3>
              <button className="close-btn" onClick={() => setShowManualModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleManualSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Shift Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={manualDate} 
                    onChange={e => setManualDate(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Start Time</label>
                    <input 
                      type="time" 
                      className="form-control" 
                      value={manualStart} 
                      onChange={e => setManualStart(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="form-group">
                    <label>End Time</label>
                    <input 
                      type="time" 
                      className="form-control" 
                      value={manualEnd} 
                      onChange={e => setManualEnd(e.target.value)} 
                      required 
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Unpaid Break (Minutes)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={manualBreak} 
                    onChange={e => setManualBreak(Number(e.target.value))} 
                    required 
                    min={0}
                  />
                </div>
                <div className="form-group">
                  <label>Task Details / Notes</label>
                  <textarea 
                    className="form-control" 
                    value={manualNotes} 
                    onChange={e => setManualNotes(e.target.value)} 
                    placeholder="Describe tasks completed during this shift..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowManualModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Entry</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Timesheet Import Modal */}
      {showImportModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '860px' }}>
            <div className="modal-header">
              <h3>Import Timesheet From File</h3>
              <button className="close-btn" onClick={() => setShowImportModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Upload Image, Text, CSV, or TSV</label>
                <input
                  type="file"
                  className="form-control"
                  accept="image/*,.txt,.csv,.tsv,text/plain,text/csv"
                  onChange={e => handleImportFile(e.target.files?.[0] || null)}
                />
                {importFileName && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-sub)', marginTop: '8px' }}>
                    Selected: {importFileName}
                  </p>
                )}
              </div>

              <div className="form-group">
                <label>Extracted / Pasted Timesheet Text</label>
                <textarea
                  className="form-control"
                  value={importRawText}
                  onChange={e => setImportRawText(e.target.value)}
                  placeholder="Paste timesheet text here, or upload a clear photo. Example: Tasal Ashna 2026-07-07 08:00 17:00 break 30"
                  rows={6}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={handleParseImportText} disabled={!importRawText.trim() || importProcessing}>
                  <FileText size={16} /> Extract Fields
                </button>
                {importProcessing && (
                  <span style={{ color: 'var(--color-info)', fontSize: '0.85rem', fontWeight: 600 }}>
                    Reading file and extracting text...
                  </span>
                )}
              </div>

              {importError && (
                <div style={{ background: 'var(--color-warning-bg)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', padding: '12px 14px', marginBottom: '16px', color: 'var(--color-warning)', fontSize: '0.85rem' }}>
                  {importError}
                </div>
              )}

              <h4 style={{ fontSize: '0.95rem', marginBottom: '10px' }}>Detected Shifts</h4>
              {importRows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-muted)' }}>
                  No shifts detected yet.
                </div>
              ) : (
                <div className="table-container" style={{ marginTop: 0 }}>
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Date</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Break</th>
                        <th>Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map(row => (
                        <tr key={row.id}>
                          <td>{row.workerName || 'Not found'}</td>
                          <td>{row.date}</td>
                          <td>{row.startTime}</td>
                          <td>{row.endTime}</td>
                          <td>{row.breakMinutes}m</td>
                          <td>
                            <span className={`badge ${row.confidence === 'high' ? 'badge-approved' : row.confidence === 'medium' ? 'badge-pending' : 'badge-draft'}`}>
                              {row.confidence}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" disabled={importRows.length === 0 || importProcessing} onClick={handleApplyImportedRows}>
                Add {importRows.length || ''} Shift{importRows.length === 1 ? '' : 's'} to Timesheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
