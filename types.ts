import React from 'react';

export type Tab = 'kasir' | 'pesanan' | 'laporan' | 'pengaturan' | 'qayzan';

export interface BaseMenuItem {
    id: string;
    name: string;
    price: number;
    stockId: string;
    qty?: number;
    variants?: string[]; // Array of variant names e.g., ["Original", "Rendang"]
}

export type MenuItem = BaseMenuItem;
export type Topping = BaseMenuItem;
export type Drink = BaseMenuItem;

export interface InventoryItem {
    id:string;
    name: string;
    quantity: number;
    minStock: number;
}

export interface Payment {
    status: 'Belum Bayar' | 'Sudah Bayar';
    method: 'Cash' | 'QRIS';
}

export interface SelectedTopping extends BaseMenuItem {
    quantity: number;
}

export interface OrderItem extends BaseMenuItem {
    quantity: number;
    selectedVariant?: string; // The specific variant chosen for this order item
    selectedToppings?: SelectedTopping[]; // Array of toppings attached specifically to this item with quantity
    isDelivered?: boolean; // Track delivery status per item
}

export interface Order {
    id: string | null;
    items: OrderItem[];
    customerName: string;
    payment: Payment;
    // delivered: boolean; // DEPRECATED: Moved to OrderItem level for granularity
    createdAt: string | null;
    total: number;
}

export interface Transaction extends Order {
    id: string;
    createdAt: string;
}

export interface Expense {
    id: string;
    description: string;
    amount: number;
    date: string;
}

export interface Settings {
    primaryColor: string;
    secondaryColor: string;
    backgroundImage: string;
}

export interface DailyCash {
    date: string; // YYYY-MM-DD
    startingFloat: number;
}

export interface DailyLog {
  date: string; // YYYY-MM-DD
  manualRevenue?: number; 
  manualExpenses?: number; 
  savingsDeposited: boolean;
  savingsAmount?: number;
  cashReconciled?: boolean;
  actualCashInHand?: number;
  cashDifference?: number;
  isClosed?: boolean;
}

// --- NEW QAYZAN STUDIO TYPES ---
export interface LedgerEntry {
    id: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    method: 'cash' | 'bank' | 'dana';
    isAuto?: boolean; // To distinguish POS income from manual entries
}

export interface QayzanStudioDailyData {
    date: string;
    startingCash: number;
    startingBank: number;
    startingDana: number;
    ledger: LedgerEntry[];
}

export interface QayzanStudioMonthlyData {
    yearMonth: string; // YYYY-MM
    monthlyTarget: number;
}

export interface QayzanStudioData {
    daily: QayzanStudioDailyData[];
    monthly: QayzanStudioMonthlyData[];
    savingsBalance: number;
}
// --- END NEW QAYZAN STUDIO TYPES ---


export interface AppData {
    menu: MenuItem[];
    toppings: Topping[];
    drinks: Drink[];
    inventory: InventoryItem[];
    transactions: Transaction[];
    expenses: Expense[];
    settings: Settings;
    dailyCash: DailyCash[];
    dailyLogs: DailyLog[];
    qayzanStudio: QayzanStudioData;
}

export interface ModalState {
    isOpen: boolean;
    title: string;
    body: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
    hideButtons?: boolean;
}

export interface ToastState {
    isVisible: boolean;
    message: string;
}

export interface SummaryData {
    date: string;
    totalOmzet: number;
    cashSales: number;
    qrisSales: number;
    transactions: Transaction[];
}