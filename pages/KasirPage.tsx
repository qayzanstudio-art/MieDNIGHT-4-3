
import React, { useMemo, useCallback, useState } from 'react';
import type { AppData, Order, MenuItem, Topping, Drink, OrderItem, SelectedTopping } from '../types';
import { Utils } from '../App';

interface KasirPageProps {
    data: AppData;
    setData: React.Dispatch<React.SetStateAction<AppData>>;
    currentOrder: Order;
    setCurrentOrder: React.Dispatch<React.SetStateAction<Order>>;
    helpers: {
        showToast: (message: string) => void;
    };
    isTodayClosed: boolean;
    businessDate: string;
}

const getNewOrder = (): Order => ({
    id: null, items: [], customerName: '', payment: { status: 'Belum Bayar', method: 'Cash' }, createdAt: null, total: 0
});

const KasirPage: React.FC<KasirPageProps> = ({ data, setData, currentOrder, setCurrentOrder, helpers, isTodayClosed, businessDate }) => {
    const { showToast } = helpers;
    
    // --- BUILDER MODAL STATE ---
    const [builderOpen, setBuilderOpen] = useState(false);
    const [buildingItem, setBuildingItem] = useState<MenuItem | null>(null);
    const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null); // Track if we are editing an existing cart item
    
    // Builder State
    const [selectedVariant, setSelectedVariant] = useState<string | null>(null);
    const [selectedToppings, setSelectedToppings] = useState<SelectedTopping[]>([]);
    const [itemQuantity, setItemQuantity] = useState<number>(1);
    
    // Special Mie Double State
    const [doubleStep, setDoubleStep] = useState<'type' | 'flavor' | 'toppings' | null>(null);
    const [doubleTypeSelection, setDoubleTypeSelection] = useState<string | null>(null); // 'Goreng' or 'Kuah'

    // Calculate total price of a single item including its toppings
    const calculateItemPrice = (item: OrderItem) => {
        const basePrice = item.price;
        const toppingsPrice = item.selectedToppings?.reduce((sum, t) => sum + (t.price * t.quantity), 0) || 0;
        return (basePrice + toppingsPrice) * item.quantity;
    };

    const calculateOrderTotal = useCallback((items: OrderItem[]) => {
        return items.reduce((sum, item) => sum + calculateItemPrice(item), 0);
    }, []);

    // Helper to commit changes to the order (used by Builder)
    const commitToOrder = useCallback((itemToAdd: MenuItem | Topping | Drink, variant?: string, toppings: SelectedTopping[] = [], quantity: number = 1, editIndex: number | null = null) => {
        setCurrentOrder(prevOrder => {
            let orderToUpdate = { ...prevOrder };
            
            // Initialize ID/Time if new
            if (!orderToUpdate.id && orderToUpdate.items.length === 0) {
                if (isTodayClosed) return prevOrder; // Guard handled in UI but safety check here
                const now = new Date();
                const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
                orderToUpdate.createdAt = `${businessDate}T${timeStr}`;
                orderToUpdate.id = `TRX-${Date.now()}`;
            }

            const newItemObj: OrderItem = {
                ...itemToAdd,
                quantity: quantity,
                selectedVariant: variant,
                selectedToppings: toppings,
                isDelivered: false // New items / Add-ons are always Undelivered by default
            };

            let newItems = [...orderToUpdate.items];

            if (editIndex !== null && editIndex >= 0 && editIndex < newItems.length) {
                // UPDATE existing item at specific index
                // Note: If we edit an item, we usually want to keep its delivery status unless it's a major change.
                // However, user requested "tambahan yang di edit akan muncul... dan belum di centang".
                // If the user is editing an EXISTING delivered item to add toppings, logic suggests it's a modification that needs attention.
                // But typically, 'Add-ons' are done via adding NEW items, not editing old ones.
                // We will preserve status here for simple edits, but rely on the "Add New" logic below for the "Tambahan" use case.
                
                // If the item was already delivered and we are changing it (e.g. adding toppings), 
                // strictly speaking it's a new prep request.
                // But to be safe and simple: Updates keep status, New Additions get False.
                newItemObj.isDelivered = newItems[editIndex].isDelivered;
                newItems[editIndex] = newItemObj;
            } else {
                // ADD new item
                // Check for duplicates to merge if exactly same config
                // CRITICAL CHANGE: Do NOT merge if the existing item is already DELIVERED.
                // We want a separate line for the new "Add-on" so it appears unchecked.
                
                const toppingsKey = toppings.sort((a, b) => a.id.localeCompare(b.id)).map(t => `${t.id}:${t.quantity}:${t.price}`).join(',');
                
                const existingItemIndex = newItems.findIndex(item => 
                    item.id === itemToAdd.id && 
                    item.selectedVariant === variant &&
                    (item.selectedToppings?.sort((a, b) => a.id.localeCompare(b.id)).map(t => `${t.id}:${t.quantity}:${t.price}`).join(',') || '') === toppingsKey &&
                    !item.isDelivered // <--- Only merge with items that are NOT yet delivered
                );

                if (existingItemIndex > -1) {
                    newItems[existingItemIndex] = { 
                        ...newItems[existingItemIndex], 
                        quantity: newItems[existingItemIndex].quantity + quantity 
                    };
                } else {
                    newItems.push(newItemObj);
                }
            }

            return {
                ...orderToUpdate,
                items: newItems,
                total: calculateOrderTotal(newItems),
            };
        });
    }, [setCurrentOrder, isTodayClosed, businessDate, calculateOrderTotal]);


    // Click handler for Menu Items (Opens Builder or Adds directly)
    const handleItemClick = useCallback((itemToAdd: MenuItem | Topping | Drink) => {
        if (isTodayClosed) {
            showToast('Mode Monitoring: Tidak bisa menambah pesanan baru.');
            return;
        }

        const isMainMenu = data.menu.some(m => m.id === itemToAdd.id);

        // If Side Dish / Drink -> Add directly (Default Qty 1)
        if (!isMainMenu) {
            commitToOrder(itemToAdd, undefined, [], 1);
            return;
        }

        const itemNameLower = itemToAdd.name.toLowerCase();

        // LOGIC: Mie Bangladesh Complete -> Special Modal
        if (itemNameLower.includes('complete')) {
            openBuilder(itemToAdd as MenuItem);
            return;
        }

        // LOGIC: Nasi Ayam Panggang -> Direct Add (No Builder)
        if (itemNameLower.includes('nasi')) {
            commitToOrder(itemToAdd, undefined, [], 1);
            return;
        }

        // LOGIC: Only "Mie" items open the builder
        if (itemNameLower.includes('mie')) {
            openBuilder(itemToAdd as MenuItem);
        } else {
            // Fallback for other potential main menu items not named 'Mie' or 'Nasi'
            commitToOrder(itemToAdd, undefined, [], 1);
        }

    }, [isTodayClosed, showToast, commitToOrder, data.menu, data.toppings]);


    // --- BUILDER LOGIC ---

    const openBuilder = (item: MenuItem, editIndex: number | null = null, existingData: OrderItem | null = null) => {
        setBuildingItem(item);
        setEditingItemIndex(editIndex);
        
        if (existingData) {
            // Pre-fill builder with existing data
            setSelectedVariant(existingData.selectedVariant || null);
            setSelectedToppings(existingData.selectedToppings || []);
            setItemQuantity(existingData.quantity);
            
            // Handle Mie Double Logic for Editing
            if (item.name.toLowerCase().includes('mie double')) {
                if (existingData.selectedVariant) {
                     setDoubleStep('toppings'); // Jump straight to full edit
                } else {
                     setDoubleStep('type');
                }
            } else {
                setDoubleStep(null);
            }
        } else {
            // Reset for new item
            setSelectedToppings([]);
            setSelectedVariant(null);
            setItemQuantity(1);
            
            if (item.name.toLowerCase().includes('mie double')) {
                setDoubleStep('type');
                setDoubleTypeSelection(null);
            } else {
                 setDoubleStep(null);
            }
        }
        
        setBuilderOpen(true);
    };

    const handleBuilderFinish = () => {
        if (buildingItem) {
            commitToOrder(buildingItem, selectedVariant || undefined, selectedToppings, itemQuantity, editingItemIndex);
            
            // Cleanup
            setBuilderOpen(false);
            setBuildingItem(null);
            setEditingItemIndex(null);
            setSelectedToppings([]);
            setSelectedVariant(null);
            setDoubleStep(null);
            setItemQuantity(1);
        }
    };

    const handleCompleteMenuEggSelection = (eggName: string) => {
        if (!buildingItem) return;

        // Bundle components for Mie Bangladesh Complete
        // Prices must be 0 to keep the main item price (30000) as the total
        const includedToppingsNames = ['Sosis', 'Pangsit', 'Bakso 2 pcs', 'Tahu'];
        
        const autoToppings: SelectedTopping[] = [];
        
        // Add standard included toppings
        includedToppingsNames.forEach(name => {
            const topping = data.toppings.find(t => t.name === name);
            if (topping) {
                autoToppings.push({ ...topping, quantity: 1, price: 0 });
            }
        });

        // Add selected egg
        const eggTopping = data.toppings.find(t => t.name === eggName);
        if (eggTopping) {
            autoToppings.push({ ...eggTopping, quantity: 1, price: 0 });
        }

        // Commit immediately
        commitToOrder(buildingItem, undefined, autoToppings, 1, editingItemIndex);
        setBuilderOpen(false);
        setBuildingItem(null);
    };

    const updateBuilderToppingQty = (topping: Topping, delta: number | 'manual', manualVal?: number) => {
        setSelectedToppings(prev => {
            const existingIndex = prev.findIndex(t => t.id === topping.id);
            let newQty = 0;
            
            if (existingIndex > -1) {
                if (delta === 'manual') {
                    newQty = manualVal ?? 0;
                } else {
                    newQty = prev[existingIndex].quantity + delta;
                }
            } else {
                // Adding new
                if (delta === 'manual') {
                    newQty = manualVal ?? 0;
                } else {
                    newQty = delta > 0 ? delta : 0;
                }
            }

            if (newQty <= 0) {
                return prev.filter(t => t.id !== topping.id);
            }

            if (existingIndex > -1) {
                const newToppings = [...prev];
                newToppings[existingIndex] = { ...newToppings[existingIndex], quantity: newQty };
                return newToppings;
            } else {
                return [...prev, { ...topping, quantity: newQty }];
            }
        });
    };

    // --- CART MANIPULATION HANDLERS ---
    
    // 1. Update Main Item Quantity
    const handleUpdateItemQty = useCallback((index: number, newQty: number) => {
        setCurrentOrder(prevOrder => {
            if (newQty <= 0) {
                const newItems = prevOrder.items.filter((_, i) => i !== index);
                return { ...prevOrder, items: newItems, total: calculateOrderTotal(newItems) };
            }
            
            const newItems = [...prevOrder.items];
            const currentItem = newItems[index];

            // IF item is already delivered and we are increasing quantity:
            // It is cleaner to separate it into a new line item, but simpler UI-wise to just block or warn.
            // However, for best UX based on user request "tambahan", we assume they use the Menu buttons to add new items.
            // If they use this + button on a delivered item, we will just update quantity but it stays 'delivered'.
            // To properly handle "Add-ons", using the Menu Buttons (commitToOrder) is preferred as it creates new lines.
            
            newItems[index] = { ...currentItem, quantity: newQty };
            return { ...prevOrder, items: newItems, total: calculateOrderTotal(newItems) };
        });
    }, [setCurrentOrder, calculateOrderTotal]);

    // 2. Update Specific Topping Quantity in Cart
    const handleUpdateCartToppingQty = (itemIndex: number, toppingIndex: number, delta: number) => {
        setCurrentOrder(prevOrder => {
            const newItems = [...prevOrder.items];
            const item = { ...newItems[itemIndex] }; // Copy item
            const newToppings = item.selectedToppings ? [...item.selectedToppings] : []; // Copy toppings array
            
            const currentQty = newToppings[toppingIndex].quantity;
            const newQty = currentQty + delta;

            if (newQty <= 0) {
                // Remove topping if 0
                newToppings.splice(toppingIndex, 1);
            } else {
                // Update qty
                newToppings[toppingIndex] = { ...newToppings[toppingIndex], quantity: newQty };
            }

            item.selectedToppings = newToppings;
            newItems[itemIndex] = item;
            
            return { ...prevOrder, items: newItems, total: calculateOrderTotal(newItems) };
        });
    };

    // 3. Edit Cart Item (Re-open Builder)
    const handleEditCartItem = (index: number) => {
        const item = currentOrder.items[index];
        const originalMenuItem = data.menu.find(m => m.id === item.id) || data.drinks.find(d => d.id === item.id) || data.toppings.find(t => t.id === item.id);
        
        if (originalMenuItem && data.menu.some(m => m.id === originalMenuItem.id)) {
             const itemNameLower = item.name.toLowerCase();
             // Prevent editing for Nasi items (no builder available)
             if (itemNameLower.includes('nasi')) {
                 showToast("Item ini tidak memiliki opsi topping.");
                 return;
             }
             
             // Only open builder for Main Menu items
             openBuilder(originalMenuItem as MenuItem, index, item);
        } else {
            showToast("Item ini tidak memiliki opsi edit lanjutan.");
        }
    };

    // --- RENDER BUILDER MODAL ---
    const renderBuilderModal = () => {
        if (!builderOpen || !buildingItem) return null;

        let title = `Custom: ${buildingItem.name}`;
        let content = null;
        const itemNameLower = buildingItem.name.toLowerCase();

        // --- SPECIAL: MIE BANGLADESH COMPLETE ---
        if (itemNameLower.includes('complete')) {
            title = "Pilih Jenis Telur (Harga Paket Termasuk)";
            content = (
                <div className="grid grid-cols-1 gap-4 py-4">
                    <p className="text-sm text-gray-500 text-center mb-2">
                        Pilih jenis telur untuk paket komplit ini. Topping lain (Sosis, Pangsit, Bakso, Tahu) akan otomatis ditambahkan.
                    </p>
                    <button onClick={() => handleCompleteMenuEggSelection("Telur Dadar")} className="p-6 bg-yellow-50 border-2 border-yellow-200 rounded-xl font-bold hover:border-primary hover:bg-yellow-100 text-xl text-yellow-900 shadow-sm transition-all active:scale-95 flex flex-col items-center">
                        🍳 Telur Dadar
                    </button>
                    <button onClick={() => handleCompleteMenuEggSelection("Telur Mata Sapi")} className="p-6 bg-orange-50 border-2 border-orange-200 rounded-xl font-bold hover:border-primary hover:bg-orange-100 text-xl text-orange-900 shadow-sm transition-all active:scale-95 flex flex-col items-center">
                        🍳 Telur Mata Sapi
                    </button>
                </div>
            );
        }
        else {
            // --- STANDARD BUILDER LOGIC ---

            // --- STEP 1: VARIANT SELECTION (Or Double Logic) ---
            let showVariantStep = false;
            
            if (itemNameLower.includes('mie double')) {
                if (doubleStep === 'type') {
                    title = "Pilih Jenis Mie";
                    content = (
                        <div className="grid grid-cols-1 gap-3">
                            {["Mie Goreng", "Mie Kuah"].map(type => (
                                <button key={type} onClick={() => { setDoubleTypeSelection(type); setDoubleStep('flavor'); }} className="p-4 bg-gray-50 border-2 border-gray-200 rounded-lg font-bold hover:border-primary hover:text-primary hover:bg-green-50 text-lg">{type}</button>
                            ))}
                        </div>
                    );
                } else if (doubleStep === 'flavor') {
                    const targetName = doubleTypeSelection === "Mie Goreng" ? "Mie Goreng" : "Mie Kuah";
                    title = `Pilih Rasa ${targetName}`;
                    const refItem = data.menu.find(m => m.name.toLowerCase() === targetName.toLowerCase());
                    const opts = refItem?.variants || (doubleTypeSelection === "Mie Goreng" ? ["Original", "Aceh"] : ["Soto", "Ayam Bawang"]);
                    
                    content = (
                        <div className="grid grid-cols-1 gap-3">
                            {opts.map(v => (
                                <button key={v} onClick={() => { 
                                    setSelectedVariant(`${doubleTypeSelection?.replace('Mie ', '')} - ${v}`);
                                    setDoubleStep('toppings'); 
                                }} className="p-3 bg-gray-50 border-2 border-gray-200 rounded-lg font-bold hover:border-primary hover:text-primary hover:bg-green-50 text-lg">{v}</button>
                            ))}
                        </div>
                    );
                }
            } else if (!selectedVariant && buildingItem.variants && buildingItem.variants.length > 0) {
                // Standard Item Variant Selection
                title = `Pilih Varian ${buildingItem.name}`;
                content = (
                    <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto">
                        {buildingItem.variants.map(v => (
                            <button key={v} onClick={() => setSelectedVariant(v)} className="p-3 bg-gray-50 border-2 border-gray-200 rounded-lg font-bold hover:border-primary hover:text-primary hover:bg-green-50 text-lg">{v}</button>
                        ))}
                    </div>
                );
            }

            // --- STEP 2: TOPPING & QTY SELECTION ---
            const isStandardReady = !itemNameLower.includes('mie double') && 
                                            (!buildingItem.variants || buildingItem.variants.length === 0 || selectedVariant);
            const isDoubleReady = doubleStep === 'toppings';

            if (isStandardReady || isDoubleReady) {
                title = `${buildingItem.name} ${selectedVariant ? `(${selectedVariant})` : ''}`;
                const currentToppingsPrice = selectedToppings.reduce((s,t)=>s+(t.price*t.quantity),0);
                
                content = (
                    <div className="flex flex-col h-full">
                        <div className="flex-grow overflow-y-auto mb-4 pr-1">
                            
                            {/* Main Item Quantity Input */}
                            <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-100 flex items-center justify-between">
                                <span className="font-bold text-lg text-gray-800">Jumlah Porsi</span>
                                <div className="flex items-center gap-3">
                                    <button onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))} className="w-10 h-10 rounded-full bg-white border border-gray-300 text-xl font-bold hover:bg-gray-100">-</button>
                                    <input 
                                        type="number" 
                                        value={itemQuantity} 
                                        onChange={(e) => setItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                                        className="w-20 text-center text-2xl font-bold bg-transparent border-b-2 border-primary focus:outline-none"
                                    />
                                    <button onClick={() => setItemQuantity(itemQuantity + 1)} className="w-10 h-10 rounded-full bg-white border border-gray-300 text-xl font-bold hover:bg-gray-100">+</button>
                                </div>
                            </div>

                            <p className="mb-3 text-base font-bold text-gray-700">Pilih Topping (Ketuk untuk tambah)</p>
                            <div className="space-y-3">
                                {data.toppings.map(topping => {
                                    const selected = selectedToppings.find(t => t.id === topping.id);
                                    const qty = selected ? selected.quantity : 0;
                                    
                                    return (
                                        <div 
                                            key={topping.id} 
                                            className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer select-none transition-all active:scale-95 ${qty > 0 ? 'bg-green-50 border-primary ring-1 ring-primary' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                            onClick={() => updateBuilderToppingQty(topping, 1)} // Tap whole card to add
                                        >
                                            <div>
                                                <div className="font-bold text-gray-800">{topping.name}</div>
                                                <div className="text-xs text-gray-500">{Utils.formatCurrency(topping.price)} / pcs</div>
                                            </div>
                                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                {qty > 0 && (
                                                    <button onClick={() => updateBuilderToppingQty(topping, -1)} className="w-8 h-8 rounded bg-red-100 text-red-600 font-bold hover:bg-red-200 z-10">-</button>
                                                )}
                                                {qty > 0 && (
                                                    <input 
                                                        type="number"
                                                        value={qty}
                                                        onChange={(e) => updateBuilderToppingQty(topping, 'manual', parseInt(e.target.value))}
                                                        className="w-12 text-center font-bold bg-transparent border-b border-primary text-primary"
                                                    />
                                                )}
                                                {qty === 0 && <span className="text-gray-300 text-2xl font-light">+</span>}
                                                {qty > 0 && (
                                                    <button onClick={() => updateBuilderToppingQty(topping, 1)} className="w-8 h-8 rounded bg-green-100 text-green-600 font-bold hover:bg-green-200 z-10">+</button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                        <button onClick={handleBuilderFinish} className="w-full btn-primary py-4 rounded-lg font-bold text-lg shadow-lg flex justify-between px-6">
                            <span>{editingItemIndex !== null ? 'Simpan Perubahan' : 'Tambah ke Pesanan'}</span>
                            <span>{Utils.formatCurrency((buildingItem.price + currentToppingsPrice) * itemQuantity)}</span>
                        </button>
                    </div>
                );
            }
        }

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all scale-100 flex flex-col max-h-[90vh]">
                    <div className="bg-primary p-4 text-white flex justify-between items-center flex-shrink-0">
                        <h3 className="text-lg font-bold truncate pr-4">{title}</h3>
                        <button onClick={() => { setBuilderOpen(false); setDoubleStep(null); setEditingItemIndex(null); }} className="text-white hover:text-gray-200 text-2xl font-bold">&times;</button>
                    </div>
                    <div className="p-4 overflow-y-auto flex-grow bg-gray-50">
                        {content}
                    </div>
                    {/* Render Cancel button for standard flows, but not necessarily for the simple egg selection if not wanted, though good for UX */}
                     <div className="p-3 bg-white text-center border-t flex-shrink-0">
                        <button onClick={() => { setBuilderOpen(false); setDoubleStep(null); setEditingItemIndex(null); }} className="text-gray-500 font-medium hover:text-gray-800">Batal</button>
                    </div>
                </div>
            </div>
        );
    };
    
    const handleOrderChange = (field: keyof Order, value: any) => {
        setCurrentOrder(prev => ({ ...prev, [field]: value }));
    };

    const handlePaymentChange = (field: 'status' | 'method', value: string) => {
        setCurrentOrder(prev => ({
            ...prev,
            payment: { ...prev.payment, [field]: value }
        }));
    };

    const isEditMode = useMemo(() => currentOrder.id && data.transactions.some(t => t.id === currentOrder.id), [currentOrder.id, data.transactions]);

    const renderMenuSelection = () => {
        // --- SEPARATE MENU ITEMS ---
        const specialMenu = data.menu.filter(m => {
            const lowerName = m.name.toLowerCase();
            return lowerName.includes('complete') || lowerName.includes('nasi ayam');
        });
        
        const regularMenu = data.menu.filter(m => {
             const lowerName = m.name.toLowerCase();
             return !lowerName.includes('complete') && !lowerName.includes('nasi ayam');
        });

        const renderItems = (items: (MenuItem | Topping | Drink)[], type: 'special' | 'menu' | 'toppings') => items.map(item => {
            const isSpecial = type === 'special';
            const baseClass = `p-3 rounded-xl text-center shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col justify-between items-center h-full active:scale-95 transform relative overflow-hidden group`;
            
            let style: React.CSSProperties = {};
            let content = null;

            if (isSpecial) {
                // SPECIAL STYLE (Hero) - Green Theme
                style = {
                    background: 'linear-gradient(to bottom right, var(--color-primary), var(--color-primary-dark))',
                    color: 'var(--color-text-on-primary)',
                    border: '1px solid var(--color-primary-dark)'
                };
                content = (
                    <>
                        <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-2 py-1 rounded-bl-lg shadow-sm">SPESIAL</div>
                        <div className="flex-grow flex flex-col justify-center items-center py-2">
                            <span className="text-2xl mb-2">⭐</span>
                            <span className="font-bold leading-tight text-lg">{item.name}</span>
                        </div>
                        <span className="text-sm font-bold bg-white/20 px-3 py-1 rounded-full">{Utils.formatCurrency(item.price)}</span>
                    </>
                );
            } else if (type === 'menu') {
                // REGULAR MENU STYLE - Cream Background, Green Text
                style = {
                    backgroundColor: 'var(--color-secondary)',
                    color: 'var(--color-primary)',
                    borderColor: 'var(--color-primary)',
                    borderWidth: '1px',
                    borderStyle: 'solid'
                };
                content = (
                    <>
                        <div className="flex-grow flex flex-col justify-center items-center py-2">
                             <span className="text-xl mb-1">🍜</span>
                            <span className="font-bold leading-tight text-sm md:text-base">{item.name}</span>
                        </div>
                        <span className="text-xs font-semibold opacity-80">{Utils.formatCurrency(item.price)}</span>
                    </>
                );
            } else { 
                // TOPPINGS (Inverse) - Green Background, Cream Text
                style = {
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-on-primary)',
                    borderColor: 'var(--color-secondary)',
                    borderWidth: '1px',
                    borderStyle: 'solid'
                };
                content = (
                    <>
                         <span className="font-semibold leading-tight text-sm">{type === 'toppings' ? '+ ' : ''}{item.name}</span>
                         <span className="text-xs mt-1 opacity-80">{Utils.formatCurrency(item.price)}</span>
                    </>
                );
            }

            return (
                <button key={item.id} onClick={() => handleItemClick(item)} className={`${baseClass}`} style={style} disabled={isTodayClosed && !isEditMode}>
                    {content}
                </button>
            );
        });

        return (
            <div className="bg-white p-4 rounded-lg card-shadow text-on-secondary h-full flex flex-col gap-6">
                {isTodayClosed && (
                    <div className="p-3 bg-yellow-100 text-yellow-800 text-center font-bold rounded-md text-sm border border-yellow-300">
                        MODE MONITORING: Sesi penjualan hari ini sudah ditutup. Anda hanya bisa mengedit pesanan yang ada.
                    </div>
                )}
                
                {/* HERO SECTION: MIE-DNIGHT SPESIAL */}
                <div className="rounded-2xl p-4 shadow-inner" style={{ backgroundColor: 'var(--color-secondary-dark)' }}>
                    <h3 className="font-bold text-xl mb-3 flex items-center gap-2 tracking-wide uppercase" style={{ color: 'var(--color-primary)' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                        MieDNIGHT Spesial
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {renderItems(specialMenu, 'special')}
                    </div>
                </div>

                {/* REGULAR MENU */}
                <div>
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2 border-b pb-2" style={{ color: 'var(--color-primary)' }}>
                        <span className="text-xl">🍜</span> Menu Lainnya
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {renderItems(regularMenu, 'menu')}
                    </div>
                </div>

                {/* EXTRAS / TOPPINGS (No Drinks) */}
                <div className="pt-4 border-t">
                    <h3 className="font-bold text-sm uppercase tracking-wider mb-3" style={{ color: 'var(--color-primary)' }}>Tambahan / Piring Terpisah</h3>
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{renderItems(data.toppings, 'toppings')}</div>
                     <p className="text-[10px] text-gray-400 mt-2 italic text-center">*Klik Menu Utama untuk menambah topping ke dalam mangkok.</p>
                </div>
            </div>
        );
    };

    const PesananPageActions = () => {
        const handleProcessOrder = () => {
            if (currentOrder.items.length === 0) {
                 showToast('Pesanan kosong!');
                 return;
            }

            if (isEditMode && currentOrder.createdAt) {
                // Allow editing
            } else if (!isEditMode && isTodayClosed) {
                showToast('Hari ini sudah ditutup, tidak bisa membuat pesanan baru.');
                return;
            }

            setData(prevData => {
                const newTransactions = [...prevData.transactions];
                const existingIndex = newTransactions.findIndex(t => t.id === currentOrder.id);
                const isUpdating = existingIndex !== -1;
                const orderToSave = JSON.parse(JSON.stringify(currentOrder));

                if (isUpdating) {
                    newTransactions[existingIndex] = orderToSave;
                } else {
                    newTransactions.unshift(orderToSave);
                }
                
                showToast(isUpdating ? 'Pesanan diperbarui!' : 'Pesanan diproses!');
                setCurrentOrder(getNewOrder());

                return { ...prevData, transactions: newTransactions };
            });
        };

        const handleClearOrder = () => {
            setCurrentOrder(getNewOrder());
        };

        return (
            <>
                <button onClick={handleProcessOrder} disabled={currentOrder.items.length === 0} className="w-full btn-primary font-bold py-3 rounded-lg shadow hover:btn-primary-dark transition disabled:bg-gray-400">
                    {isEditMode ? 'Simpan Perubahan' : 'Proses Pesanan'}
                </button>
                <button onClick={handleClearOrder} className="w-full bg-gray-200 text-gray-700 font-bold py-2 rounded-lg shadow hover:bg-gray-300 transition mt-2">
                    {isEditMode ? 'Batal Edit / Pesanan Baru' : 'Reset'}
                </button>
            </>
        );
    };

    const renderOrderSummary = () => (
        <div className="bg-white p-4 rounded-lg card-shadow self-start sticky top-24 text-on-secondary">
            {isEditMode && <div className="p-2 mb-3 bg-yellow-200 text-yellow-800 text-center font-bold rounded-md text-sm">MODE EDIT</div>}
            <h2 className="text-xl font-bold mb-4 border-b pb-2">Pesanan Saat Ini</h2>
            <div className="mb-3"><label htmlFor="customerName" className="block text-sm font-medium">Nama/Nomor Meja</label><input type="text" id="customerName" value={currentOrder.customerName} onChange={(e) => handleOrderChange('customerName', e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-primary sm:text-sm text-white disabled:bg-gray-200" disabled={isTodayClosed && !isEditMode}/></div>
            <div className="mb-4 max-h-[50vh] overflow-y-auto pr-2">
                {currentOrder.items.length > 0 ? currentOrder.items.map((item, idx) => (
                    <div key={`${item.id}-${item.selectedVariant || 'def'}-${idx}`} className="py-2 border-b border-dashed">
                        {/* MAIN ITEM ROW */}
                        <div className="flex justify-between items-start">
                            <div className="flex-grow">
                                <span className="text-sm font-bold block">{item.name}</span>
                                {item.selectedVariant && (
                                    <span className="text-xs font-bold text-primary block">
                                        - {item.selectedVariant}
                                    </span>
                                )}
                                {item.isDelivered && (
                                    <span className="text-[10px] bg-green-100 text-green-800 px-1 rounded inline-block mt-1">Sudah Diantar</span>
                                )}
                                <div className="text-xs text-gray-400 mt-1">
                                    @{Utils.formatCurrency(item.price)}
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <div className="flex items-center gap-1 mb-1">
                                    <button onClick={() => handleUpdateItemQty(idx, item.quantity - 1)} className="w-6 h-6 rounded bg-gray-200 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-300">-</button>
                                    <input 
                                        type="number"
                                        className="font-bold text-sm w-8 text-center bg-gray-50 border rounded"
                                        value={item.quantity}
                                        onChange={(e) => handleUpdateItemQty(idx, parseInt(e.target.value) || 0)}
                                    />
                                    <button onClick={() => handleUpdateItemQty(idx, item.quantity + 1)} className="w-6 h-6 rounded bg-gray-200 text-gray-700 font-bold flex items-center justify-center hover:bg-gray-300">+</button>
                                </div>
                                <div className="text-sm font-bold">{Utils.formatCurrency(calculateItemPrice(item))}</div>
                            </div>
                        </div>

                        {/* TOPPINGS LIST WITH CONTROLS */}
                        {item.selectedToppings && item.selectedToppings.length > 0 && (
                            <div className="mt-2 pl-2 space-y-2 border-l-2 border-gray-100 ml-1">
                                {item.selectedToppings.map((t, tIdx) => (
                                    <div key={tIdx} className="flex justify-between items-center text-xs">
                                        <div className="text-gray-600">
                                            + {t.name}
                                            <div className="text-[10px] text-gray-400">@{Utils.formatCurrency(t.price)}</div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {/* Logic to prevent reducing quantity if it was part of a bundle? For now, allow full edit. */}
                                            <button 
                                                onClick={() => handleUpdateCartToppingQty(idx, tIdx, -1)}
                                                className="w-5 h-5 rounded bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-100 font-bold border border-red-100"
                                            >-</button>
                                            <span className="font-bold w-4 text-center">{t.quantity}</span>
                                            <button 
                                                onClick={() => handleUpdateCartToppingQty(idx, tIdx, 1)}
                                                className="w-5 h-5 rounded bg-green-50 text-green-500 flex items-center justify-center hover:bg-green-100 font-bold border border-green-100"
                                            >+</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* EDIT / ADD TOPPING BUTTON FOR MAIN ITEMS */}
                        {data.menu.some(m => m.id === item.id) && !item.name.toLowerCase().includes('nasi') && (
                            <button 
                                onClick={() => handleEditCartItem(idx)}
                                className="mt-2 text-[11px] text-blue-600 font-semibold hover:bg-blue-50 px-2 py-1 rounded w-full text-left flex items-center gap-1 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                {item.selectedToppings && item.selectedToppings.length > 0 ? 'Edit / Tambah Topping' : 'Tambah Topping'}
                            </button>
                        )}
                    </div>
                )) : <p className="text-sm text-gray-500 text-center py-4">Belum ada item dipilih.</p>}
            </div>
            <div className="border-t pt-4">
                <div className="flex justify-between font-bold text-lg mb-4"><span>TOTAL</span><span>{Utils.formatCurrency(currentOrder.total)}</span></div>
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <div><label className="block text-sm font-medium">Status</label><select value={currentOrder.payment.status} onChange={(e) => handlePaymentChange('status', e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-primary sm:text-sm text-white"><option className="text-gray-900">Belum Bayar</option><option className="text-gray-900">Sudah Bayar</option></select></div>
                    <div><label className="block text-sm font-medium">Metode</label><select value={currentOrder.payment.method} onChange={(e) => handlePaymentChange('method', e.target.value)} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-primary sm:text-sm text-white"><option className="text-gray-900">Cash</option><option className="text-gray-900">QRIS</option></select></div>
                </div>
                <PesananPageActions />
            </div>
        </div>
    );
    
    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                <div className="md:col-span-2">{renderMenuSelection()}</div>
                <div className="md:sticky md:top-24">{renderOrderSummary()}</div>
            </div>
            {renderBuilderModal()}
        </>
    );
};

export default KasirPage;
