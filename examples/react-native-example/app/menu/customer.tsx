import { Button } from 'components/button';
import { Platform, Text, View } from 'react-native';
import { voidhash } from 'utils/voidhash/local.client';

export default function HomeScreen() {
  const { client } = voidhash.useVoidhash();
  const {
    data: customer,
    isLoading: isCustomerLoading,
    error: customerError
  } = voidhash.useCurrentCustomer();

  if (isCustomerLoading) {
    return null;
  }

  // If no active subscription, show the paywall
  return (
    <View className="flex-1 justify-between bg-black px-4 pt-32 pt-safe-4 pb-safe-offset-4">
      <View>
        <Text className="font-bold text-2xl text-white">Customer</Text>
        <Text className="mt-2 text-zinc-400">
          {JSON.stringify(customer, null, 2)}
        </Text>
        <Text className="mt-2 text-zinc-400">
          {JSON.stringify(customerError, null, 2)}
        </Text>

        {Platform.OS === 'ios' && (
          <View className="mt-4 gap-4">
            <Button
              className="bg-zinc-800"
              onPress={() => client.iosPresentCodeRedemptionSheet()}
              title="Present code redemption sheet"
            />
            <Button
              className="bg-zinc-800"
              onPress={() => client.iosShowManageSubscriptions()}
              title="Show manage subscriptions"
            />
          </View>
        )}
      </View>
    </View>
  );
}
