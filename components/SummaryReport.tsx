import React, { useRef } from 'react';
import type { SummaryData } from '../types';
import { Utils } from '../App';

declare const html2canvas: any;

interface SummaryReportProps {
    data: SummaryData;
    onClose: () => void;
}

export const SummaryReport: React.FC<SummaryReportProps> = ({ data, onClose }) => {
    const reportRef = useRef<HTMLDivElement>(null);

    const handleDownload = () => {
        if (reportRef.current) {
            const reportElement = reportRef.current;
            const scrollableList = reportElement.querySelector('.summary-scrollable-list') as HTMLElement | null;

            // Temporarily modify styles before capture to show all content
            if (scrollableList) {
                scrollableList.style.maxHeight = 'none';
                scrollableList.style.overflowY = 'visible';
            }

            html2canvas(reportElement, { scale: 2 }).then(canvas => {
                const link = document.createElement('a');
                link.download = `ringkasan-penjualan-${data.date}.png`;
                link.href = canvas.toDataURL();
                link.click();
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg transform transition-all">
                <div ref={reportRef} className="p-6 bg-white rounded-t-xl">
                    <div className="text-center mb-4">
                        <h2 className="text-2xl font-bold text-gray-800">Ringkasan Penjualan</h2>
                        <p className="text-base font-medium text-gray-600">
                            {new Date(data.date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </p>
                    </div>
                    <div className="space-y-2 text-gray-700 border-t border-b py-3 mb-3">
                        <div className="flex justify-between items-baseline"><span>Total Omzet</span><strong className="text-xl text-primary">{Utils.formatCurrency(data.totalOmzet)}</strong></div>
                        <div className="flex justify-between items-baseline"><span>Tunai (Cash)</span><strong>{Utils.formatCurrency(data.cashSales)}</strong></div>
                        <div className="flex justify-between items-baseline"><span>Non-Tunai (QRIS)</span><strong>{Utils.formatCurrency(data.qrisSales)}</strong></div>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">Daftar Transaksi Terbayar ({data.transactions.length})</h3>
                    <div className="summary-scrollable-list max-h-60 overflow-y-auto pr-2 border rounded-md p-2 bg-gray-50">
                        {data.transactions.length > 0 ? (
                            <ul className="space-y-2 text-sm">
                                {data.transactions.map(trx => (
                                    <li key={trx.id} className="border-b last:border-0 pb-2 mb-2 text-gray-700">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-grow">
                                                <p className="font-semibold">{trx.customerName || `Pesanan #${trx.id.slice(-4)}`}</p>
                                                <p className="text-xs text-gray-500 mb-1">{Utils.formatTime(trx.createdAt)} - {trx.payment.method}</p>
                                                <ul className="text-xs text-gray-600 pl-2">
                                                    {trx.items.map((item, idx) => (
                                                        <li key={idx} className="mb-0.5">
                                                            {item.quantity}x {item.name} {item.selectedVariant && `(${item.selectedVariant})`}
                                                            {item.selectedToppings && item.selectedToppings.length > 0 && (
                                                                <span className="block text-gray-500 italic pl-2">+ {item.selectedToppings.map(t => `${t.name} x${t.quantity}`).join(', ')}</span>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <p className="font-bold whitespace-nowrap">{Utils.formatCurrency(trx.total)}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-center text-gray-500 py-4">Tidak ada transaksi terbayar.</p>
                        )}
                    </div>
                </div>
                <div className="bg-gray-100 px-6 py-4 rounded-b-xl flex justify-between items-center">
                    <button 
                        onClick={handleDownload}
                        className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition text-sm flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M3 17.25A2.75 2.75 0 015.75 20h8.5A2.75 2.75 0 0117 17.25v-8.5A2.75 2.75 0 0114.25 6H5.75A2.75 2.75 0 013 8.75v8.5zM4.5 8.75a1.25 1.25 0 011.25-1.25h8.5a1.25 1.25 0 011.25 1.25v8.5a1.25 1.25 0 01-1.25-1.25h-8.5a1.25 1.25 0 01-1.25-1.25v-8.5z" /><path d="M10 4a.75.75 0 01.75.75v6.5a.75.75 0 01-1.5 0v-6.5A.75.75 0 0110 4zM8.28 8.03a.75.75 0 011.06-1.06l2 2a.75.75 0 11-1.06 1.06l-2-2z" /><path d="M11.72 8.03a.75.75 0 010 1.06l-2 2a.75.75 0 01-1.06-1.06l2-2a.75.75 0 011.06 0z" /></svg>
                        Download
                    </button>
                    <button
                        onClick={onClose}
                        className="text-gray-600 font-bold text-2xl hover:text-gray-900 transition"
                        aria-label="Close"
                    >
                        &times;
                    </button>
                </div>
            </div>
        </div>
    );
};