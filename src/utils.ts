import type { GPSLocation, TimeEntry, Placement, CanadianProvince, TimesheetStatus } from './types';

export const timesheetStatusLabels: Record<TimesheetStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  client_approved: 'Client Approved',
  agency_approved: 'Agency Approved',
  invoiced: 'Invoiced',
  paid: 'Paid',
  payroll_closed: 'Payroll Closed',
  rejected: 'Rejected'
};

export const timesheetStatusClasses: Record<TimesheetStatus, string> = {
  draft: 'badge-draft',
  submitted: 'badge-submitted',
  client_approved: 'badge-client-approved',
  agency_approved: 'badge-agency-approved',
  invoiced: 'badge-invoiced',
  paid: 'badge-paid',
  payroll_closed: 'badge-payroll-closed',
  rejected: 'badge-rejected'
};

export function getTimesheetStatusLabel(status: TimesheetStatus): string {
  return timesheetStatusLabels[status];
}

export function getTimesheetStatusClass(status: TimesheetStatus): string {
  return timesheetStatusClasses[status];
}

export function isWorkerEditableStatus(status: TimesheetStatus): boolean {
  return status === 'draft' || status === 'rejected';
}

export function isSubmittedForClientStatus(status: TimesheetStatus): boolean {
  return status === 'submitted';
}

export function isAgencyApprovalStatus(status: TimesheetStatus): boolean {
  return status === 'client_approved';
}

export function isReadyToInvoiceStatus(status: TimesheetStatus): boolean {
  return status === 'agency_approved';
}

export function isRevenueRecognizedStatus(status: TimesheetStatus): boolean {
  return ['agency_approved', 'invoiced', 'paid', 'payroll_closed'].includes(status);
}

// Convert "08:30" to 510 minutes
export function timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

// Convert 510 minutes to "08:30"
export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// Get provincial overtime thresholds
export function getOvertimeRules(province: CanadianProvince) {
  switch (province) {
    case 'ON':
      return { weeklyLimit: 44, dailyLimit: 0, hasDoubleTime: false };
    case 'BC':
      return { weeklyLimit: 40, dailyLimit: 8, doubleTimeLimit: 12, hasDoubleTime: true };
    case 'AB':
      return { weeklyLimit: 44, dailyLimit: 8, hasDoubleTime: false };
    case 'QC':
      return { weeklyLimit: 40, dailyLimit: 0, hasDoubleTime: false };
    default:
      return { weeklyLimit: 40, dailyLimit: 0, hasDoubleTime: false };
  }
}

// Get provincial tax details
export interface TaxDetails {
  gstHstRate: number; // 0.05, 0.13, etc.
  qstRate?: number; // Quebec Sales Tax
  label: string;
}

export function getProvinceTax(province: CanadianProvince): TaxDetails {
  switch (province) {
    case 'ON':
      return { gstHstRate: 0.13, label: '13% HST' };
    case 'BC':
      return { gstHstRate: 0.05, label: '5% GST' };
    case 'QC':
      return { gstHstRate: 0.05, qstRate: 0.09975, label: '5% GST + 9.975% QST' };
    case 'AB':
      return { gstHstRate: 0.05, label: '5% GST' };
    default:
      return { gstHstRate: 0.05, label: '5% GST' };
  }
}

// Recalculate time entry hours (regular, overtime, double-time) based on daily rules
export function calculateEntryHours(
  entry: Omit<TimeEntry, 'regularHours' | 'overtimeHours' | 'doubleTimeHours'>,
  province: CanadianProvince
): { regularHours: number; overtimeHours: number; doubleTimeHours: number; totalHours: number } {
  const start = timeToMinutes(entry.startTime);
  let end = timeToMinutes(entry.endTime);
  
  // Handle overnight shifts
  if (end < start) {
    end += 24 * 60;
  }
  
  const totalMins = Math.max(0, end - start - entry.breakMinutes);
  const totalHours = Math.round((totalMins / 60) * 100) / 100;
  
  const rules = getOvertimeRules(province);
  
  let regularHours = totalHours;
  let overtimeHours = 0;
  let doubleTimeHours = 0;
  
  // Calculate daily overtime/double-time (BC / Alberta)
  if (rules.dailyLimit > 0) {
    if (rules.hasDoubleTime && rules.doubleTimeLimit && totalHours > rules.doubleTimeLimit) {
      doubleTimeHours = totalHours - rules.doubleTimeLimit;
      overtimeHours = rules.doubleTimeLimit - rules.dailyLimit;
      regularHours = rules.dailyLimit;
    } else if (totalHours > rules.dailyLimit) {
      overtimeHours = totalHours - rules.dailyLimit;
      regularHours = rules.dailyLimit;
    }
  }
  
  return {
    regularHours: Math.round(regularHours * 100) / 100,
    overtimeHours: Math.round(overtimeHours * 100) / 100,
    doubleTimeHours: Math.round(doubleTimeHours * 100) / 100,
    totalHours
  };
}

// Recalculate an entire timesheet's hours, subtotal billing, and subtotal pay
export function calculateTimesheetTotals(
  entries: TimeEntry[],
  placement: Placement
): { totalHours: number; subtotalPay: number; subtotalBill: number; entries: TimeEntry[] } {
  const province = placement.province;
  const rules = getOvertimeRules(province);
  
  // 1. Calculate daily hours for each entry first
  let processedEntries = entries.map(entry => {
    const hours = calculateEntryHours(entry, province);
    return {
      ...entry,
      regularHours: hours.regularHours,
      overtimeHours: hours.overtimeHours,
      doubleTimeHours: hours.doubleTimeHours
    };
  });
  
  // 2. Apply weekly/cycle cumulative overtime rules if applicable
  // If the placement is daily, no weekly accumulation is computed.
  if (placement.payCycle !== 'daily') {
    let cycleLimit = rules.weeklyLimit;
    if (placement.payCycle === 'biweekly') {
      cycleLimit = rules.weeklyLimit * 2;
    } else if (placement.payCycle === 'monthly') {
      cycleLimit = 160; // 160h standard threshold for monthly
    }
    
    let cumulativeRegular = 0;
    processedEntries = processedEntries.map(entry => {
      // If daily overtime was already applied, only count regular hours towards cycle limit
      let regContribution = entry.regularHours;
      let newOvertime = entry.overtimeHours;
      let newRegular = entry.regularHours;
      
      if (cumulativeRegular + regContribution > cycleLimit) {
        // We crossed the cycle limit!
        const remainingRegSpace = Math.max(0, cycleLimit - cumulativeRegular);
        newRegular = remainingRegSpace;
        newOvertime = entry.overtimeHours + (regContribution - remainingRegSpace);
        cumulativeRegular = cycleLimit;
      } else {
        cumulativeRegular += regContribution;
      }
      
      return {
        ...entry,
        regularHours: Math.round(newRegular * 100) / 100,
        overtimeHours: Math.round(newOvertime * 100) / 100
      };
    });
  }
  
  // 3. Compute billing and payroll amounts
  let totalHours = 0;
  let subtotalPay = 0;
  let subtotalBill = 0;
  
  processedEntries.forEach(entry => {
    const t = entry.regularHours + entry.overtimeHours + entry.doubleTimeHours;
    totalHours += t;
    
    // Worker Pay Rates
    const payReg = entry.regularHours * placement.payRate;
    const payOt = entry.overtimeHours * placement.payRate * 1.5;
    const payDt = entry.doubleTimeHours * placement.payRate * 2.0;
    subtotalPay += (payReg + payOt + payDt);
    
    // Client Bill Rates
    const billReg = entry.regularHours * placement.billRate;
    const billOt = entry.overtimeHours * placement.billRate * 1.5;
    const billDt = entry.doubleTimeHours * placement.billRate * 2.0;
    subtotalBill += (billReg + billOt + billDt);
  });
  
  return {
    totalHours: Math.round(totalHours * 100) / 100,
    subtotalPay: Math.round(subtotalPay * 100) / 100,
    subtotalBill: Math.round(subtotalBill * 100) / 100,
    entries: processedEntries
  };
}

// Generate Google Maps link from GPS Coordinates
export function getMapLink(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export type GpsVerificationStatus = 'verified' | 'warning' | 'missing';

export interface GpsVerificationResult {
  status: GpsVerificationStatus;
  label: string;
  distanceMeters?: number;
}

const expectedJobSites: Record<CanadianProvince, { latitude: number; longitude: number; label: string }> = {
  ON: { latitude: 43.6532, longitude: -79.3832, label: 'Toronto job site' },
  BC: { latitude: 49.2827, longitude: -123.1207, label: 'Vancouver job site' },
  QC: { latitude: 45.5019, longitude: -73.5674, label: 'Montreal job site' },
  AB: { latitude: 51.0447, longitude: -114.0719, label: 'Alberta job site' },
  OTHER: { latitude: 43.6532, longitude: -79.3832, label: 'Default Canadian job site' }
};

export function calculateDistanceMeters(
  first: Pick<GPSLocation, 'latitude' | 'longitude'>,
  second: Pick<GPSLocation, 'latitude' | 'longitude'>
): number {
  const earthRadiusMeters = 6371000;
  const toRadians = (degrees: number) => degrees * (Math.PI / 180);
  const lat1 = toRadians(first.latitude);
  const lat2 = toRadians(second.latitude);
  const deltaLat = toRadians(second.latitude - first.latitude);
  const deltaLon = toRadians(second.longitude - first.longitude);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function evaluateGpsLocation(
  gps: GPSLocation | undefined,
  province: CanadianProvince,
  thresholdMeters = 250
): GpsVerificationResult {
  if (!gps) {
    return { status: 'missing', label: 'No GPS captured' };
  }

  const expected = expectedJobSites[province];
  const distanceMeters = Math.round(calculateDistanceMeters(gps, expected));
  if (distanceMeters <= thresholdMeters) {
    return {
      status: 'verified',
      label: `Within ${thresholdMeters}m of ${expected.label}`,
      distanceMeters
    };
  }

  return {
    status: 'warning',
    label: `Review: ${distanceMeters}m from ${expected.label}`,
    distanceMeters
  };
}

export function evaluateEntryGps(
  entry: TimeEntry,
  placement: Placement,
  thresholdMeters = 250
): GpsVerificationResult {
  const checks = [
    evaluateGpsLocation(entry.clockInGPS, placement.province, thresholdMeters),
    evaluateGpsLocation(entry.clockOutGPS, placement.province, thresholdMeters)
  ];

  if (checks.some(check => check.status === 'warning')) {
    const farthest = Math.max(...checks.map(check => check.distanceMeters || 0));
    return {
      status: 'warning',
      label: `Review GPS location (${farthest}m max drift)`,
      distanceMeters: farthest
    };
  }

  if (checks.some(check => check.status === 'verified')) {
    const farthest = Math.max(...checks.map(check => check.distanceMeters || 0));
    return {
      status: 'verified',
      label: `GPS verified (${farthest}m max drift)`,
      distanceMeters: farthest
    };
  }

  return { status: 'missing', label: 'No GPS captured' };
}
