export interface AvailabilityLog {
  changed_at: string;
  changed_by: string;
  old_value: number;
  new_value: number;
}

export interface Blocking {
  id: string;
  variation_id: string;
  availability: number;
  booked_count: number;
  original_availability?: number;
  availability_logs?: AvailabilityLog[];
  status?: number;
  [key: string]: unknown;
}

export interface PackageAvailability {
  id: string;
  package_id: string;
  blockings: Blocking[];
  availability?: number;
  booked_count?: number;
  created_by?: string;
  created_at?: string;
  updated_by?: string;
  updated_at?: string;
}