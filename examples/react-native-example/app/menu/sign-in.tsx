import { useRouter } from 'expo-router';
import { Image, Pressable, Text, View } from 'react-native';
import { fakeAuthService, users } from 'utils/fake-auth-service';
import { voidhash } from 'utils/voidhash/client';

export default function HomeScreen() {
  const router = useRouter();

  const handleSignIn = async (email: string) => {
    const user = await fakeAuthService.signIn(email);

    // This syncs the current user with Voidhash. Make sure the identifier passed is unique and hard to guess.
    await voidhash.client.identify(user.id, {
      email: user.email,
      name: user.name
    });

    router.back();
  };

  return (
    <View className="flex-1 justify-between bg-black px-4 pt-32 pt-safe-4 pb-safe-offset-4">
      <View>
        <Text className="font-bold text-2xl text-white">Sign in</Text>
        <Text className="mt-2 text-zinc-400">Tap to sign in</Text>
        <View className="mt-8 flex flex-row gap-8">
          {Object.values(users).map((user) => (
            <Pressable
              className="aspect-square flex-1"
              key={user.id}
              onPress={() => handleSignIn(user.email)}
            >
              <Image className="h-full w-full" source={user.avatar} />
              <View className="pt-4">
                <Text className="font-semibold text-white">{user.name}</Text>
                <Text className="mt-2 text-zinc-400">{user.email}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
