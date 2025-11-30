import React, { useState, useMemo } from 'react';
import type { Settings, DailyLog } from '../types';
import { Utils } from '../App';

interface HomeScreenProps {
    onStartSession: (date: string) => void;
    showModal: (config: any) => void;
    settings: Settings;
    dailyLogs: DailyLog[];
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onStartSession, showModal, settings, dailyLogs }) => {
    const [selectedDate, setSelectedDate] = useState<string>(Utils.getTodayDateString());

    const isDayClosed = useMemo(() => {
        if (!selectedDate) return false;
        return dailyLogs.some(log => log.date === selectedDate && log.isClosed);
    }, [selectedDate, dailyLogs]);

    const handleStartClick = () => {
        if (!selectedDate) return;
        
        const confirmationTitle = isDayClosed ? 'Masuk Mode Monitoring' : 'Konfirmasi Mulai Sesi';
        const confirmationBody = isDayClosed ? 
            <p className="text-gray-800">Sesi penjualan untuk tanggal ini <strong>sudah ditutup</strong>. Anda akan masuk dalam mode hanya-lihat untuk mengaudit atau mengoreksi data. Anda tidak bisa membuat pesanan baru. Lanjutkan?</p>
            : <p className="text-gray-800">Anda akan memulai sesi penjualan untuk tanggal <strong>{new Date(selectedDate + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong>. Apakah Anda siap?</p>;
        const confirmButtonText = isDayClosed ? 'Ya, Lanjutkan' : 'Ya, Mulai Jualan';
        
        showModal({
            title: confirmationTitle,
            body: confirmationBody,
            confirmText: confirmButtonText,
            cancelText: 'Batal',
            onConfirm: () => onStartSession(selectedDate),
        });
    };

    const isDateSelected = !!selectedDate;
    const armyGreen = settings.primaryColor;
    const cream = settings.secondaryColor;
    const fontOnArmy = Utils.getContrastYIQ(armyGreen);
    const fontOnCream = Utils.getContrastYIQ(cream);

    const buttonStyle: React.CSSProperties = {
        backgroundColor: isDateSelected ? armyGreen : cream,
        color: isDateSelected ? fontOnArmy : fontOnCream,
        borderColor: armyGreen,
        transition: 'all 0.3s ease',
    };
    
    const monitoringButtonStyle: React.CSSProperties = {
        backgroundColor: '#f97316', // Orange color for monitoring
        color: '#ffffff',
        borderColor: '#ea580c',
        transition: 'all 0.3s ease',
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-secondary"
            style={{ 
                backgroundImage: settings.backgroundImage ? `url('${settings.backgroundImage}')` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
             }}
        >
            <div className="w-full max-w-md text-center bg-secondary/80 backdrop-blur-md p-8 rounded-2xl shadow-2xl">
                <h1 className="text-5xl font-bold mb-4 text-on-secondary" style={{ color: armyGreen }}>Mie-dNight</h1>
                <p className="text-on-secondary mb-8">Pilih tanggal penjualan untuk memulai sesi.</p>
                
                <div className="mb-8">
                    <label htmlFor="business-date" className="block text-sm font-medium text-on-secondary mb-2">Tanggal Penjualan</label>
                    <input 
                        type="date"
                        id="business-date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full p-3 border-2 border-gray-300 rounded-lg text-lg text-center font-semibold focus:ring-primary focus:border-primary"
                        style={{ color: 'var(--color-text-on-secondary)'}}
                    />
                </div>

                <button
                    onClick={handleStartClick}
                    disabled={!isDateSelected}
                    style={isDayClosed ? monitoringButtonStyle : buttonStyle}
                    className="w-full text-xl font-bold py-4 rounded-lg border-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isDayClosed ? 'Lihat / Monitoring' : 'Mulai Jualan'}
                </button>
            </div>
        </div>
    );
};

export default HomeScreen;