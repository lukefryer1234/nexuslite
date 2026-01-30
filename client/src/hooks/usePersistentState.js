import { useState, useEffect } from 'react';

/**
 * usePersistentState - useState wrapper that persists to localStorage
 * 
 * @param {string} key - localStorage key (should be unique, e.g., 'nexus_setting_name')
 * @param {any} defaultValue - Default value if nothing in storage
 * @returns {[any, function]} - Same as useState: [state, setState]
 * 
 * @example
 * const [chain, setChain] = usePersistentState('nexus_selected_chain', 'pls');
 */
export function usePersistentState(key, defaultValue) {
    const [state, setState] = useState(() => {
        try {
            const saved = localStorage.getItem(key);
            if (saved !== null) {
                return JSON.parse(saved);
            }
        } catch (err) {
            console.warn(`Failed to load ${key} from localStorage:`, err);
        }
        return defaultValue;
    });

    useEffect(() => {
        try {
            localStorage.setItem(key, JSON.stringify(state));
        } catch (err) {
            console.warn(`Failed to save ${key} to localStorage:`, err);
        }
    }, [key, state]);

    return [state, setState];
}

export default usePersistentState;
