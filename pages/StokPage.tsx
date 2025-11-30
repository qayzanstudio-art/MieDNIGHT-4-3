
import React, { useState } from 'react';
import type { AppData, InventoryItem } from '../types';

interface StokPageProps {
    data: AppData;
    setData: React.Dispatch<React.SetStateAction<AppData>>;
    helpers: {
        showToast: (message: string) => void;
    }
}

const StokPage: React.FC<StokPageProps> = ({ data, setData, helpers }) => {
    const [adjValues, setAdjValues] = useState<{ [key: string]: string }>({});

    const handleAdjValueChange = (id: string, value: string) => {
        setAdjValues(prev => ({ ...prev, [id]: value }));
    };

    const handleAdjustStock = (id: string, action: 'add' | 'set') => {
        const value = parseInt(adjValues[id] || '0', 10);
        if (isNaN(value)) {
            helpers.showToast('Masukkan jumlah valid.');
            return;
        }

        setData(prevData => {
            const newInventory = prevData.inventory.map(item => {
                if (item.id === id) {
                    const newQuantity = action === 'add' ? item.quantity + value : value;
                    return { ...item, quantity: newQuantity < 0 ? 0 : newQuantity };
                }
                return item;
            });
            return { ...prevData, inventory: newInventory };
        });
        
        handleAdjValueChange(id, ''); // Clear input
        helpers.showToast('Stok diperbarui!');
    };
    
    return (
        <div className="bg-white p-4 rounded-lg card-shadow text-on-secondary">
            <h2 className="text-xl font-bold mb-4 border-b pb-2">Manajemen Stok Bahan</h2>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-secondary-dark">
                        <tr>
                            <th className="p-3">Nama Bahan</th>
                            <th className="p-3">Sisa Stok</th>
                            <th className="p-3">Stok Minimal</th>
                            <th className="p-3">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.inventory.map(item => {
                            const isLow = item.quantity <= item.minStock;
                            return (
                                <tr key={item.id} className={`border-b ${isLow ? 'bg-red-50' : ''}`}>
                                    <td className={`p-3 font-semibold ${isLow ? 'text-red-700' : ''}`}>{item.name} {isLow && <span className="text-xs font-normal">(Stok Rendah)</span>}</td>
                                    <td className={`p-3 font-bold text-lg ${isLow ? 'text-red-700' : ''}`}>{item.quantity}</td>
                                    <td className="p-3">{item.minStock}</td>
                                    <td className="p-3">
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="number" 
                                                value={adjValues[item.id] || ''}
                                                onChange={e => handleAdjValueChange(item.id, e.target.value)}
                                                className="stock-adj-input w-20 border-gray-300 rounded-md text-gray-800" 
                                                placeholder="Jml"
                                            />
                                            <button onClick={() => handleAdjustStock(item.id, 'add')} className="adj-stock-btn bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600">+</button>
                                            <button onClick={() => handleAdjustStock(item.id, 'set')} className="adj-stock-btn bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600">Set</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default StokPage;
