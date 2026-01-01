import type { User } from '@supabase/supabase-js'

export type UserDocData = {
    id: string;
    account_type: 'individual' | 'organization';
};

export type UserState = {
    user: User | null;
    userDocData?: UserDocData | null | undefined;
    profilePictureUrl64: string | null;
    profilePictureUrl128: string | null;
    profilePictureUrl256: string | null;
    profilePictureUrl: string | null; // 256px by default
}