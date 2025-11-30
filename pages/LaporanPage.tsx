import React, { useMemo, useRef } from 'react';
import type { AppData } from '../types';
import { Utils } from '../App';

declare const html2canvas: any;

interface LaporanPageProps {
    data: AppData;
    businessDate: string;
}

const LaporanPage: React.FC<LaporanPageProps> = ({ data, businessDate }) => {
    const todayStr = businessDate;
    const reportRef = useRef<HTMLDivElement>(null);
    
    const dailyReportData = useMemo(() => {
        const dailyTrx = data.transactions.filter(t => t.createdAt && t.createdAt.startsWith(todayStr) && t.payment.status === 'Sudah Bayar');
        const totalOmzet = dailyTrx.reduce((s, t) => s + t.total, 0);
        const cashSales = dailyTrx.filter(t => t.payment.method === 'Cash').reduce((s, t) => s + t.total, 0);
        const qrisSales = dailyTrx.filter(t => t.payment.method === 'QRIS').reduce((s, t) => s + t.total, 0);
        return { dailyTrx, totalOmzet, cashSales, qrisSales };
    }, [data.transactions, todayStr]);

    const threeDayRecap = useMemo(() => {
        const recaps = [];
        const today = new Date(todayStr + 'T12:00:00'); // Use midday to avoid timezone issues
        for (let i = 0; i < 3; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().slice(0, 10);
            const log = data.dailyLogs.find(l => l.date === dateStr);
            recaps.push({
                date: dateStr,
                revenue: log?.manualRevenue ?? 0,
            });
        }
        const total = recaps.reduce((sum, item) => sum + item.revenue, 0);
        return { recaps, total };
    }, [data.dailyLogs, todayStr]);

    const monthlyReport = useMemo(() => {
        const currentMonth = todayStr.slice(0, 7); // YYYY-MM
        const monthlyRevenue = data.dailyLogs
            .filter(log => log.date.startsWith(currentMonth))
            .reduce((sum, log) => sum + (log.manualRevenue || 0), 0);
        return { month: currentMonth, total: monthlyRevenue };
    }, [data.dailyLogs, todayStr]);

    const handleDownloadReport = () => {
        if (reportRef.current) {
            const reportElement = reportRef.current;
            const scrollableList = reportElement.querySelector('.report-scrollable-list') as HTMLElement | null;

            // Temporarily modify styles before capture to show all content
            if (scrollableList) {
                scrollableList.style.maxHeight = 'none';
                scrollableList.style.overflowY = 'visible';
            }

            html2canvas(reportElement, {
                useCORS: true,
                scale: 2 // Increase scale for better resolution
            }).then(canvas => {
                const link = document.createElement('a');
                link.download = `laporan-miednight-${todayStr}.png`;
                link.href = canvas.toDataURL('image/png');
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }).finally(() => {
                // Revert styles back after capture to restore UI
                if (scrollableList) {
                    scrollableList.style.maxHeight = '';
                    scrollableList.style.overflowY = '';
                }
            });
        }
    };

    return (
        <div ref={reportRef} className="bg-white p-6 rounded-lg card-shadow text-on-secondary">
            <div className="flex justify-between items-start mb-4">
                 <div>
                    <h2 className="text-2xl font-bold">Laporan Penjualan</h2>
                    <p className="text-base font-medium text-gray-600">{new Date(todayStr + 'T00:00:00').toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
                <button 
                    onClick={handleDownloadReport}
                    className="btn-primary font-bold py-2 px-4 rounded-lg hover:btn-primary-dark transition text-sm flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <span>Download Laporan</span>
                </button>
            </div>
            
            {/* Daily Report */}
            <div className="mb-6 pb-4 border-b">
                <h3 className="text-xl font-semibold mb-3">Ringkasan Hari Ini</h3>
                <div className="space-y-2">
                    <div className="flex justify-between items-baseline"><span>Total Omzet</span><strong className="text-xl" style={{color: 'var(--color-primary)'}}>{Utils.formatCurrency(dailyReportData.totalOmzet)}</strong></div>
                    <div className="flex justify-between items-baseline"><span>Tunai (Cash)</span><strong>{Utils.formatCurrency(dailyReportData.cashSales)}</strong></div>
                    <div className="flex justify-between items-baseline"><span>Non-Tunai (QRIS)</span><strong>{Utils.formatCurrency(dailyReportData.qrisSales)}</strong></div>
                </div>
                <h4 className="text-lg font-semibold mt-4 mb-2">Daftar Transaksi Terbayar Hari Ini ({dailyReportData.dailyTrx.length})</h4>
                {dailyReportData.dailyTrx.length > 0 ? (
                    <ul className="report-scrollable-list space-y-2 text-sm max-h-60 overflow-y-auto pr-2">{dailyReportData.dailyTrx.map(trx => (
                        <li key={trx.id} className="bg-gray-50 p-3 rounded shadow-sm">
                            <div className="flex justify-between items-start">
                                <div className="flex-grow">
                                    <p className="font-bold text-on-secondary">{trx.customerName || `Pesanan #${trx.id.slice(-4)}`}</p>
                                    <div className="text-xs text-gray-500 mt-1">
                                        {trx.items.map((item, idx) => {
                                            const variantStr = item.selectedVariant ? ` (${item.selectedVariant})` : '';
                                            const toppingStr = item.selectedToppings && item.selectedToppings.length > 0 
                                                ? ` + [${item.selectedToppings.map(t => `${t.name} x${t.quantity}`).join(', ')}]` 
                                                : '';
                                            return <div key={idx}>• {item.name}{variantStr} x{item.quantity}{toppingStr}</div>
                                        })}
                                    </div>
                                </div>
                                <div className="text-right flex-shrink-0 ml-4"><p className="font-bold text-base">{Utils.formatCurrency(trx.total)}</p><p className="text-xs text-gray-600">{trx.payment.method}</p></div>
                            </div>
                        </li>
                    ))}</ul>
                ) : <p className="text-sm text-center text-gray-500 py-4">Belum ada pesanan terbayar hari ini.</p>}
            </div>

            {/* 3-Day Recap */}
            <div className="mb-6 pb-4 border-b">
                <h3 className="text-xl font-semibold mb-3">Rekap 3 Hari Terakhir</h3>
                <table className="w-full text-sm">
                    <tbody>
                        {threeDayRecap.recaps.map(recap => (
                            <tr key={recap.date} className="border-b">
                                <td className="py-2 pr-4">{new Date(recap.date + 'T12:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}</td>
                                <td className="py-2 text-right font-semibold">{Utils.formatCurrency(recap.revenue)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="font-bold text-base">
                            <td className="py-2 pr-4">Total 3 Hari</td>
                            <td className="py-2 text-right">{Utils.formatCurrency(threeDayRecap.total)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* Monthly Report */}
            <div>
                <h3 className="text-xl font-semibold mb-3">Laporan Bulanan</h3>
                <div className="bg-secondary-dark p-4 rounded-lg flex justify-between items-center">
                    <span className="font-bold text-lg">Total Omzet Bulan {new Date(monthlyReport.month + '-02').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
                    <span className="font-bold text-2xl" style={{color: 'var(--color-primary)'}}>{Utils.formatCurrency(monthlyReport.total)}</span>
                </div>
                 <p className="text-xs text-gray-500 mt-2 text-center">Ini adalah total dari semua hari penjualan yang tercatat di bulan ini.</p>
            </div>
        </div>
    );
};

export default LaporanPage;