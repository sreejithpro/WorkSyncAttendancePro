export type AttendanceType = 'WFO' | 'WFH' | 'LEAVE';

export interface AttendanceLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  date: string; // ISO string (YYYY-MM-DD)
  type: AttendanceType;
  timestamp: any; // Server timestamp
  notes?: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'employee' | 'manager';
  department?: string;
  photoURL?: string;
}

export interface AttendanceSummary {
  WFO: number;
  WFH: number;
  LEAVE: number;
  total: number;
}
