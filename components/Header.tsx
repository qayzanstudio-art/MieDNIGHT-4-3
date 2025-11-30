
import React from 'react';
import type { Tab } from '../types';

interface HeaderProps {
    activeTab: Tab;
    setActiveTab: (tab: Tab) => void;
    isMonitoring: boolean;
    onGoHome: () => void;
}

const LogoIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M10.5579 14.8569C12.6775 14.544 14.544 12.6775 14.8569 10.5579C15.0357 9.40059 14.7373 8.2433 14.0392 7.33932C12.4826 5.34024 9.65976 5.34024 8.10318 7.33932C6.96426 8.81456 6.96426 11.1854 8.10318 12.6607C9.00717 13.8978 10.245 14.544 10.5579 14.8569ZM12 20.25C12.4142 20.25 12.75 19.9142 12.75 19.5V18.75C16.5939 18.75 19.75 15.5939 19.75 11.75C19.75 7.90609 16.5939 4.75 12.75 4.75C12.3358 4.75 12 4.41421 12 4C12 3.58579 11.6642 3.25 11.25 3.25C6.00736 3.25 2.25 7.50736 2.25 12.75C2.25 18.25 8.75 20.25 12 20.25Z" />
    </svg>
);

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, isMonitoring, onGoHome }) => {
    const tabs: { key: Tab; label: string }[] = [
        { key: 'kasir', label: 'KASIR' },
        { key: 'pesanan', label: 'PESANAN' },
        { key: 'laporan', label: 'LAPORAN' },
        // Stok tab removed
        { key: 'pengaturan', label: 'PENGATURAN' },
        { key: 'qayzan', label: 'QAYZAN STUDIO' },
    ];

    return (
        <header className="bg-primary text-on-primary shadow-lg sticky top-0 z-20">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <LogoIcon className="w-8 h-8 text-on-primary" />
                        <h1 className="text-3xl font-bold">Mie-dNight</h1>
                    </div>
                    <div className="flex items-center space-x-1 md:space-x-2">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`tab-btn py-4 px-2 md:px-4 text-sm md:text-base font-semibold ${activeTab === tab.key ? 'active' : 'border-b-4 border-transparent'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                         {isMonitoring && (
                            <button
                                onClick={onGoHome}
                                className="ml-4 flex items-center gap-2 bg-gray-100 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-200 transition text-sm"
                                title="Kembali ke layar utama untuk memilih tanggal"
                            >
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                                </svg>
                                <span>Kembali ke Home</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};
