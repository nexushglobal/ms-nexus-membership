export interface MembershipPlanMigrationData {
  id: number;
  name: string;
  price: number;
  checkAmount: number;
  binaryPoints: number;
  commissionPercentage: number;
  directCommissionAmount?: number;
  products: string[];
  benefits: string[];
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MembershipPlanMigrationResult {
  success: boolean;
  message: string;
  details: {
    membershipPlans: {
      total: number;
      created: number;
      skipped: number;
      errors: string[];
    };
  };
}
