
import React from 'react';
import type { ToastState } from '../types';

export const Toast: React.FC<ToastState> = ({ isVisible, message }) => {
    return (
        <div className={`fixed bottom-5 right-5 bg-primary text-on-primary px-6 py-3 rounded-lg shadow-xl transform transition-all duration-300 ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
        }`}>
            <p>{message}</p>
        </div>
    );
};
