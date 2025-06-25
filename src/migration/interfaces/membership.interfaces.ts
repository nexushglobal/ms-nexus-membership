export interface MembershipReconsumptionMigrationData {
  id: number;
  amount: number;
  status: 'PENDING' | 'ACTIVE' | 'CANCELLED';
  periodDate: string;
  paymentReference?: string | null;
  paymentDetails?: Record<string, any> | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipHistoryMigrationData {
  id: number;
  action:
    | 'CREATED'
    | 'RENEWED'
    | 'CANCELLED'
    | 'REACTIVATED'
    | 'EXPIRED'
    | 'STATUS_CHANGED'
    | 'PAYMENT_RECEIVED'
    | 'PLAN_CHANGED'
    | 'RECONSUMPTION_ADDED';
  changes?: Record<string, any> | null;
  notes?: string | null;
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface MembershipMigrationData {
  membership_id: number;
  useremail: string;
  plan_id: number;
  plan: string;
  startDate: string;
  endDate?: string | null;
  status: 'PENDING' | 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  minimumReconsumptionAmount: number;
  autoRenewal: boolean;
  createdAt: string;
  updatedAt: string;
  reconsumptions?: MembershipReconsumptionMigrationData[];
  membership_history?: MembershipHistoryMigrationData[];
}

export interface MembershipMigrationResult {
  success: boolean;
  message: string;
  details: {
    memberships: {
      total: number;
      created: number;
      skipped: number;
      errors: string[];
    };
    reconsumptions: {
      total: number;
      created: number;
      skipped: number;
      errors: string[];
    };
    history: {
      total: number;
      created: number;
      skipped: number;
      errors: string[];
    };
  };
}
