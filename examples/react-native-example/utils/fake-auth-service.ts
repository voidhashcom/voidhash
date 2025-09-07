import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';

type User = {
  id: string;
  email: string;
  name: string;
  avatar: ImageSourcePropType;
};

export const users: Record<string, User> = {
  daisy: {
    id: '837b3d38-d8d3-4a97-9137-5bfdb6c14577', // Strong, unique id
    email: 'daisy@duck.com',
    name: 'Daisy',
    avatar: require('../assets/images/daisy.png')
  },
  john: {
    id: '7208b0f5-56c9-48e8-976f-b1be5ccdb029',
    email: 'john@wick.com',
    name: 'John',
    avatar: require('../assets/images/john.png')
  }
};

let cachedUser: User | null = null;

const fakeAuthServiceEventListeners = new Set<() => void>();
function notifyAuthStateChanged() {
  for (const listener of fakeAuthServiceEventListeners) {
    listener();
  }
}

export const fakeAuthService = {
  onSignIn(listener: () => void) {
    fakeAuthServiceEventListeners.add(listener);
    return () => {
      fakeAuthServiceEventListeners.delete(listener);
    };
  },

  async signIn(email: string) {
    const user = Object.values(users).find((user) => user.email === email);
    if (!user) {
      throw new Error('User not found');
    }

    await AsyncStorage.setItem('fake-auth:signed-in-user', user.id);
    cachedUser = user;
    notifyAuthStateChanged();
    return user;
  },

  async getCurrentUser() {
    if (cachedUser) {
      return cachedUser;
    }

    const userId = await AsyncStorage.getItem('fake-auth:signed-in-user');
    if (!userId) {
      return null;
    }

    const user = Object.values(users).find((user) => user.id === userId);
    return user ?? null;
  },

  async signOut() {
    await AsyncStorage.removeItem('fake-auth:signed-in-user');
    cachedUser = null;
    notifyAuthStateChanged();
  }
};

export const useCurrentUser = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = fakeAuthService.onSignIn(() => {
      fakeAuthService.getCurrentUser().then((user) => {
        setUser(user);
      });
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fakeAuthService
      .getCurrentUser()
      .then((user) => {
        setUser(user);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return { user, isLoading };
};
