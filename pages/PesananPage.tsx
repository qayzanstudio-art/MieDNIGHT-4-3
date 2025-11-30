
import React, { useState, useMemo, useEffect } from 'react';
import type { AppData, Transaction, Order, Tab, OrderItem } from '../types';
import { Utils } from '../App';

interface PesananPageProps {
    data: AppData;
    setData: React.Dispatch<React.SetStateAction<AppData>>;
    setCurrentOrder: React.Dispatch<React.SetStateAction<Order>>;
    setActiveTab: (tab: Tab) => void;
    helpers: {
        showModal: (config: any) => void;
        showToast: (message: string) => void;
    };
    isTodayClosed: boolean;
    handleCloseDay: () => void;
    businessDate: string;
}

const PesananPage: React.FC<PesananPageProps> = ({ data, setData, setCurrentOrder, setActiveTab, helpers, isTodayClosed, handleCloseDay, businessDate }) => {
    const [filters, setFilters] = useState({ date: businessDate, status: 'Semua', method: 'Semua', name: '', delivered: 'Semua' });
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update timer every minute to refresh "x minutes ago"
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const filteredTransactions = useMemo(() => {
        let transactions = [...data.transactions]; // Copy array
        
        if (filters.date) transactions = transactions.filter(t => t.createdAt && t.createdAt.startsWith(filters.date));
        if (filters.status !== 'Semua') transactions = transactions.filter(t => t.payment.status === filters.status);
        if (filters.method !== 'Semua') transactions = transactions.filter(t => t.payment.method === filters.method);
        if (filters.name) transactions = transactions.filter(t => t.customerName.toLowerCase().includes(filters.name.toLowerCase()));
        if (filters.delivered !== 'Semua') {
            const isFullyDelivered = filters.delivered === 'Sudah Diantar';
            transactions = transactions.filter(t => {
                const allItemsDelivered = t.items.every(i => i.isDelivered);
                return isFullyDelivered ? allItemsDelivered : !allItemsDelivered;
            });
        }

        // SORTING: Newest First (Stack Order) - Pesanan baru di ATAS
        transactions.sort((a, b) => {
            const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return timeB - timeA; // Descending
        });

        return transactions;
    }, [data.transactions, filters]);
    
    const handleFilterChange = (filterName: keyof typeof filters, value: string) => {
        setFilters(prev => ({ ...prev, [filterName]: value }));
    };

    const handleEdit = (transaction: Transaction) => {
        setCurrentOrder(JSON.parse(JSON.stringify(transaction)));
        setActiveTab('kasir');
    };
    
    // Toggle delivery for a specific item within a transaction
    const handleToggleItemDelivered = (transactionId: string, itemIndex: number) => {
        setData(prevData => {
            const newTransactions = prevData.transactions.map(t => {
                if (t.id === transactionId) {
                    const newItems = [...t.items];
                    newItems[itemIndex] = { ...newItems[itemIndex], isDelivered: !newItems[itemIndex].isDelivered };
                    return { ...t, items: newItems };
                }
                return t;
            });
            return { ...prevData, transactions: newTransactions };
        });
    };

    // Mark all items in a transaction as delivered
    const handleMarkAllDelivered = (transactionId: string) => {
        setData(prevData => {
            const newTransactions = prevData.transactions.map(t => {
                if (t.id === transactionId) {
                    const newItems = t.items.map(i => ({...i, isDelivered: true}));
                    return { ...t, items: newItems };
                }
                return t;
            });
            return { ...prevData, transactions: newTransactions };
        });
        helpers.showToast('Semua pesanan di meja ini selesai.');
    };

    const handleCancel = (transactionId: string) => {
        helpers.showModal({
            title: 'Konfirmasi Pembatalan',
            body: <p className="text-gray-800">Yakin membatalkan pesanan ini?</p>,
            confirmText: 'Ya, Batalkan',
            onConfirm: () => {
                setData(prevData => {
                    const newTransactions = prevData.transactions.filter(t => t.id !== transactionId);
                    helpers.showToast('Pesanan dibatalkan.');
                    return { ...prevData, transactions: newTransactions };
                });
            }
        });
    };
    
    const confirmCloseDay = () => {
        helpers.showModal({
            title: 'Konfirmasi Tutup Hari Ini',
            body: (
                <div className="text-gray-800">
                    <p className="mb-2">Anda yakin ingin menutup penjualan untuk hari ini?</p>
                    <p className="text-sm font-semibold">Tindakan ini akan memfinalisasi laporan penjualan hari ini dan tidak dapat dibatalkan.</p>
                </div>
            ),
            confirmText: 'Ya, Tutup Hari Ini',
            onConfirm: handleCloseDay,
        });
    };

    // Helper to calculate kitchen summary (Toppings + Main Item Accumulation)
    const calculateKitchenSummary = (items: OrderItem[]) => {
        const summary: { [key: string]: number } = {};
        
        items.forEach(item => {
            const lowerName = item.name.toLowerCase();

            // 1. Accumulate Specific Main Items (Mie Bangladesh)
            if (lowerName.includes('bangladesh')) {
                const key = "TOTAL MIE BANGLADESH";
                summary[key] = (summary[key] || 0) + item.quantity;
            }

            // 2. Accumulate Toppings
            item.selectedToppings?.forEach(top => {
                const currentQty = summary[top.name] || 0;
                summary[top.name] = currentQty + top.quantity;
            });
        });
        return summary;
    };

    const getTimeElapsed = (isoString: string | null) => {
        if (!isoString) return '';
        const created = new Date(isoString);
        const diffInMinutes = Math.floor((currentTime.getTime() - created.getTime()) / 60000);
        
        if (diffInMinutes < 1) return 'Baru saja';
        if (diffInMinutes < 60) return `${diffInMinutes} menit lalu`;
        const hours = Math.floor(diffInMinutes / 60);
        const mins = diffInMinutes % 60;
        return `${hours} jam ${mins} menit lalu`;
    };

    return (
        <div className="bg-transparent text-on-secondary pb-20">
            {/* Header Control (Static - Not Sticky) */}
            <div className="bg-white p-4 rounded-lg card-shadow mb-6 flex flex-col md:flex-row justify-between items-center gap-4 border-t-4 border-primary">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">Antrian Pesanan (Dapur)</h2>
                    <p className="text-sm text-gray-500">Urutan Tumpukan: Pesanan terbaru di paling atas.</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                     <button
                        onClick={confirmCloseDay}
                        disabled={isTodayClosed}
                        className="flex-1 md:flex-none bg-gray-800 text-white font-bold py-2 px-6 rounded-lg hover:bg-black transition disabled:bg-gray-400 disabled:cursor-not-allowed shadow-md"
                    >
                        {isTodayClosed ? '🔒 Hari Ditutup' : '🛑 Tutup Hari Ini'}
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg card-shadow mb-6">
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-gray-800">
                    <div><label className="text-xs font-bold text-gray-500 uppercase">Tanggal</label><input type="date" value={filters.date} onChange={e => handleFilterChange('date', e.target.value)} className="mt-1 w-full border-gray-300 rounded-md text-sm" /></div>
                    <div><label className="text-xs font-bold text-gray-500 uppercase">Bayar</label><select value={filters.status} onChange={e => handleFilterChange('status', e.target.value)} className="mt-1 w-full border-gray-300 rounded-md text-sm"><option>Semua</option><option>Sudah Bayar</option><option>Belum Bayar</option></select></div>
                    <div><label className="text-xs font-bold text-gray-500 uppercase">Antar</label><select value={filters.delivered} onChange={e => handleFilterChange('delivered', e.target.value)} className="mt-1 w-full border-gray-300 rounded-md text-sm"><option>Semua</option><option>Sudah Diantar</option><option>Belum Diantar</option></select></div>
                    <div><label className="text-xs font-bold text-gray-500 uppercase">Metode</label><select value={filters.method} onChange={e => handleFilterChange('method', e.target.value)} className="mt-1 w-full border-gray-300 rounded-md text-sm"><option>Semua</option><option>Cash</option><option>QRIS</option></select></div>
                    <div className="col-span-2 md:col-span-1"><label className="text-xs font-bold text-gray-500 uppercase">Cari</label><input type="text" value={filters.name} onChange={e => handleFilterChange('name', e.target.value)} placeholder="Nama / Meja..." className="mt-1 w-full border-gray-300 rounded-md text-sm" /></div>
                </div>
            </div>

            {/* VERTICAL LIST LAYOUT (Antrian Full Width) */}
            <div className="flex flex-col space-y-6 w-full mx-auto">
                {filteredTransactions.length > 0 ? filteredTransactions.map((t, index) => {
                    const allDelivered = t.items.every(i => i.isDelivered);
                    const kitchenSummary = calculateKitchenSummary(t.items);
                    const hasSummary = Object.keys(kitchenSummary).length > 0;
                    const isPaid = t.payment.status === 'Sudah Bayar';
                    const timeElapsed = getTimeElapsed(t.createdAt);
                    
                    // Logic untuk Nomor Antrian: 
                    // Karena array diurutkan Newest First (Descending),
                    // Item index 0 adalah yang terbaru (angka terbesar).
                    // Item index terakhir adalah No #1.
                    const queueNumber = filteredTransactions.length - index;

                    return (
                        <div key={t.id} className={`relative flex flex-col md:flex-row bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 ${allDelivered ? 'opacity-70 border border-gray-200' : 'border-l-8 border-primary'}`}>
                            
                            {/* SEQUENCE NUMBER & STATUS (Left Column) */}
                            <div className={`p-4 flex flex-row md:flex-col items-center justify-between md:justify-center gap-2 md:w-24 flex-shrink-0 ${allDelivered ? 'bg-gray-100' : 'bg-primary text-on-primary'}`}>
                                <div className="text-center">
                                    <span className="text-xs uppercase font-bold opacity-70">Antrian</span>
                                    <div className="text-3xl font-black">#{queueNumber}</div>
                                </div>
                                <div className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider ${isPaid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} md:mt-2`}>
                                    {isPaid ? 'Lunas' : 'Belum'}
                                </div>
                            </div>

                            {/* MAIN CONTENT (Middle) */}
                            <div className="flex-grow p-4 md:border-r border-gray-100">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="text-2xl font-bold text-gray-900 leading-none mb-1">{t.customerName || 'Tanpa Nama'}</h3>
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <span className="font-mono bg-gray-100 px-2 rounded">{Utils.formatTime(t.createdAt)}</span>
                                            <span>•</span>
                                            <span className="font-semibold text-orange-600">{timeElapsed}</span>
                                        </div>
                                    </div>
                                    <div className="text-right md:hidden">
                                        {/* Mobile Price View */}
                                        <span className="font-bold text-primary">{Utils.formatCurrency(t.total)}</span>
                                    </div>
                                </div>

                                {/* ITEM LIST */}
                                <div className="space-y-3">
                                    {t.items.map((item, idx) => (
                                        <div 
                                            key={idx} 
                                            className={`relative p-3 rounded-lg border-l-4 transition-colors ${
                                                item.isDelivered 
                                                ? 'bg-gray-50 border-green-400' 
                                                : 'bg-white border-red-400 shadow-sm ring-1 ring-black/5'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <input 
                                                    type="checkbox" 
                                                    checked={!!item.isDelivered} 
                                                    onChange={() => handleToggleItemDelivered(t.id, idx)} 
                                                    className="mt-1 w-6 h-6 text-primary rounded focus:ring-primary cursor-pointer border-2 border-gray-300 flex-shrink-0"
                                                />
                                                <div className="flex-grow">
                                                    <div className={`font-bold text-lg leading-tight ${item.isDelivered ? 'text-gray-400 line-through decoration-2' : 'text-gray-900'}`}>
                                                        {item.quantity}x {item.name}
                                                    </div>
                                                    {item.selectedVariant && (
                                                        <div className={`text-sm font-semibold italic ${item.isDelivered ? 'text-gray-400' : 'text-primary'}`}>
                                                            {item.selectedVariant}
                                                        </div>
                                                    )}
                                                    
                                                    {/* TOPPING LIST */}
                                                    {item.selectedToppings && item.selectedToppings.length > 0 && (
                                                        <div className={`mt-2 flex flex-wrap gap-2 ${item.isDelivered ? 'opacity-50' : ''}`}>
                                                            {item.selectedToppings.map((top, tIdx) => (
                                                                <span key={tIdx} className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded border border-gray-200 font-medium">
                                                                    + {top.quantity} {top.name}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* KITCHEN SUMMARY */}
                                {hasSummary && !allDelivered && (
                                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                        <div className="text-xs text-yellow-800 font-bold uppercase tracking-wide mb-2">Ringkasan Masak (Meja Ini)</div>
                                        <div className="flex flex-wrap gap-2">
                                            {Object.entries(kitchenSummary).map(([name, qty]) => {
                                                const isMain = name.startsWith('TOTAL');
                                                return (
                                                    <span key={name} className={`text-sm px-2 py-1 rounded font-bold shadow-sm ${isMain ? 'bg-orange-100 text-orange-800 border border-orange-200' : 'bg-white text-gray-700 border border-gray-200'}`}>
                                                        {name.replace('TOTAL ', '')}: {qty}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ACTIONS (Right/Bottom) */}
                            <div className="bg-gray-50 p-4 md:w-48 flex flex-row md:flex-col justify-between items-end md:items-stretch border-t md:border-t-0">
                                <div className="text-right hidden md:block mb-4">
                                    <div className="text-sm text-gray-500">Total</div>
                                    <div className="text-xl font-bold text-primary">{Utils.formatCurrency(t.total)}</div>
                                    <div className="text-xs text-gray-400">{t.payment.method}</div>
                                </div>

                                <div className="flex gap-2 w-full md:flex-col">
                                    {!allDelivered ? (
                                        <button onClick={() => handleMarkAllDelivered(t.id)} className="flex-grow bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg shadow transition flex items-center justify-center gap-2">
                                            <span>Selesai</span>
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                        </button>
                                    ) : (
                                        <div className="flex-grow text-center py-2 bg-green-100 text-green-800 rounded-lg font-bold border border-green-200">
                                            ✓ DIANTAR
                                        </div>
                                    )}
                                    
                                    <div className="flex gap-2">
                                        <button onClick={() => handleEdit(t)} className="flex-1 bg-white border border-blue-200 text-blue-600 hover:bg-blue-50 py-2 rounded-lg font-semibold flex justify-center items-center" title="Edit / Tambah">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                        </button>
                                        <button onClick={() => handleCancel(t.id)} className="flex-1 bg-white border border-red-200 text-red-600 hover:bg-red-50 py-2 rounded-lg font-semibold flex justify-center items-center" title="Batalkan">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                }) : (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-xl card-shadow">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        <p className="text-xl font-bold">Tidak ada antrian</p>
                        <p className="text-sm">Semua pesanan sudah diantar atau belum ada pesanan baru.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PesananPage;
