import React, { useState, useMemo, useEffect } from 'react';
import type { AppData, QayzanStudioDailyData, LedgerEntry } from '../types';
import { Utils } from '../App';

interface QayzanStudioPageProps {
    data: AppData;
    setData: React.Dispatch<React.SetStateAction<AppData>>;
    isUnlocked: boolean;
    setIsUnlocked: React.Dispatch<React.SetStateAction<boolean>>;
    helpers: {
        showToast: (message: string) => void;
    };
    businessDate: string;
}

const BalanceInput: React.FC<{ 
    label: string; 
    value: string | number; 
    onChange: (val: string) => void; 
    onBlur: () => void; 
    isLarge?: boolean;
    inputStyle?: React.CSSProperties;
    variant?: 'primary' | 'secondary';
}> = ({ label, value, onChange, onBlur, isLarge, inputStyle, variant = 'secondary' }) => {
    const isPrimary = variant === 'primary';
    const labelColor = isPrimary ? 'text-on-primary opacity-80' : 'text-on-secondary';
    
    const inputBaseClasses = `w-full rounded-md p-2 font-semibold focus:ring-primary focus:border-primary ${isLarge ? 'text-xl' : 'text-base'}`;
    const inputVariantClasses = isPrimary 
        ? 'bg-black/20 border-white/30 text-on-primary placeholder:text-white/50'
        : 'border-gray-300 text-on-secondary placeholder:text-gray-400';

    return (
        <div>
            <label className={`block text-sm font-medium mb-1 ${isLarge ? 'text-gray-600' : ''} ${labelColor}`}>{label}</label>
            <input 
                type="number"
                value={value}
                onChange={e => onChange(e.target.value)}
                onBlur={onBlur}
                placeholder='0'
                className={`${inputBaseClasses} ${inputVariantClasses}`}
                style={inputStyle}
            />
        </div>
    );
};


const QayzanStudioPage: React.FC<QayzanStudioPageProps> = ({ data, setData, isUnlocked, setIsUnlocked, helpers, businessDate }) => {
    const [passwordInput, setPasswordInput] = useState('');
    const todayStr = businessDate;
    const currentYearMonth = useMemo(() => todayStr.slice(0, 7), [todayStr]);

    // Ensure there's always a daily data object for today
    useEffect(() => {
        const todayDataExists = data.qayzanStudio.daily.some(d => d.date === todayStr);
        if (!todayDataExists) {
            setData(prev => {
                const newDailyData: QayzanStudioDailyData = {
                    date: todayStr,
                    startingCash: 0,
                    startingBank: 0,
                    startingDana: 0,
                    ledger: [],
                };
                return {
                    ...prev,
                    qayzanStudio: {
                        ...prev.qayzanStudio,
                        daily: [...prev.qayzanStudio.daily, newDailyData],
                    }
                };
            });
        }
    }, [todayStr, data.qayzanStudio.daily, setData]);

    const todayData = useMemo(() => {
        return data.qayzanStudio.daily.find(d => d.date === todayStr) || { date: todayStr, startingCash: 0, startingBank: 0, startingDana: 0, ledger: [] };
    }, [data.qayzanStudio.daily, todayStr]);

    const monthData = useMemo(() => {
        return data.qayzanStudio.monthly.find(m => m.yearMonth === currentYearMonth);
    }, [data.qayzanStudio.monthly, currentYearMonth]);
    
    // --- State for manual entry form ---
    const [newEntry, setNewEntry] = useState({
        description: '',
        amount: '',
        type: 'expense' as 'income' | 'expense',
        method: 'cash' as 'cash' | 'bank' | 'dana',
    });

    // --- Memoized Calculations ---
    const dailyPosIncome = useMemo(() => {
        const dailyTrx = data.transactions.filter(t => t.createdAt && t.createdAt.startsWith(todayStr) && t.payment.status === 'Sudah Bayar');
        const cash = dailyTrx.filter(t => t.payment.method === 'Cash').reduce((sum, t) => sum + t.total, 0);
        const qris = dailyTrx.filter(t => t.payment.method === 'QRIS').reduce((sum, t) => sum + t.total, 0);
        return { cash, qris };
    }, [data.transactions, todayStr]);

    const fullLedger = useMemo((): LedgerEntry[] => {
        const entries: LedgerEntry[] = [];
        if (dailyPosIncome.cash > 0) {
            entries.push({ id: 'auto-pos-cash', description: 'Pemasukan POS (Cash)', amount: dailyPosIncome.cash, type: 'income', method: 'cash', isAuto: true });
        }
        if (dailyPosIncome.qris > 0) {
            entries.push({ id: 'auto-pos-qris', description: 'Pemasukan POS (QRIS)', amount: dailyPosIncome.qris, type: 'income', method: 'dana', isAuto: true });
        }
        return [...entries, ...todayData.ledger];
    }, [todayData.ledger, dailyPosIncome]);

    const finalBalances = useMemo(() => {
        const balances = {
            cash: todayData.startingCash,
            bank: todayData.startingBank,
            dana: todayData.startingDana,
        };
        fullLedger.forEach(entry => {
            const amount = entry.type === 'income' ? entry.amount : -entry.amount;
            if (entry.method in balances) {
                balances[entry.method as keyof typeof balances] += amount;
            }
        });
        return balances;
    }, [todayData, fullLedger]);
    
    const monthlyRecap = useMemo(() => {
        const recapByMonth: { [key: string]: { income: number, expense: number, posIncome: number } } = {};

        data.qayzanStudio.daily.forEach(day => {
            const yearMonth = day.date.slice(0, 7);
            if (!recapByMonth[yearMonth]) {
                recapByMonth[yearMonth] = { income: 0, expense: 0, posIncome: 0 };
            }
            
            day.ledger.forEach(entry => {
                if(entry.type === 'income') recapByMonth[yearMonth].income += entry.amount;
                else recapByMonth[yearMonth].expense += entry.amount;
            });

            const dailyTrx = data.transactions.filter(t => t.createdAt && t.createdAt.startsWith(day.date) && t.payment.status === 'Sudah Bayar');
            recapByMonth[yearMonth].posIncome += dailyTrx.reduce((sum, t) => sum + t.total, 0);
        });

        const currentMonthLog = data.dailyLogs.find(l => l.date.startsWith(currentYearMonth));
        const currentMonthRevenue = currentMonthLog?.manualRevenue || 0;

        return Object.entries(recapByMonth)
            .map(([yearMonth, totals]) => ({
                yearMonth,
                profit: (totals.posIncome + totals.income) - totals.expense,
                isCurrent: yearMonth === currentYearMonth,
                revenue: yearMonth === currentYearMonth ? currentMonthRevenue : (totals.posIncome + totals.income)
            }))
            .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));

    }, [data.qayzanStudio.daily, data.transactions, data.dailyLogs, currentYearMonth]);


    // --- Event Handlers ---
    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (passwordInput === '132007') {
            setIsUnlocked(true);
            helpers.showToast('Akses diberikan!');
        } else {
            helpers.showToast('Password salah!');
        }
        setPasswordInput('');
    };
    
    const updateDailyData = (field: keyof QayzanStudioDailyData, value: any) => {
        setData(prev => {
            const dailyIndex = prev.qayzanStudio.daily.findIndex(d => d.date === todayStr);
            if (dailyIndex === -1) return prev; // Should not happen due to useEffect
            
            const newDaily = [...prev.qayzanStudio.daily];
            newDaily[dailyIndex] = { ...newDaily[dailyIndex], [field]: value };

            return { ...prev, qayzanStudio: { ...prev.qayzanStudio, daily: newDaily }};
        });
    };
    
    const handleAddLedgerEntry = () => {
        const amount = parseFloat(newEntry.amount);
        if(!newEntry.description || isNaN(amount) || amount <= 0) {
            helpers.showToast('Mohon isi deskripsi dan jumlah yang valid.');
            return;
        }

        const newLedgerItem: LedgerEntry = {
            id: `manual-${Date.now()}`,
            description: newEntry.description,
            amount: amount,
            type: newEntry.type,
            method: newEntry.method,
        };

        updateDailyData('ledger', [...todayData.ledger, newLedgerItem]);
        setNewEntry({ description: '', amount: '', type: 'expense', method: 'cash' }); // Reset form
    };

    const handleDeleteLedgerEntry = (id: string) => {
        const newLedger = todayData.ledger.filter(entry => entry.id !== id);
        updateDailyData('ledger', newLedger);
    };
    
    const handleUpdateMonthlyTarget = (value: string) => {
        const target = parseFloat(value) || 0;
        setData(prev => {
            const monthlyIndex = prev.qayzanStudio.monthly.findIndex(m => m.yearMonth === currentYearMonth);
            const newMonthly = [...prev.qayzanStudio.monthly];
            if (monthlyIndex > -1) {
                newMonthly[monthlyIndex] = { ...newMonthly[monthlyIndex], monthlyTarget: target };
            } else {
                newMonthly.push({ yearMonth: currentYearMonth, monthlyTarget: target });
            }
            return { ...prev, qayzanStudio: { ...prev.qayzanStudio, monthly: newMonthly }};
        });
    };
    
    if (!isUnlocked) {
         return (
            <div className="flex justify-center items-center h-full pt-16">
                <form onSubmit={handleLogin} className="bg-white p-8 rounded-lg shadow-xl text-on-secondary w-full max-w-sm text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-on-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    <h2 className="text-2xl font-bold mb-2">Akses Terbatas</h2>
                    <p className="text-gray-600 mb-6">Masukkan password untuk membuka Qayzan Studio.</p>
                    <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} className="w-full text-center border-gray-300 rounded-md text-lg p-2 mb-4" placeholder="******" autoFocus />
                    <button type="submit" className="w-full btn-primary font-bold py-3 rounded-lg hover:btn-primary-dark transition">Buka</button>
                </form>
            </div>
        );
    }
    
    const monthlyTarget = monthData?.monthlyTarget || 0;
    const monthlyRevenue = monthlyRecap.find(m => m.isCurrent)?.revenue || 0;
    const monthlyProgress = monthlyTarget > 0 ? (monthlyRevenue / monthlyTarget) * 100 : 0;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Main Ledger */}
            <div className="lg:col-span-2 bg-white p-6 rounded-lg card-shadow text-on-secondary">
                <h2 className="text-2xl font-bold mb-1">Buku Kas Harian</h2>
                <p className="text-gray-600 mb-4">{new Date(todayStr + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>

                {/* Starting Balances */}
                <div className="p-4 bg-primary rounded-lg mb-4 text-on-primary">
                    <h3 className="font-bold text-lg mb-2">Saldo Awal</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <BalanceInput label="Kas (Uang Tunai)" value={todayData.startingCash} onChange={val => updateDailyData('startingCash', parseFloat(val) || 0)} onBlur={() => {}} variant="primary" />
                        <BalanceInput label="Rekening Bank" value={todayData.startingBank} onChange={val => updateDailyData('startingBank', parseFloat(val) || 0)} onBlur={() => {}} variant="primary" />
                        <BalanceInput label="DANA / QRIS" value={todayData.startingDana} onChange={val => updateDailyData('startingDana', parseFloat(val) || 0)} onBlur={() => {}} variant="primary" />
                    </div>
                </div>

                {/* Transaction Ledger */}
                <div className="space-y-2 mb-4">
                    {fullLedger.map(entry => (
                        <div key={entry.id} className={`flex items-center p-2 rounded ${entry.isAuto ? 'bg-blue-50' : 'bg-gray-50'}`}>
                            <div className="flex-grow">
                                <p className="font-semibold text-gray-800">{entry.description}</p>
                                <p className="text-xs text-gray-500">{entry.method.toUpperCase()}</p>
                            </div>
                            <p className={`font-bold text-lg ${entry.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>{entry.type === 'income' ? '+' : '-'} {Utils.formatCurrency(entry.amount)}</p>
                            {!entry.isAuto && (
                                <button onClick={() => handleDeleteLedgerEntry(entry.id)} className="ml-4 text-red-500 hover:text-red-700 text-xl font-bold">&times;</button>
                            )}
                        </div>
                    ))}
                </div>

                {/* Add New Entry */}
                <div className="p-4 border-t">
                    <h3 className="font-bold text-lg mb-3 text-gray-800">Tambah Pencatatan Manual</h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <input type="text" value={newEntry.description} onChange={e => setNewEntry(p => ({...p, description: e.target.value}))} placeholder="Deskripsi (Cth: Beli Gas)" className="w-full border-gray-300 rounded-md" />
                        <input type="number" value={newEntry.amount} onChange={e => setNewEntry(p => ({...p, amount: e.target.value}))} placeholder="Jumlah (Cth: 25000)" className="w-full border-gray-300 rounded-md" />
                        <div className="flex gap-4">
                            <label className="flex items-center"><input type="radio" name="type" checked={newEntry.type === 'expense'} onChange={() => setNewEntry(p => ({...p, type: 'expense'}))} className="form-radio" /> <span className="ml-2">Pengeluaran</span></label>
                            <label className="flex items-center"><input type="radio" name="type" checked={newEntry.type === 'income'} onChange={() => setNewEntry(p => ({...p, type: 'income'}))} className="form-radio" /> <span className="ml-2">Pemasukan</span></label>
                        </div>
                         <div className="flex gap-4">
                            <label className="flex items-center"><input type="radio" name="method" checked={newEntry.method === 'cash'} onChange={() => setNewEntry(p => ({...p, method: 'cash'}))} className="form-radio" /> <span className="ml-2">Kas</span></label>
                            <label className="flex items-center"><input type="radio" name="method" checked={newEntry.method === 'bank'} onChange={() => setNewEntry(p => ({...p, method: 'bank'}))} className="form-radio" /> <span className="ml-2">Bank</span></label>
                             <label className="flex items-center"><input type="radio" name="method" checked={newEntry.method === 'dana'} onChange={() => setNewEntry(p => ({...p, method: 'dana'}))} className="form-radio" /> <span className="ml-2">DANA</span></label>
                        </div>
                        <button onClick={handleAddLedgerEntry} className="btn-primary font-bold py-2 px-4 rounded-lg hover:btn-primary-dark transition md:col-span-2">Tambah Catatan</button>
                    </div>
                </div>
                
                {/* Final Balances */}
                <div className="mt-6 p-4 bg-primary rounded-lg text-center text-on-primary">
                    <h3 className="font-bold text-lg mb-3">Saldo Akhir</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <div><p className="text-sm opacity-80">Kas</p><p className="font-bold text-xl">{Utils.formatCurrency(finalBalances.cash)}</p></div>
                        <div><p className="text-sm opacity-80">Bank</p><p className="font-bold text-xl">{Utils.formatCurrency(finalBalances.bank)}</p></div>
                        <div><p className="text-sm opacity-80">DANA</p><p className="font-bold text-xl">{Utils.formatCurrency(finalBalances.dana)}</p></div>
                    </div>
                     <div className="border-t border-current/20 pt-4">
                        <p className="text-sm font-medium opacity-80">TOTAL SALDO AKHIR</p>
                        <p className="text-4xl font-bold">{Utils.formatCurrency(finalBalances.cash + finalBalances.bank + finalBalances.dana)}</p>
                    </div>
                </div>

            </div>

            {/* Right Column: Widgets */}
            <div className="space-y-6">
                {/* Celengan Widget */}
                 <div className="bg-white p-6 rounded-lg card-shadow text-on-secondary text-center">
                    <h3 className="font-bold text-lg">Celengan</h3>
                    <p className="text-sm text-gray-600">Total Tabungan Saat Ini</p>
                    <p className="text-4xl font-bold text-green-500 my-2">{Utils.formatCurrency(data.qayzanStudio.savingsBalance || 0)}</p>
                    <div className="flex gap-2 pt-2">
                        <input type="number" placeholder="Jumlah" className="w-full border-gray-300 rounded-md p-2 font-semibold" onChange={e => {
                            const amount = parseFloat(e.target.value);
                            if (isNaN(amount) || amount <= 0) return;
                            (e.target as any)._customValue = amount;
                        }} />
                        <button onClick={(e) => {
                            const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                            const amount = (input as any)._customValue;
                            if (amount > 0) {
                                setData(prev => ({...prev, qayzanStudio: {...prev.qayzanStudio, savingsBalance: (prev.qayzanStudio.savingsBalance || 0) + amount }}));
                                helpers.showToast(`${Utils.formatCurrency(amount)} ditambahkan!`);
                                input.value = '';
                                delete (input as any)._customValue;
                            } else {
                                helpers.showToast('Masukkan jumlah valid.');
                            }
                        }} className="bg-green-600 text-white font-bold px-4 rounded-lg hover:bg-green-700 transition">Tambah</button>
                    </div>
                </div>

                {/* Monthly Progress Widget */}
                <div className="bg-white p-6 rounded-lg card-shadow text-on-secondary">
                    <h2 className="text-2xl font-bold mb-4">Progres Bulanan</h2>
                    <BalanceInput label="Target Bulan Ini (Rp)" value={monthData?.monthlyTarget || ''} onChange={handleUpdateMonthlyTarget} onBlur={() => {}} />
                    {monthlyTarget > 0 && (
                        <div className="mt-4 space-y-2">
                            <div className="flex justify-between text-sm font-semibold">
                                <span>{Utils.formatCurrency(monthlyRevenue)}</span>
                                <span>{Utils.formatCurrency(monthlyTarget)}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-4"><div className="bg-primary h-4 rounded-full" style={{ width: `${Math.min(monthlyProgress, 100)}%` }}></div></div>
                             <p className="text-center font-bold text-lg mt-1" style={{color: 'var(--color-primary)'}}>{monthlyProgress.toFixed(1)}%</p>
                        </div>
                    )}
                     <div className="mt-6 pt-4 border-t">
                        <h3 className="font-semibold text-lg mb-2">Rekapitulasi Laba/Rugi</h3>
                        <div className="text-sm space-y-2 max-h-40 overflow-y-auto">
                            {monthlyRecap.map(item => (
                                <div key={item.yearMonth} className="flex justify-between">
                                    <span className="font-semibold">{new Date(item.yearMonth + '-02').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
                                    <span className={`font-bold ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{Utils.formatCurrency(item.profit)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QayzanStudioPage;