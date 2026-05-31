// Re-export shared platform types from canonical location.
// This file exists so code that imports from '@/lib/auth/types' works
// alongside code that imports from '@/lib/types'.
export type { User, Role, UserStatus } from '@/lib/types';
