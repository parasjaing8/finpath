import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  initConnection,
  endConnection,
  getProducts,
  requestPurchase,
  getAvailablePurchases,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  ProductPurchase,
  PurchaseError,
} from 'react-native-iap';

export const PRO_PRODUCT_ID = 'finpath_pro';
const PRO_STORE_KEY = 'finpath_pro_status';

interface ProContextType {
  isPro: boolean;
  loading: boolean;
  purchasing: boolean;
  purchasePro: () => Promise<void>;
  restorePurchases: () => Promise<void>;
}

const ProContext = createContext<ProContextType>({
  isPro: false,
  loading: true,
  purchasing: false,
  purchasePro: async () => {},
  restorePurchases: async () => {},
});

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const purchaseListenerRef = useRef<any>(null);
  const errorListenerRef = useRef<any>(null);

  const unlockPro = useCallback(async () => {
    await SecureStore.setItemAsync(PRO_STORE_KEY, '1');
    setIsPro(true);
  }, []);

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
        purchaseListenerRef.current = purchaseUpdatedListener(async (purchase: ProductPurchase) => {
          if (purchase.productId === PRO_PRODUCT_ID) {
            await finishTransaction({ purchase, isConsumable: false });
            await unlockPro();
          }
        });

        errorListenerRef.current = purchaseErrorListener((error: PurchaseError) => {
          if (__DEV__) console.error('IAP error:', error);
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
      await getProducts({ skus: [PRO_PRODUCT_ID] });
      await requestPurchase({ skus: [PRO_PRODUCT_ID] });
      // Result handled by purchaseUpdatedListener
    } catch (e) {
      if (__DEV__) console.error('Purchase error:', e);
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
    <ProContext.Provider value={{ isPro, loading, purchasing, purchasePro, restorePurchases }}>
      {children}
    </ProContext.Provider>
  );
}

export function usePro() {
  return useContext(ProContext);
}
