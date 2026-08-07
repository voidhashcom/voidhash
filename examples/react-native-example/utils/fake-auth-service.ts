import AsyncStorage from "@react-native-async-storage/async-storage";
import { Data, Effect } from "effect";
import { useEffect, useState } from "react";
import type { ImageSourcePropType } from "react-native";

import daisyAvatar from "../assets/images/daisy.png";
import johnAvatar from "../assets/images/john.png";

interface User {
  id: string;
  email: string;
  name: string;
  avatar: ImageSourcePropType;
}

export const users: Record<string, User> = {
  daisy: {
    id: "837b3d38-d8d3-4a97-9137-5bfdb6c14577", // Strong, unique id
    email: "daisy@duck.com",
    name: "Daisy",
    avatar: daisyAvatar,
  },
  john: {
    avatar: johnAvatar,
    email: "john@wick.com",
    id: "7208b0f5-56c9-48e8-976f-b1be5ccdb029",
    name: "John",
  },
};

const STORAGE_KEY = "fake-auth:signed-in-user";

class AuthStorageError extends Data.TaggedError("AuthStorageError")<{
  readonly cause: unknown;
}> {}

class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{
  readonly email: string;
}> {}

let cachedUser: User | null = null;

const fakeAuthServiceEventListeners = new Set<() => void>();
function notifyAuthStateChanged() {
  for (const listener of fakeAuthServiceEventListeners) {
    listener();
  }
}

const storage = <A>(run: () => Promise<A>) =>
  Effect.tryPromise({ try: run, catch: (cause) => new AuthStorageError({ cause }) });

const getCurrentUser = Effect.gen(function* () {
  if (cachedUser) {
    return cachedUser;
  }

  const userId = yield* storage(() => AsyncStorage.getItem(STORAGE_KEY));
  if (!userId) {
    return null;
  }

  const user = Object.values(users).find((candidate) => candidate.id === userId);
  return user ?? null;
});

const signIn = (email: string) =>
  Effect.gen(function* () {
    const user = Object.values(users).find((candidate) => candidate.email === email);
    if (!user) {
      return yield* new UserNotFoundError({ email });
    }

    yield* storage(() => AsyncStorage.setItem(STORAGE_KEY, user.id));
    cachedUser = user;
    notifyAuthStateChanged();
    return user;
  });

const signOut = Effect.gen(function* () {
  yield* storage(() => AsyncStorage.removeItem(STORAGE_KEY));
  cachedUser = null;
  notifyAuthStateChanged();
});

export const fakeAuthService = {
  getCurrentUser: () => Effect.runPromise(getCurrentUser),

  onSignIn(listener: () => void) {
    fakeAuthServiceEventListeners.add(listener);
    return () => {
      fakeAuthServiceEventListeners.delete(listener);
    };
  },

  signIn: (email: string) => Effect.runPromise(signIn(email)),

  signOut: () => Effect.runPromise(signOut),
};

export const useCurrentUser = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = fakeAuthService.onSignIn(() => {
      void fakeAuthService.getCurrentUser().then((user) => {
        setUser(user);
      });
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setIsLoading(true);
    void fakeAuthService
      .getCurrentUser()
      .then((user) => {
        setUser(user);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  return { isLoading, user };
};
