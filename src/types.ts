export type UserRole = 'admin' | 'client' | 'worker';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  clientId?: string; // If role is client
  workerId?: string; // If role is worker
}

export type CanadianProvince = 'ON' | 'BC' | 'QC' | 'AB' | 'OTHER';

export type PayCycle = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface GPSLocation {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  address?: string;
  isSimulated?: boolean;
}

export interface Worker {
  id: string;
  name: string;
  email: string;
  phone: string;
  province: CanadianProvince;
  basePayRate: number;
  bankName: string;
  bankAccount: string; // Mocked
}

export interface Client {
  id: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  province: CanadianProvince;
  taxNumber: string; // GST/HST/QST registration number
  baseBillRate: number;
}

export interface Placement {
  id: string;
  workerId: string;
  clientId: string;
  roleTitle: string;
  payRate: number; // Hourly rate paid to worker
  billRate: number; // Hourly rate billed to client
  startDate: string;
  endDate?: string;
  payCycle: PayCycle;
  province: CanadianProvince; // Province of work (usually same as client)
}

export interface TimeEntry {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  breakMinutes: number;
  notes: string;
  regularHours: number;
  overtimeHours: number;
  doubleTimeHours: number;
  clockInGPS?: GPSLocation;
  clockOutGPS?: GPSLocation;
  isClockedIn?: boolean; // active logging state helper
}

export type TimesheetStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected';

export interface Timesheet {
  id: string;
  placementId: string;
  cycleStartDate: string; // YYYY-MM-DD
  cycleEndDate: string; // YYYY-MM-DD
  entries: TimeEntry[];
  status: TimesheetStatus;
  submittedAt?: string;
  clientFeedback?: string;
  agencyNotes?: string;
  totalHours: number;
  subtotalBill: number;
  subtotalPay: number;
  payCycle: PayCycle;
}

export type InvoiceStatus = 'pending' | 'paid';

export interface Invoice {
  id: string;
  clientId: string;
  invoiceDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  periodStartDate: string; // YYYY-MM-DD
  periodEndDate: string; // YYYY-MM-DD
  timesheetIds: string[];
  subtotal: number;
  gstHstRate: number; // HST or GST rate
  gstHstAmount: number;
  qstRate?: number; // Quebec Sales Tax if QC
  qstAmount?: number;
  total: number;
  status: InvoiceStatus;
}
