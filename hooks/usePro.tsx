import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  Purchase,
  PurchaseError,
} from 'react-native-iap';

export const PRO_PRODUCT_ID = 'finpath_pro';
const PRO_STORE_KEY = 'finpath_pro_status';

interface ProContextType {
  isPro: boolean;
  loading: boolean;
  purchasing: boolean;
  errorMessage: string | null;
  purchasePro: () => Promise<void>;
  restorePurchases: () => Promise<void>;
  clearError: () => void;
}

const ProContext = createContext<ProContextType>({
  isPro: false,
  loading: true,
  purchasing: false,
  errorMessage: null,
  purchasePro: async () => {},
  restorePurchases: async () => {},
  clearError: () => {},
});

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const purchaseListenerRef = useRef<any>(null);
  const errorListenerRef = useRef<any>(null);

  const unlockPro = useCallback(async () => {
    await SecureStore.setItemAsync(PRO_STORE_KEY, '1');
    setIsPro(true);
  }, []);

  const clearError = useCallback(() => setErrorMessage(null), []);

  // Restore from SecureStore + Play Store on mount
  useEffect(() => {
    let active = true;

    async function init() {
      try {
        // Check locally first for instant load
        const stored = await SecureStore.getItemAsync(PRO_STORE_KEY);
        if (stored === '1' && active) setIsPro(true);

        // Connect to Play Store
        await initConnection();

        // Listen for purchase updates
        purchaseListenerRef.current = purchaseUpdatedListener(async (purchase: Purchase) => {
          if (purchase.productId === PRO_PRODUCT_ID) {
            await finishTransaction({ purchase, isConsumable: false });
            await unlockPro();
          }
        });

        errorListenerRef.current = purchaseErrorListener((error: PurchaseError) => {
          if (__DEV__) console.error('IAP error:', error);
          setErrorMessage(`Billing error: ${error?.code || ''} ${error?.message || 'Unknown error'}`);
        });

        // Silently restore to catch purchases made on other devices
        const available = await getAvailablePurchases();
        const hasPro = available.some(p => p.productId === PRO_PRODUCT_ID);
        if (hasPro && active) await unlockPro();
      } catch (e) {
        if (__DEV__) console.error('IAP init error:', e);
      } finally {
        if (active) setLoading(false);
      }
    }

    init();

    return () => {
      active = false;
      purchaseListenerRef.current?.remove();
      errorListenerRef.current?.remove();
      try { endConnection(); } catch {}
    };
  }, [unlockPro]);

  const purchasePro = useCallback(async () => {
    setPurchasing(true);
    try {
      await fetchProducts({ skus: [PRO_PRODUCT_ID], type: "in-app" });
      await requestPurchase({
        request: {
          google: {
            skus: [PRO_PRODUCT_ID],
          },
        },
        type: "in-app",
      });
      // Result handled by purchaseUpdatedListener
    } catch (e: any) {
      if (__DEV__) console.error('Purchase error:', e);
      setErrorMessage(`Purchase failed: ${e?.code || ''} ${e?.message || 'Unknown error'}`);
    } finally {
      setPurchasing(false);
    }
  }, []);

  const restorePurchases = useCallback(async () => {
    setPurchasing(true);
    try {
      const available = await getAvailablePurchases();
      const hasPro = available.some(p => p.productId === PRO_PRODUCT_ID);
      if (hasPro) await unlockPro();
    } catch (e) {
      if (__DEV__) console.error('Restore error:', e);
    } finally {
      setPurchasing(false);
    }
  }, [unlockPro]);

  return (
    <ProContext.Provider value={{ isPro, loading, purchasing, errorMessage, purchasePro, restorePurchases, clearError }}>
      {children}
    </ProContext.Provider>
  );
}

export function usePro() {
  return useContext(ProContext);
}
