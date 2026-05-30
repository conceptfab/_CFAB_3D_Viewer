// Typy z kontraktu platformy (docs/superpowers/plans/2026-05-30-platform-interface-contract.md)

export type Role = 'admin' | 'user';
export type UserStatus = 'allowed' | 'blocked';

export interface User {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
  lastLoginAt: Date | null;
  invitedBy: string | null;
}
