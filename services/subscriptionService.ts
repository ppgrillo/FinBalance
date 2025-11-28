import { Purchases, PurchasesPackage, CustomerInfo, LOG_LEVEL } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

// API Keys
const API_KEYS = {
    android: 'test_GTjYGOUPWpXnrHEfnWSZMtkTgGi', // Provided by user
    ios: 'appl_PLACEHOLDER_IOS_KEY'
};

const ENTITLEMENT_ID = 'Ovejas Electronicas Pro';

export const subscriptionService = {

    initialize: async () => {
        if (Capacitor.getPlatform() === 'web') {
            console.log("RevenueCat not supported on Web directly. Use Stripe.");
            return;
        }

        try {
            await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });

            if (Capacitor.getPlatform() === 'android') {
                await Purchases.configure({ apiKey: API_KEYS.android });
            } else if (Capacitor.getPlatform() === 'ios') {
                await Purchases.configure({ apiKey: API_KEYS.ios });
            }

        } catch (e) {
            console.error("Error initializing RevenueCat", e);
        }
    },

    getOfferings: async (): Promise<PurchasesPackage[]> => {
        if (Capacitor.getPlatform() === 'web') return [];
        try {
            const offerings = await Purchases.getOfferings();
            if (offerings.current && offerings.current.availablePackages.length > 0) {
                return offerings.current.availablePackages;
            }
        } catch (e) {
            console.error("Error fetching offerings", e);
        }
        return [];
    },

    purchase: async (pkg: PurchasesPackage): Promise<boolean> => {
        try {
            const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
            return subscriptionService.checkEntitlement(customerInfo);
        } catch (e: any) {
            if (!e.userCancelled) {
                console.error("Purchase error", e);
                // alert("Error en la compra: " + e.message);
            }
            return false;
        }
    },

    restorePurchases: async (): Promise<boolean> => {
        try {
            const { customerInfo } = await Purchases.restorePurchases();
            return subscriptionService.checkEntitlement(customerInfo);
        } catch (e) {
            console.error("Restore error", e);
            return false;
        }
    },

    checkSubscriptionStatus: async (): Promise<boolean> => {
        if (Capacitor.getPlatform() === 'web') return false; // Or true if testing
        try {
            const { customerInfo } = await Purchases.getCustomerInfo();
            return subscriptionService.checkEntitlement(customerInfo);
        } catch (e) {
            return false;
        }
    },

    checkEntitlement: (info: CustomerInfo): boolean => {
        const entitlement = info.entitlements.active[ENTITLEMENT_ID];
        return entitlement !== undefined;
    },

    // Native Paywall (Android/iOS only)
    presentPaywall: async (): Promise<boolean> => {
        if (Capacitor.getPlatform() === 'web') return false;
        try {
            // This will show the native RevenueCat Paywall configured in the dashboard
            // Note: Requires 'RevenueCatUI' to be included in the native project if not using the latest plugin version that bundles it.
            // The Capacitor plugin exposes this via presentPaywallIfNeeded or similar in newer versions.
            // Checking if the method exists on the plugin object (it might be named differently in v9 vs v10)
            // For v9/v10 compatibility we try the standard method:
            // @ts-ignore
            if (Purchases.presentPaywall) {
                // @ts-ignore
                await Purchases.presentPaywall();
                // After paywall closes, check status again
                return subscriptionService.checkSubscriptionStatus();
            }
            return false;
        } catch (e) {
            console.error("Error presenting paywall", e);
            return false;
        }
    },

    // Customer Center (Self-Service Portal)
    presentCustomerCenter: async () => {
        if (Capacitor.getPlatform() === 'web') return;
        try {
            // @ts-ignore
            if (Purchases.presentCustomerCenter) {
                // @ts-ignore
                await Purchases.presentCustomerCenter();
            }
        } catch (e) {
            console.error("Error presenting customer center", e);
        }
    }
};
