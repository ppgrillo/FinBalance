import React, { useEffect, useState } from 'react';
import { subscriptionService } from '../services/subscriptionService';
import { Icons } from './Icons';
import { useToast } from '../context/ToastContext';

interface PaywallProps {
    onClose: () => void;
    onSuccess: () => void;
}

export const Paywall: React.FC<PaywallProps> = ({ onClose, onSuccess }) => {
    const { success, error } = useToast();
    const [packages, setPackages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadOfferings();
    }, []);

    const loadOfferings = async () => {
        const offerings = await subscriptionService.getOfferings();
        setPackages(offerings);
        setLoading(false);
    };

    const handlePurchase = async (pkg: any) => {
        setLoading(true);
        const isSuccess = await subscriptionService.purchase(pkg);
        if (isSuccess) {
            success("¡Gracias por tu compra! 🌟");
            onSuccess();
        } else {
            setLoading(false);
        }
    };

    const handleRestore = async () => {
        setLoading(true);
        const isSuccess = await subscriptionService.restorePurchases();
        if (isSuccess) {
            success("Compras restauradas correctamente.");
            onSuccess();
        } else {
            error("No se encontraron compras activas.");
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative">

                {/* Header Image/Gradient */}
                <div className="h-32 bg-gradient-to-br from-primary via-purple-600 to-blue-600 flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-black/10"></div>
                    <Icons.Star size={64} className="text-white/90 drop-shadow-lg" fill="currentColor" />
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full transition-colors"
                    >
                        <Icons.Close size={20} />
                    </button>
                </div>

                <div className="p-8">
                    <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Desbloquea FinBalance Pro</h2>
                    <p className="text-center text-gray-500 mb-8">Lleva tus finanzas al siguiente nivel con herramientas potenciadas por IA.</p>

                    <div className="space-y-4 mb-8">
                        <FeatureRow icon={<Icons.Brain size={20} className="text-purple-500" />} text="Consultas de IA Ilimitadas" />
                        <FeatureRow icon={<Icons.Cloud size={20} className="text-blue-500" />} text="Sincronización en la Nube" />
                        <FeatureRow icon={<Icons.Chart size={20} className="text-green-500" />} text="Análisis de Gastos Avanzado" />
                        <FeatureRow icon={<Icons.Shield size={20} className="text-orange-500" />} text="Soporte Prioritario" />
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-8">
                            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                        </div>
                    ) : packages.length > 0 ? (
                        <div className="grid gap-3">
                            {packages.map((pkg) => (
                                <button
                                    key={pkg.identifier}
                                    onClick={() => handlePurchase(pkg)}
                                    className="w-full py-4 px-6 rounded-xl border-2 border-primary/10 hover:border-primary bg-primary/5 hover:bg-primary/10 transition-all flex justify-between items-center group"
                                >
                                    <div className="text-left">
                                        <span className="block font-bold text-primary group-hover:scale-105 transition-transform">
                                            {pkg.product.title}
                                        </span>
                                        <span className="text-xs text-gray-500">{pkg.packageType === 'ANNUAL' ? 'Mejor Valor' : 'Flexible'}</span>
                                    </div>
                                    <span className="font-bold text-lg text-gray-800">{pkg.product.priceString}</span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-gray-400 py-4 border-2 border-dashed border-gray-200 rounded-xl">
                            <p>No hay planes disponibles por el momento.</p>
                            <p className="text-xs mt-1">(Configura RevenueCat para ver precios)</p>
                        </div>
                    )}

                    <button
                        onClick={handleRestore}
                        className="w-full mt-6 text-sm text-gray-400 hover:text-gray-600 underline"
                    >
                        Restaurar Compras Anteriores
                    </button>
                </div>
            </div>
        </div>
    );
};

const FeatureRow = ({ icon, text }: { icon: any, text: string }) => (
    <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
        <span className="font-medium text-gray-700">{text}</span>
    </div>
);
