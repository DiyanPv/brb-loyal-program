export interface Customer {
  Id: string;
  FullName: string;
  Phone: string;
  Email?: string;
  Username?: string;
  Password?: string;
  CurrentStamps: number;
  TotalVisits: number;
  HasRewardAvailable: boolean;
  AuthToken: string;
  LastVisitAt: string | null;
  CreatedAt: string;
}

export interface ShopSettings {
  Id: string;
  RequiredStamps: number;
  DiscountText: string;
  CooldownHours: number;
  AdminPin: string;
  UpdatedAt?: string;
}

export interface VisitLog {
  Id: string;
  CustomerId: string;
  ActionType: 'StampAdded' | 'RewardRedeemed';
  CreatedAt: string;
}

export interface StampResult {
  success: boolean;
  message: string;
  customer?: Customer;
  cooldownTriggered?: boolean;
  hoursSinceLastVisit?: number;
  rewardUnlocked?: boolean;
}
