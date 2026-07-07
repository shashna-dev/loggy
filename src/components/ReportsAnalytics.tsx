import React, { useMemo, useState } from 'react';
import type { Client, Invoice, Placement, Timesheet, Worker } from '../types';

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

interface ReportsAnalyticsProps {
  workers: Worker[];
  clients: Client[];
  placements: Placement[];
  timesheets: Timesheet[];
  invoices: Invoice[];
}

interface ReportRange {
  startDate: string;
  endDate: string;
}

const currency = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD'
});

function toDateInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getPresetRange(period: ReportPeriod): ReportRange {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  if (period === 'daily') {
    return { startDate: toDateInput(start), endDate: toDateInput(end) };
  }

  if (period === 'weekly') {
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    end.setTime(start.getTime());
    end.setDate(start.getDate() + 6);
    return { startDate: toDateInput(start), endDate: toDateInput(end) };
  }

  if (period === 'monthly') {
    start.setDate(1);
    end.setFullYear(start.getFullYear(), start.getMonth() + 1, 0);
    return { startDate: toDateInput(start), endDate: toDateInput(end) };
  }

  if (period === 'quarterly') {
    const quarterStartMonth = Math.floor(start.getMonth() / 3) * 3;
    start.setMonth(quarterStartMonth, 1);
    end.setFullYear(start.getFullYear(), quarterStartMonth + 3, 0);
    return { startDate: toDateInput(start), endDate: toDateInput(end) };
  }

  start.setMonth(0, 1);
  end.setMonth(11, 31);
  return { startDate: toDateInput(start), endDate: toDateInput(end) };
}

function overlapsRange(startDate: string, endDate: string, range: ReportRange): boolean {
  return startDate <= range.endDate && endDate >= range.startDate;
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escapeCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
  const csv = [
    headers.join(','),
    ...rows.map(row => headers.map(header => escapeCell(row[header])).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const ReportsAnalytics: React.FC<ReportsAnalyticsProps> = ({
  workers,
  clients,
  placements,
  timesheets,
  invoices
}) => {
  const defaultRange = getPresetRange('monthly');
  const [period, setPeriod] = useState<ReportPeriod>('monthly');
  const [startDate, setStartDate] = useState(defaultRange.startDate);
  const [endDate, setEndDate] = useState(defaultRange.endDate);
  const [clientId, setClientId] = useState('all');

  const range = { startDate, endDate };

  const handlePeriodChange = (nextPeriod: ReportPeriod) => {
    setPeriod(nextPeriod);
    if (nextPeriod !== 'custom') {
      const nextRange = getPresetRange(nextPeriod);
      setStartDate(nextRange.startDate);
      setEndDate(nextRange.endDate);
    }
  };

  const report = useMemo(() => {
    const placementById = new Map(placements.map(placement => [placement.id, placement]));
    const workerById = new Map(workers.map(worker => [worker.id, worker]));
    const clientById = new Map(clients.map(client => [client.id, client]));

    const filteredTimesheets = timesheets.filter(timesheet => {
      const placement = placementById.get(timesheet.placementId);
      if (!placement) return false;
      if (clientId !== 'all' && placement.clientId !== clientId) return false;
      return overlapsRange(timesheet.cycleStartDate, timesheet.cycleEndDate, range);
    });

    const filteredInvoices = invoices.filter(invoice => {
      if (clientId !== 'all' && invoice.clientId !== clientId) return false;
      return overlapsRange(invoice.periodStartDate, invoice.periodEndDate, range);
    });

    const approvedTimesheets = filteredTimesheets.filter(timesheet => timesheet.status === 'approved');
    const pendingTimesheets = filteredTimesheets.filter(timesheet => timesheet.status === 'pending_approval');
    const allRevenue = filteredTimesheets.reduce((sum, timesheet) => sum + timesheet.subtotalBill, 0);
    const approvedRevenue = approvedTimesheets.reduce((sum, timesheet) => sum + timesheet.subtotalBill, 0);
    const payroll = filteredTimesheets.reduce((sum, timesheet) => sum + timesheet.subtotalPay, 0);
    const hours = filteredTimesheets.reduce((sum, timesheet) => sum + timesheet.totalHours, 0);
    const overtimeHours = filteredTimesheets.reduce((sum, timesheet) => (
      sum + timesheet.entries.reduce((entrySum, entry) => entrySum + entry.overtimeHours + entry.doubleTimeHours, 0)
    ), 0);

    const clientRows = clients
      .filter(client => clientId === 'all' || client.id === clientId)
      .map(client => {
        const clientPlacements = placements.filter(placement => placement.clientId === client.id);
        const placementIds = new Set(clientPlacements.map(placement => placement.id));
        const clientTimesheets = filteredTimesheets.filter(timesheet => placementIds.has(timesheet.placementId));
        const revenue = clientTimesheets.reduce((sum, timesheet) => sum + timesheet.subtotalBill, 0);
        const clientPayroll = clientTimesheets.reduce((sum, timesheet) => sum + timesheet.subtotalPay, 0);
        return {
          clientId: client.id,
          client: client.companyName,
          province: client.province,
          workers: new Set(clientPlacements.map(placement => placement.workerId)).size,
          timesheets: clientTimesheets.length,
          hours: clientTimesheets.reduce((sum, timesheet) => sum + timesheet.totalHours, 0),
          revenue,
          payroll: clientPayroll,
          margin: revenue - clientPayroll
        };
      })
      .filter(row => row.timesheets > 0 || row.workers > 0);

    const workerRows = workers.map(worker => {
      const workerPlacements = placements.filter(placement => placement.workerId === worker.id);
      const placementIds = new Set(workerPlacements.map(placement => placement.id));
      const workerTimesheets = filteredTimesheets.filter(timesheet => placementIds.has(timesheet.placementId));
      const workerPayroll = workerTimesheets.reduce((sum, timesheet) => sum + timesheet.subtotalPay, 0);
      return {
        workerId: worker.id,
        worker: worker.name,
        province: worker.province,
        clients: new Set(workerPlacements.map(placement => placement.clientId)).size,
        timesheets: workerTimesheets.length,
        hours: workerTimesheets.reduce((sum, timesheet) => sum + timesheet.totalHours, 0),
        overtime: workerTimesheets.reduce((sum, timesheet) => (
          sum + timesheet.entries.reduce((entrySum, entry) => entrySum + entry.overtimeHours + entry.doubleTimeHours, 0)
        ), 0),
        payroll: workerPayroll
      };
    }).filter(row => row.timesheets > 0 || row.clients > 0);

    const payrollRows = filteredTimesheets.map(timesheet => {
      const placement = placementById.get(timesheet.placementId);
      const worker = placement ? workerById.get(placement.workerId) : undefined;
      const client = placement ? clientById.get(placement.clientId) : undefined;
      return {
        timesheetId: timesheet.id,
        worker: worker?.name || 'Unknown worker',
        client: client?.companyName || 'Unknown client',
        payCycle: timesheet.payCycle,
        status: timesheet.status,
        period: `${timesheet.cycleStartDate} to ${timesheet.cycleEndDate}`,
        hours: timesheet.totalHours,
        regular: timesheet.entries.reduce((sum, entry) => sum + entry.regularHours, 0),
        overtime: timesheet.entries.reduce((sum, entry) => sum + entry.overtimeHours, 0),
        doubleTime: timesheet.entries.reduce((sum, entry) => sum + entry.doubleTimeHours, 0),
        payroll: timesheet.subtotalPay,
        billable: timesheet.subtotalBill
      };
    });

    const invoiceRows = filteredInvoices.map(invoice => {
      const client = clientById.get(invoice.clientId);
      return {
        invoiceId: invoice.id,
        client: client?.companyName || 'Unknown client',
        status: invoice.status,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        period: `${invoice.periodStartDate} to ${invoice.periodEndDate}`,
        subtotal: invoice.subtotal,
        gstHst: invoice.gstHstAmount,
        qst: invoice.qstAmount || 0,
        total: invoice.total
      };
    });

    return {
      filteredTimesheets,
      filteredInvoices,
      pendingTimesheets,
      metrics: {
        hours,
        overtimeHours,
        allRevenue,
        approvedRevenue,
        payroll,
        margin: allRevenue - payroll,
        pendingBilling: pendingTimesheets.reduce((sum, timesheet) => sum + timesheet.subtotalBill, 0),
        invoiced: filteredInvoices.reduce((sum, invoice) => sum + invoice.total, 0),
        outstanding: filteredInvoices.filter(invoice => invoice.status === 'pending').reduce((sum, invoice) => sum + invoice.total, 0),
        gstHst: filteredInvoices.reduce((sum, invoice) => sum + invoice.gstHstAmount, 0),
        qst: filteredInvoices.reduce((sum, invoice) => sum + (invoice.qstAmount || 0), 0)
      },
      clientRows,
      workerRows,
      payrollRows,
      invoiceRows
    };
  }, [workers, clients, placements, timesheets, invoices, clientId, startDate, endDate]);

  const selectedClient = clientId === 'all' ? 'All clients' : clients.find(client => client.id === clientId)?.companyName || 'Selected client';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '18px' }}>
          <div>
            <h3 style={{ fontSize: '1.3rem' }}>Reports & Analytics</h3>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.9rem' }}>
              Agency-wide historical reporting for {selectedClient}, filtered from {startDate} to {endDate}.
            </p>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => downloadCsv(`loggy-summary-${startDate}-${endDate}.csv`, report.clientRows)}
            disabled={report.clientRows.length === 0}
          >
            Export Client Summary
          </button>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Reporting Period</label>
            <select className="form-control" value={period} onChange={event => handlePeriodChange(event.target.value as ReportPeriod)}>
              <option value="daily">Today</option>
              <option value="weekly">This Week</option>
              <option value="monthly">This Month</option>
              <option value="quarterly">This Quarter</option>
              <option value="yearly">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          <div className="form-group">
            <label>Client</label>
            <select className="form-control" value={clientId} onChange={event => setClientId(event.target.value)}>
              <option value="all">All Clients</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>{client.companyName}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Start Date</label>
            <input className="form-control" type="date" value={startDate} onChange={event => {
              setPeriod('custom');
              setStartDate(event.target.value);
            }} />
          </div>
          <div className="form-group">
            <label>End Date</label>
            <input className="form-control" type="date" value={endDate} onChange={event => {
              setPeriod('custom');
              setEndDate(event.target.value);
            }} />
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="glass-card metric-card">
          <div className="metric-header"><span>Total Hours</span></div>
          <div className="metric-value">{report.metrics.hours.toFixed(1)}</div>
          <p className="metric-subtext">{report.metrics.overtimeHours.toFixed(1)} overtime / double-time hours</p>
        </div>
        <div className="glass-card metric-card">
          <div className="metric-header"><span>Billable Revenue</span></div>
          <div className="metric-value">{currency.format(report.metrics.allRevenue)}</div>
          <p className="metric-subtext">{currency.format(report.metrics.approvedRevenue)} approved</p>
        </div>
        <div className="glass-card metric-card">
          <div className="metric-header"><span>Payroll Liability</span></div>
          <div className="metric-value">{currency.format(report.metrics.payroll)}</div>
          <p className="metric-subtext">{currency.format(report.metrics.margin)} gross margin</p>
        </div>
        <div className="glass-card metric-card">
          <div className="metric-header"><span>Outstanding Invoices</span></div>
          <div className="metric-value">{currency.format(report.metrics.outstanding)}</div>
          <p className="metric-subtext">{currency.format(report.metrics.invoiced)} total invoiced</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }} className="form-row">
        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '14px' }}>Client Performance</h3>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Hours</th>
                  <th>Revenue</th>
                  <th>Margin</th>
                </tr>
              </thead>
              <tbody>
                {report.clientRows.map(row => (
                  <tr key={row.clientId}>
                    <td>
                      <strong>{row.client}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{row.workers} workers | {row.timesheets} timesheets</div>
                    </td>
                    <td>{row.hours.toFixed(1)}</td>
                    <td>{currency.format(row.revenue)}</td>
                    <td>{currency.format(row.margin)}</td>
                  </tr>
                ))}
                {report.clientRows.length === 0 && (
                  <tr><td colSpan={4} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No client activity in this range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '14px' }}>Worker Productivity</h3>
          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Hours</th>
                  <th>OT/DT</th>
                  <th>Payroll</th>
                </tr>
              </thead>
              <tbody>
                {report.workerRows.map(row => (
                  <tr key={row.workerId}>
                    <td>
                      <strong>{row.worker}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{row.province} | {row.timesheets} timesheets</div>
                    </td>
                    <td>{row.hours.toFixed(1)}</td>
                    <td>{row.overtime.toFixed(1)}</td>
                    <td>{currency.format(row.payroll)}</td>
                  </tr>
                ))}
                {report.workerRows.length === 0 && (
                  <tr><td colSpan={4} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No worker activity in this range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '1.1rem' }}>Payroll & Timesheet Detail</h3>
          <button
            className="btn btn-secondary"
            onClick={() => downloadCsv(`loggy-payroll-${startDate}-${endDate}.csv`, report.payrollRows)}
            disabled={report.payrollRows.length === 0}
          >
            Export Payroll CSV
          </button>
        </div>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Worker / Client</th>
                <th>Period</th>
                <th>Status</th>
                <th>Hours</th>
                <th>Payroll</th>
                <th>Billable</th>
              </tr>
            </thead>
            <tbody>
              {report.payrollRows.map(row => (
                <tr key={row.timesheetId}>
                  <td>
                    <strong>{row.worker}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>{row.client} | {row.payCycle}</div>
                  </td>
                  <td>{row.period}</td>
                  <td><span className={`badge badge-${row.status}`}>{row.status}</span></td>
                  <td>
                    {row.hours.toFixed(1)}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Reg {row.regular.toFixed(1)} | OT {row.overtime.toFixed(1)} | DT {row.doubleTime.toFixed(1)}</div>
                  </td>
                  <td>{currency.format(row.payroll)}</td>
                  <td>{currency.format(row.billable)}</td>
                </tr>
              ))}
              {report.payrollRows.length === 0 && (
                <tr><td colSpan={6} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No timesheets in this range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem' }}>Billing, Tax & Aging</h3>
            <p style={{ color: 'var(--text-sub)', fontSize: '0.82rem' }}>
              GST/HST: {currency.format(report.metrics.gstHst)} | QST: {currency.format(report.metrics.qst)} | Pending approval billing: {currency.format(report.metrics.pendingBilling)}
            </p>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => downloadCsv(`loggy-invoices-${startDate}-${endDate}.csv`, report.invoiceRows)}
            disabled={report.invoiceRows.length === 0}
          >
            Export Invoice CSV
          </button>
        </div>
        <div className="table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Client</th>
                <th>Period</th>
                <th>Taxes</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {report.invoiceRows.map(row => (
                <tr key={row.invoiceId}>
                  <td>
                    <strong>{row.invoiceId}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)' }}>Due {row.dueDate}</div>
                  </td>
                  <td>{row.client}</td>
                  <td>{row.period}</td>
                  <td>{currency.format(row.gstHst + row.qst)}</td>
                  <td>{currency.format(row.total)}</td>
                  <td><span className={`badge ${row.status === 'paid' ? 'badge-approved' : 'badge-pending'}`}>{row.status}</span></td>
                </tr>
              ))}
              {report.invoiceRows.length === 0 && (
                <tr><td colSpan={6} style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No invoices in this range.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
