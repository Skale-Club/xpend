import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: {
          id: string;
          name: string;
          type: 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'OTHER';
          bank: string | null;
          color: string;
          icon: string | null;
          initial_balance: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          type: 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'OTHER';
          bank?: string | null;
          color?: string;
          icon?: string | null;
          initial_balance?: number;
          is_active?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          type?: 'CHECKING' | 'SAVINGS' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CASH' | 'OTHER';
          bank?: string | null;
          color?: string;
          icon?: string | null;
          initial_balance?: number;
          is_active?: boolean;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          color: string;
          icon: string | null;
          parent_id: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string;
          icon?: string | null;
          parent_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string;
          icon?: string | null;
          parent_id?: string | null;
        };
      };
      statements: {
        Row: {
          id: string;
          account_id: string;
          month: number;
          year: number;
          file_name: string;
          file_url: string | null;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          month: number;
          year: number;
          file_name: string;
          file_url?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          month?: number;
          year?: number;
          file_name?: string;
          file_url?: string | null;
        };
      };
      transactions: {
        Row: {
          id: string;
          account_id: string;
          statement_id: string | null;
          category_id: string | null;
          type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
          amount: number;
          description: string;
          date: string;
          is_recurring: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          account_id: string;
          statement_id?: string | null;
          category_id?: string | null;
          type?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
          amount: number;
          description: string;
          date: string;
          is_recurring?: boolean;
          notes?: string | null;
        };
        Update: {
          id?: string;
          account_id?: string;
          statement_id?: string | null;
          category_id?: string | null;
          type?: 'INCOME' | 'EXPENSE' | 'TRANSFER';
          amount?: number;
          description?: string;
          date?: string;
          is_recurring?: boolean;
          notes?: string | null;
        };
      };
    };
  };
}
