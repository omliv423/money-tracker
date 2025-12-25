export type AccountType = "bank" | "cash" | "card" | "investment" | "points";
export type AccountOwner = "self" | "shared";
export type CategoryType = "income" | "expense" | "transfer";
export type LineType = "income" | "expense" | "asset" | "liability";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  owner: AccountOwner;
  initial_balance: number;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  is_active: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  account_id: string;
  total_amount: number;
  created_at: string;
}

export interface TransactionLine {
  id: string;
  transaction_id: string;
  amount: number;
  category_id: string;
  line_type: LineType;
  counterparty: string | null;
  is_settled: boolean;
  note: string | null;
  created_at: string;
}

export interface Settlement {
  id: string;
  date: string;
  counterparty: string;
  amount: number;
  note: string | null;
  created_at: string;
}

// Supabase Database type
export interface Database {
  public: {
    Tables: {
      accounts: {
        Row: Account;
        Insert: Omit<Account, "id" | "created_at">;
        Update: Partial<Omit<Account, "id" | "created_at">>;
      };
      categories: {
        Row: Category;
        Insert: Omit<Category, "id" | "created_at">;
        Update: Partial<Omit<Category, "id" | "created_at">>;
      };
      transactions: {
        Row: Transaction;
        Insert: Omit<Transaction, "id" | "created_at">;
        Update: Partial<Omit<Transaction, "id" | "created_at">>;
      };
      transaction_lines: {
        Row: TransactionLine;
        Insert: Omit<TransactionLine, "id" | "created_at">;
        Update: Partial<Omit<TransactionLine, "id" | "created_at">>;
      };
      settlements: {
        Row: Settlement;
        Insert: Omit<Settlement, "id" | "created_at">;
        Update: Partial<Omit<Settlement, "id" | "created_at">>;
      };
    };
  };
}

// Extended types with relations
export interface TransactionWithLines extends Transaction {
  account: Account;
  lines: (TransactionLine & { category: Category })[];
}
