import type { Worker, Client, Placement, Timesheet, User } from './types';

// Mock Users
export const mockUsers: User[] = [
  { id: 'u-1', name: 'Ilyas Jalalzai (Agency Admin)', email: 'admin@apexstaffing.ca', role: 'admin' },
  { id: 'u-2', name: 'Marcus Vance (Toronto Logistics)', email: 'marcus@torontologistics.ca', role: 'client', clientId: 'c-1' },
  { id: 'u-3', name: 'Dr. Sarah Lin (BC Tech Services)', email: 'sarah@bctech.ca', role: 'client', clientId: 'c-2' },
  { id: 'u-4', name: 'Jean-Pierre Martin (Montreal Retail)', email: 'jp@montrealretail.ca', role: 'client', clientId: 'c-3' },
  { id: 'u-5', name: 'Liam Patel', email: 'liam@worker.ca', role: 'worker', workerId: 'w-1' },
  { id: 'u-6', name: 'Sophia Chang', email: 'sophia@worker.ca', role: 'worker', workerId: 'w-2' },
  { id: 'u-7', name: 'Chloe Dubois', email: 'chloe@worker.ca', role: 'worker', workerId: 'w-3' }
];

// Mock Workers
export const mockWorkers: Worker[] = [
  {
    id: 'w-1',
    name: 'Liam Patel',
    email: 'liam@worker.ca',
    phone: '416-555-0192',
    province: 'ON',
    basePayRate: 25.00,
    bankName: 'RBC Royal Bank',
    bankAccount: '****-5678'
  },
  {
    id: 'w-2',
    name: 'Sophia Chang',
    email: 'sophia@worker.ca',
    phone: '604-555-0143',
    province: 'BC',
    basePayRate: 32.50,
    bankName: 'TD Canada Trust',
    bankAccount: '****-1234'
  },
  {
    id: 'w-3',
    name: 'Chloe Dubois',
    email: 'chloe@worker.ca',
    phone: '514-555-0177',
    province: 'QC',
    basePayRate: 28.00,
    bankName: 'National Bank of Canada',
    bankAccount: '****-9900'
  }
];

// Mock Clients
export const mockClients: Client[] = [
  {
    id: 'c-1',
    companyName: 'Toronto Logistical Hub Inc.',
    contactName: 'Marcus Vance',
    contactEmail: 'marcus@torontologistics.ca',
    contactPhone: '905-555-0112',
    province: 'ON',
    taxNumber: 'GST882310492-RT0001',
    baseBillRate: 38.00
  },
  {
    id: 'c-2',
    companyName: 'BC Tech Services Ltd.',
    contactName: 'Dr. Sarah Lin',
    contactEmail: 'sarah@bctech.ca',
    contactPhone: '778-555-0199',
    province: 'BC',
    taxNumber: 'GST710928345-RT0001',
    baseBillRate: 50.00
  },
  {
    id: 'c-3',
    companyName: 'Montreal Retail Group Ltee.',
    contactName: 'Jean-Pierre Martin',
    contactEmail: 'jp@montrealretail.ca',
    contactPhone: '450-555-0105',
    province: 'QC',
    taxNumber: 'GST918273645-RT0001 / QST1234567890-TQ0001',
    baseBillRate: 42.00
  }
];

// Mock Placements
export const mockPlacements: Placement[] = [
  {
    id: 'p-1',
    workerId: 'w-1',
    clientId: 'c-1',
    roleTitle: 'Warehouse Supervisor',
    payRate: 26.50,
    billRate: 40.00,
    startDate: '2026-05-01',
    payCycle: 'weekly',
    province: 'ON'
  },
  {
    id: 'p-2',
    workerId: 'w-2',
    clientId: 'c-2',
    roleTitle: 'Senior Systems Engineer',
    payRate: 35.00,
    billRate: 55.00,
    startDate: '2026-06-15',
    payCycle: 'daily',
    province: 'BC'
  },
  {
    id: 'p-3',
    workerId: 'w-3',
    clientId: 'c-3',
    roleTitle: 'Inventory Lead',
    payRate: 29.00,
    billRate: 44.00,
    startDate: '2026-04-10',
    payCycle: 'biweekly',
    province: 'QC'
  }
];

// Mock GPS Addresses for simulated checking
export const gpsCoordinates = {
  toronto: { lat: 43.6532, lng: -79.3832, address: '100 Queen St W, Toronto, ON' },
  vancouver: { lat: 49.2827, lng: -123.1207, address: '800 Robson St, Vancouver, BC' },
  montreal: { lat: 45.5019, lng: -73.5674, address: '500 Rue Saint-Denis, Montreal, QC' }
};

// Seed Timesheets
export const mockTimesheets: Timesheet[] = [
  // 1. Liam Patel - Weekly Timesheet - Draft/In Progress (Ontario)
  {
    id: 'ts-1',
    placementId: 'p-1',
    cycleStartDate: '2026-07-06',
    cycleEndDate: '2026-07-12',
    payCycle: 'weekly',
    status: 'draft',
    totalHours: 16.5,
    subtotalPay: 437.25,
    subtotalBill: 660.00,
    entries: [
      {
        id: 'te-1-1',
        date: '2026-07-06',
        startTime: '08:00',
        endTime: '17:00',
        breakMinutes: 60,
        notes: 'Supervised morning dispatch and inventory sorting.',
        regularHours: 8.0,
        overtimeHours: 0,
        doubleTimeHours: 0,
        clockInGPS: {
          latitude: 43.6535,
          longitude: -79.3835,
          timestamp: new Date('2026-07-06T08:00:00Z').getTime(),
          accuracy: 8,
          address: '100 Queen St W, Toronto, ON',
          isSimulated: true
        },
        clockOutGPS: {
          latitude: 43.6531,
          longitude: -79.3830,
          timestamp: new Date('2026-07-06T17:00:00Z').getTime(),
          accuracy: 12,
          address: '98 Queen St W, Toronto, ON',
          isSimulated: true
        }
      },
      {
        id: 'te-1-2',
        date: '2026-07-07',
        startTime: '08:30',
        endTime: '17:30',
        breakMinutes: 30,
        notes: 'Coordinated logistics workflow meeting and safety review.',
        regularHours: 8.5,
        overtimeHours: 0,
        doubleTimeHours: 0,
        clockInGPS: {
          latitude: 43.6532,
          longitude: -79.3832,
          timestamp: new Date('2026-07-07T08:30:00Z').getTime(),
          accuracy: 5,
          address: '100 Queen St W, Toronto, ON',
          isSimulated: true
        },
        clockOutGPS: {
          latitude: 43.6533,
          longitude: -79.3833,
          timestamp: new Date('2026-07-07T17:30:00Z').getTime(),
          accuracy: 6,
          address: '100 Queen St W, Toronto, ON',
          isSimulated: true
        }
      }
    ]
  },
  
  // 2. Sophia Chang - Daily Wages Timesheet - Approved (British Columbia)
  {
    id: 'ts-2',
    placementId: 'p-2',
    cycleStartDate: '2026-07-03',
    cycleEndDate: '2026-07-03',
    payCycle: 'daily',
    status: 'approved',
    submittedAt: '2026-07-03T18:30:00Z',
    totalHours: 10.0,
    subtotalPay: 385.00, // 8h * $35 (reg) + 2h * $52.5 (1.5x OT) = $280 + $105 = $385
    subtotalBill: 605.00, // 8h * $55 (reg) + 2h * $82.5 (1.5x OT) = $440 + $165 = $605
    entries: [
      {
        id: 'te-2-1',
        date: '2026-07-03',
        startTime: '08:00',
        endTime: '18:30',
        breakMinutes: 30, // 10.5 hours worked - 0.5h break = 10.0 hours net
        notes: 'Emergency database patching, worked overtime to complete testing.',
        regularHours: 8.0,
        overtimeHours: 2.0,
        doubleTimeHours: 0,
        clockInGPS: {
          latitude: 49.2829,
          longitude: -123.1209,
          timestamp: new Date('2026-07-03T08:00:00Z').getTime(),
          accuracy: 4,
          address: '800 Robson St, Vancouver, BC',
          isSimulated: true
        },
        clockOutGPS: {
          latitude: 49.2826,
          longitude: -123.1205,
          timestamp: new Date('2026-07-03T18:30:00Z').getTime(),
          accuracy: 5,
          address: '802 Robson St, Vancouver, BC',
          isSimulated: true
        }
      }
    ]
  },

  // 3. Chloe Dubois - Bi-weekly Timesheet - Rejected (Quebec)
  {
    id: 'ts-3',
    placementId: 'p-3',
    cycleStartDate: '2026-06-22',
    cycleEndDate: '2026-07-05',
    payCycle: 'biweekly',
    status: 'rejected',
    submittedAt: '2026-07-05T20:00:00Z',
    clientFeedback: 'Total hours for Tuesday June 23 seems wrong. Roster records show you left at 14:00 (1h early). Please correct.',
    totalHours: 78.5,
    subtotalPay: 2276.50, // 78.5 * $29
    subtotalBill: 3454.00, // 78.5 * $44
    entries: [
      {
        id: 'te-3-1',
        date: '2026-06-22',
        startTime: '09:00',
        endTime: '17:00',
        breakMinutes: 30,
        notes: 'Warehouse organization and inventory scan onboarding.',
        regularHours: 7.5,
        overtimeHours: 0,
        doubleTimeHours: 0,
        clockInGPS: {
          latitude: 45.5020,
          longitude: -73.5670,
          timestamp: new Date('2026-06-22T09:00:00Z').getTime(),
          address: '500 Rue Saint-Denis, Montreal, QC',
          isSimulated: true
        },
        clockOutGPS: {
          latitude: 45.5018,
          longitude: -73.5678,
          timestamp: new Date('2026-06-22T17:00:00Z').getTime(),
          address: '500 Rue Saint-Denis, Montreal, QC',
          isSimulated: true
        }
      },
      {
        id: 'te-3-2',
        date: '2026-06-23',
        startTime: '09:00',
        endTime: '17:00', // Client says she left at 16:00
        breakMinutes: 30,
        notes: 'Staged shipments for Quebec city branch.',
        regularHours: 7.5,
        overtimeHours: 0,
        doubleTimeHours: 0,
        clockInGPS: {
          latitude: 45.5022,
          longitude: -73.5671,
          timestamp: new Date('2026-06-23T09:00:00Z').getTime(),
          address: '500 Rue Saint-Denis, Montreal, QC',
          isSimulated: true
        },
        clockOutGPS: {
          latitude: 45.5015,
          longitude: -73.5670,
          timestamp: new Date('2026-06-23T17:00:00Z').getTime(),
          address: '500 Rue Saint-Denis, Montreal, QC',
          isSimulated: true
        }
      },
      // Rest of the 9 days (simulated with 7.0-8.0h entries to reach 78.5 hours total)
      ...Array.from({ length: 8 }).map((_, idx) => {
        const day = 24 + idx;
        const dateStr = `2026-06-${day}`;
        return {
          id: `te-3-other-${idx}`,
          date: dateStr,
          startTime: '08:30',
          endTime: '17:00',
          breakMinutes: 45, // 7.75h worked
          notes: `Regular warehouse lead support duties - Logged day ${idx + 3}`,
          regularHours: 7.75,
          overtimeHours: 0,
          doubleTimeHours: 0,
          clockInGPS: {
            latitude: 45.5019 + (Math.random() - 0.5) * 0.001,
            longitude: -73.5674 + (Math.random() - 0.5) * 0.001,
            timestamp: new Date(`${dateStr}T08:30:00Z`).getTime(),
            address: '500 Rue Saint-Denis, Montreal, QC',
            isSimulated: true
          },
          clockOutGPS: {
            latitude: 45.5019 + (Math.random() - 0.5) * 0.001,
            longitude: -73.5674 + (Math.random() - 0.5) * 0.001,
            timestamp: new Date(`${dateStr}T17:00:00Z`).getTime(),
            address: '500 Rue Saint-Denis, Montreal, QC',
            isSimulated: true
          }
        };
      }),
      {
        id: 'te-3-11',
        date: '2026-07-03',
        startTime: '09:00',
        endTime: '15:30',
        breakMinutes: 30, // 6h worked
        notes: 'Pre-weekend inventory closing report.',
        regularHours: 6.0,
        overtimeHours: 0,
        doubleTimeHours: 0,
        clockInGPS: {
          latitude: 45.5019,
          longitude: -73.5674,
          timestamp: new Date('2026-07-03T09:00:00Z').getTime(),
          address: '500 Rue Saint-Denis, Montreal, QC',
          isSimulated: true
        },
        clockOutGPS: {
          latitude: 45.5019,
          longitude: -73.5674,
          timestamp: new Date('2026-07-03T15:30:00Z').getTime(),
          address: '500 Rue Saint-Denis, Montreal, QC',
          isSimulated: true
        }
      }
    ]
  }
];
