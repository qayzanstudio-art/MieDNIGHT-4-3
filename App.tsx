
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import type { Tab, AppData, Order, Transaction, InventoryItem, MenuItem, Settings, ModalState, ToastState, SummaryData, QayzanStudioData, OrderItem } from './types';
import { generateDailySummary, generateMenuIdeas } from './services/geminiService';
import KasirPage from './pages/KasirPage';
import PesananPage from './pages/PesananPage';
import LaporanPage from './pages/LaporanPage';
import PengaturanPage from './pages/PengaturanPage';
import HomeScreen from './pages/HomeScreen';
import { Header } from './components/Header';
import { Modal } from './components/Modal';
import { Toast } from './components/Toast';
import { SummaryReport } from './components/SummaryReport';
import QayzanStudioPage from './pages/QayzanStudioPage';

// --- UTILS ---
export const Utils = {
    formatCurrency: (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount),
    formatDate: (iso: string | null) => { if (!iso) return '-'; return new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }); },
    formatTime: (iso: string | null) => { if (!iso) return '-'; return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.',':'); },
    getTodayDateString: () => new Date().toISOString().slice(0, 10),
    /**
     * Determines the business date string (YYYY-MM-DD) for a given date.
     * Considers times before 6 AM to belong to the previous calendar day.
     * @param date The date object to check. Defaults to now.
     * @returns The ISO date string (YYYY-MM-DD) of the business day.
     */
    getBusinessDateString: (date: Date = new Date()): string => {
        const checkDate = new Date(date);
        // If it's before 6 AM, it belongs to the previous day's business
        if (checkDate.getHours() < 6) {
            checkDate.setDate(checkDate.getDate() - 1);
        }
        return checkDate.toISOString().slice(0, 10);
    },
    getContrastYIQ: (hex: string) => {
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return ((r*299)+(g*587)+(b*114))/1000 >= 128 ? '#1A202C' : '#FFFFFF';
    },
    adjustColor: (color: string, percent: number) => {
        let f=parseInt(color.slice(1),16),t=percent<0?0:255,p=percent<0?percent*-1:percent,R=f>>16,G=f>>8&0x00FF,B=f&0x0000FF;
        return "#"+(0x1000000+(Math.round((t-R)*p)+R)*0x10000+(Math.round((t-G)*p)+G)*0x100+(Math.round((t-B)*p)+B)).toString(16).slice(1);
    },
};

const getDefaultData = (): AppData => ({
    menu: [
        { id: 'menu-1', name: 'Mie Goreng', price: 10000, stockId: '', variants: ['Original', 'Cakalang', 'Rendang', 'Aceh'] },
        { id: 'menu-2', name: 'Mie Kuah', price: 10000, stockId: '', variants: ['Soto', 'Cakalang', 'Kari Ayam', 'Ayam Bawang'] },
        { id: 'menu-3', name: 'Mie Double', price: 16000, stockId: '', qty: 2 }, // Variants handled dynamically in KasirPage
        { id: 'menu-4', name: 'Mie Bangladesh', price: 16000, stockId: '' },
        { id: 'menu-5', name: 'Mie Bangladesh Complete', price: 30000, stockId: '' }, // New Item
        { id: 'menu-6', name: 'Nasi Ayam Panggang', price: 27000, stockId: '' }, // Consolidated Item
    ],
    toppings: [
        { id: 'top-1', name: 'Sosis', price: 3000, stockId: '' },
        { id: 'top-2', name: 'Pangsit', price: 1000, stockId: '' },
        { id: 'top-3', name: 'Bakso 2 pcs', price: 5000, stockId: '', qty: 2 }, // Updated
        { id: 'top-4', name: 'Tahu', price: 2000, stockId: '' },
        { id: 'top-5', name: 'Telur Mata Sapi', price: 3000, stockId: '' },
        { id: 'top-6', name: 'Telur Dadar', price: 3000, stockId: '' },
    ],
    drinks: [ { id: 'drink-1', name: 'Air Mineral', price: 5000, stockId: '' } ],
    inventory: [], // Inventory emptied as requested
    transactions: [], 
    expenses: [],
    settings: { primaryColor: '#146b61', secondaryColor: '#FDFBF6', backgroundImage: '' },
    dailyCash: [],
    dailyLogs: [],
    qayzanStudio: {
        daily: [],
        monthly: [],
        savingsBalance: 0
    }
});


const getNewOrder = (): Order => ({
    id: null, items: [], customerName: '', payment: { status: 'Belum Bayar', method: 'Cash' }, createdAt: null, total: 0
});

const App: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('kasir');
    const [businessDate, setBusinessDate] = useState<string | null>(null);
    const [summaryReportData, setSummaryReportData] = useState<SummaryData | null>(null);
    const [isQayzanUnlocked, setIsQayzanUnlocked] = useState(false);
    
    const [data, setData] = useState<AppData>(() => {
        try {
            const savedData = localStorage.getItem('warmindoAppData');
            if (savedData) {
                const parsedData = JSON.parse(savedData);
                const defaults = getDefaultData();

                // --- DATA MIGRATION LOGIC ---
                // Qayzan Studio data structure changed, let's migrate it.
                if (parsedData.qayzanStudio && parsedData.qayzanStudio.daily && parsedData.qayzanStudio.daily.length > 0 && 'cashOnHand' in parsedData.qayzanStudio.daily[0]) {
                    const newDailyData = parsedData.qayzanStudio.daily.map((oldEntry: any) => ({
                        date: oldEntry.date,
                        startingCash: oldEntry.cashOnHand || 0,
                        startingBank: oldEntry.bankBalance || 0,
                        startingDana: oldEntry.danaBalance || 0,
                        ledger: [], // Old data didn't have a ledger, start fresh
                    }));
                    parsedData.qayzanStudio.daily = newDailyData;
                }

                // Migrate OrderItems to have `isDelivered` and `selectedToppings` with quantity
                if (parsedData.transactions) {
                    parsedData.transactions = parsedData.transactions.map((t: any) => ({
                        ...t,
                        items: t.items.map((item: any) => ({
                            ...item,
                            isDelivered: item.isDelivered !== undefined ? item.isDelivered : (t.delivered || false),
                            selectedToppings: item.selectedToppings ? item.selectedToppings.map((top: any) => ({
                                ...top,
                                quantity: top.quantity || 1 // Default to 1 if missing
                            })) : []
                        }))
                    }));
                }
                
                // Ensure new fields exist on old data by merging defaults
                const mergedData = {
                    ...defaults,
                    ...parsedData,
                    settings: { ...defaults.settings, ...parsedData.settings },
                    dailyLogs: parsedData.dailyLogs || [],
                    qayzanStudio: { ...defaults.qayzanStudio, ...(parsedData.qayzanStudio || {}) },
                    inventory: [], // Force empty inventory on load if migrating
                };
                
                // Backfill variants for old data if missing
                mergedData.menu = mergedData.menu.map((m: MenuItem) => {
                     const defaultItem = defaults.menu.find(dm => dm.name === m.name);
                     if (defaultItem && defaultItem.variants && !m.variants) {
                         return { ...m, variants: defaultItem.variants };
                     }
                     return m;
                });

                // Clean up obsolete fields
                delete (mergedData as any).historicalData;
                delete (mergedData as any).previousTotalRevenue;
                return mergedData;
            }
        } catch (error) {
            console.error("Failed to load or migrate data from localStorage", error);
        }
        return getDefaultData();
    });
    
    const [currentOrder, setCurrentOrder] = useState<Order>(getNewOrder());
    const [modalState, setModalState] = useState<ModalState>({ isOpen: false, title: '', body: null });
    const [toastState, setToastState] = useState<ToastState>({ isVisible: false, message: '' });

    const isTodayClosed = useMemo(() => {
        if (!businessDate) return true; // Block actions if session hasn't started
        return data.dailyLogs.find(log => log.date === businessDate)?.isClosed || false;
    }, [data.dailyLogs, businessDate]);


    // --- Local Storage and Theme Sync ---
    useEffect(() => {
        try {
            localStorage.setItem('warmindoAppData', JSON.stringify(data));
        } catch (error) {
            console.error("Failed to save data to localStorage", error);
        }
    }, [data]);
    
    useEffect(() => {
        const { settings } = data;
        const root = document.documentElement;
        const darkPrimary = Utils.adjustColor(settings.primaryColor, -20);
        const darkSecondary = Utils.adjustColor(settings.secondaryColor, -5);
        
        root.style.setProperty('--color-primary', settings.primaryColor);
        root.style.setProperty('--color-primary-dark', darkPrimary);
        root.style.setProperty('--color-secondary', settings.secondaryColor);
        root.style.setProperty('--color-secondary-dark', darkSecondary);
        root.style.setProperty('--color-text-on-primary', Utils.getContrastYIQ(settings.primaryColor));
        root.style.setProperty('--color-text-on-secondary', Utils.getContrastYIQ(settings.secondaryColor));
        root.style.setProperty('--background-image', settings.backgroundImage ? `url('${settings.backgroundImage}')` : 'none');
    }, [data.settings]);

    // --- UI Handlers ---
    const showToast = useCallback((message: string) => {
        setToastState({ message, isVisible: true });
        setTimeout(() => setToastState({ message: '', isVisible: false }), 3000);
    }, []);

    const showModal = useCallback((modalConfig: Omit<ModalState, 'isOpen'>) => {
        setModalState({ ...modalConfig, isOpen: true });
    }, []);

    const hideModal = useCallback(() => {
        setModalState(prev => ({...prev, isOpen: false}));
    }, []);
    
    const handleStartSession = (date: string) => {
        setBusinessDate(date);
        setActiveTab('kasir'); // Go to kasir page after starting
    };

    const handleCloseSummary = () => {
        setSummaryReportData(null);
        setBusinessDate(null); // Return to HomeScreen
    };

    const handleGoHome = () => {
        setBusinessDate(null);
    };

    const handleTabChange = (newTab: Tab) => {
        if (activeTab === 'qayzan' && newTab !== 'qayzan') {
            setIsQayzanUnlocked(false); // Lock Qayzan Studio when navigating away
        }
        setActiveTab(newTab);
    };

    // --- Business Logic ---
    const handleCloseDay = useCallback(() => {
        if (!businessDate) return;

        const { transactions, expenses } = data;

        // Calculate summary based on the CURRENT data state before queueing updates.
        const dailyTrx = transactions.filter(t => t.createdAt && t.createdAt.startsWith(businessDate) && t.payment.status === 'Sudah Bayar');
        const dailyExpenses = expenses.filter(e => e.date === businessDate);
        
        const totalOmzet = dailyTrx.reduce((s, t) => s + t.total, 0);
        const cashSales = dailyTrx.filter(t => t.payment.method === 'Cash').reduce((s, t) => s + t.total, 0);
        const qrisSales = dailyTrx.filter(t => t.payment.method === 'QRIS').reduce((s, t) => s + t.total, 0);
        const totalExpenses = dailyExpenses.reduce((s, e) => s + e.amount, 0);

        const summary: SummaryData = {
            date: businessDate,
            totalOmzet,
            cashSales,
            qrisSales,
            transactions: dailyTrx,
        };

        // Now queue the state update for the main data
        setData(prevData => {
            const logIndex = prevData.dailyLogs.findIndex(l => l.date === businessDate);
            let newLogs = [...prevData.dailyLogs];

            const logUpdate = {
                isClosed: true,
                manualRevenue: totalOmzet,
                manualExpenses: totalExpenses,
            };

            if (logIndex > -1) {
                newLogs[logIndex] = { ...newLogs[logIndex], ...logUpdate };
            } else {
                newLogs.push({ date: businessDate, savingsDeposited: false, ...logUpdate });
            }

            return { ...prevData, dailyLogs: newLogs };
        });

        // And queue the state update to show the summary modal.
        // This will be batched with the setData update by React.
        setSummaryReportData(summary);
        
        showToast('Hari ini telah ditutup. Laporan penjualan telah difinalisasi.');
    }, [businessDate, data, setData, showToast]);


    // --- Data Access Helpers ---
    const getItemById = useCallback(<T extends { id: string }>(type: keyof AppData, id: string): T | undefined => {
        const items = data[type] as unknown as T[];
        return items?.find(item => item.id === id);
    }, [data]);
    
    // getStockItemById Removed as requested

    const helpers = useMemo(() => ({
        getItemById,
        // getStockItemById removed
        showToast,
        showModal,
        hideModal,
        generateDailySummary,
        generateMenuIdeas
    }), [getItemById, showToast, showModal, hideModal]);
    
    // --- Page Rendering ---
    const renderPage = () => {
        const pageProps = { data, setData, currentOrder, setCurrentOrder, helpers, isTodayClosed };
        switch (activeTab) {
            case 'kasir': return <KasirPage {...pageProps} businessDate={businessDate!} />;
            case 'pesanan': return <PesananPage {...pageProps} setActiveTab={handleTabChange} handleCloseDay={handleCloseDay} businessDate={businessDate!} />;
            case 'laporan': return <LaporanPage {...pageProps} businessDate={businessDate!} />;
            // case 'stok': removed
            case 'pengaturan': return <PengaturanPage {...pageProps} />;
            case 'qayzan': return <QayzanStudioPage {...pageProps} isUnlocked={isQayzanUnlocked} setIsUnlocked={setIsQayzanUnlocked} businessDate={businessDate!} />;
            default: return <KasirPage {...pageProps} businessDate={businessDate!} />;
        }
    };
    
    if (summaryReportData) {
        return <SummaryReport data={summaryReportData} onClose={handleCloseSummary} />;
    }

    if (!businessDate) {
        return (
            <>
                <style>{`
                    :root {
                        --color-primary: ${data.settings.primaryColor};
                        --color-secondary: ${data.settings.secondaryColor};
                    }
                `}</style>
                <HomeScreen 
                    onStartSession={handleStartSession} 
                    showModal={showModal} 
                    settings={data.settings}
                    dailyLogs={data.dailyLogs}
                />
                 <Modal {...modalState} onClose={hideModal} />
            </>
        )
    }
    
    return (
        <div className="min-h-screen flex flex-col bg-secondary/80 backdrop-blur-sm">
            <style>
            {`
                :root {
                    --color-primary: #2D3748;
                    --color-primary-dark: #1A202C;
                    --color-secondary: #FDFBF6;
                    --color-secondary-dark: #F3EFEA;
                    --color-text-on-primary: #FFFFFF;
                    --color-text-on-secondary: #1A202C;
                }
                .tab-btn.active {
                    border-bottom-width: 4px;
                    color: var(--color-text-on-primary);
                    border-color: var(--color-text-on-primary);
                }
                .tab-btn { transition: all 0.3s ease; }
                .tab-btn:hover { border-color: var(--color-text-on-primary); }
                .bg-primary { background-color: var(--color-primary); }
                .hover\\:bg-primary-dark:hover { background-color: var(--color-primary-dark) !important; }
                .text-on-primary { color: var(--color-text-on-primary); }
                .bg-secondary { background-color: var(--color-secondary); }
                .bg-secondary-dark { background-color: var(--color-secondary-dark); }
                .text-on-secondary { color: var(--color-text-on-secondary); }
                .focus\\:ring-primary:focus { box-shadow: 0 0 0 2px var(--color-primary); border-color: var(--color-primary); }
                .card-shadow { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); }
                .btn-primary { background-color: var(--color-primary); color: var(--color-text-on-primary); }
                .hover\\:btn-primary-dark:hover { background-color: var(--color-primary-dark); }
            `}
            </style>
            <Header activeTab={activeTab} setActiveTab={handleTabChange} isMonitoring={isTodayClosed} onGoHome={handleGoHome} />
            <main className="container mx-auto p-4 flex-grow">
                {renderPage()}
            </main>
            <Modal {...modalState} onClose={hideModal} />
            <Toast {...toastState} />
        </div>
    );
};

export default App;
