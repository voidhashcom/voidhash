import type { SubscriptionProduct } from '@voidhash/react-native/build/core/entities/product';
import { Button } from 'components/button';
import { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { voidhash } from 'utils/voidhash/client';
import { cn } from '../../utils/lib';

export default function HomeScreen() {
  const [selectedProduct, setSelectedProduct] =
    useState<SubscriptionProduct | null>(null);

  const { purchase, isLoading: isPurchasing } = voidhash.usePurchase();
  const { data: products, isLoading: areProductsLoading } =
    voidhash.useProducts();

  if (areProductsLoading) {
    return null;
  }

  const handleProductPress = (product: SubscriptionProduct) => {
    setSelectedProduct(product);
  };

  const handlePurchase = () => {
    if (!selectedProduct) {
      return;
    }
    purchase(selectedProduct);
  };

  // Select the first product after everything is loaded
  if (!selectedProduct && products.toList().length > 0) {
    handleProductPress(products.toList()[0]);
  }

  // If no active subscription, show the paywall
  return (
    <View className="flex-1 justify-between bg-black px-4 pt-32 pt-safe-4 pb-safe-offset-4">
      <View>
        <Text className="font-bold text-2xl text-white">
          Unlock Full Access
        </Text>
        <Text className="mt-2 text-zinc-400">Choose a plan to continue:</Text>
        <View className="mt-6 w-full gap-y-4">
          {products.toList().map((product) => (
            <TouchableOpacity
              activeOpacity={0.8}
              className={cn(
                'w-full flex-row rounded-lg border border-zinc-900 bg-zinc-950 p-3',
                selectedProduct?.slug === product.slug && 'bg-zinc-900'
              )}
              disabled={isPurchasing}
              key={product.slug}
              onPress={() => handleProductPress(product)}
            >
              <View className="flex-1">
                <Text className="text-white text-xl">{product.name}</Text>
                <Text className="mt-1 text-sm text-zinc-400">
                  {product.name}
                </Text>
              </View>
              <Text className="font-semibold text-white text-xl">
                {Math.round(product.price * 100) / 100}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Button
          className="mt-4"
          onPress={handlePurchase}
          // disabled={!selectedProduct || isPurchasing}
          title={isPurchasing ? 'Purchasing...' : 'Continue'}
        />
      </View>
    </View>
  );
}
