import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { createContext, useState, useEffect, ReactNode } from "react";
import { removeAuthToken } from "@/lib/api";
import {
  User,
  SignUpParams,
  AuthResponse,
  loginApi,
  verify2FALoginApi,
  signUpApi,
  logoutApi,
  getCurrentUserApi,
  updateProfileApi,
} from "@/services/auth-service";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  complete2FALogin: (email: string, otp: string) => Promise<User>;
  signUp: (params: SignUpParams | string, email?: string, password?: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (data: Partial<User> & { fullName?: string }) => Promise<User>;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  signIn: async () => ({}),
  complete2FALogin: async () => ({ id: "", name: "", email: "", role: "user" }),
  signUp: async () => {},
  signOut: async () => {},
  updateUser: async () => ({ id: "", name: "", email: "", role: "user" }),
  refreshUser: async () => {},
});

// Module-scoped session cache: survives Fast Refresh and hot reload cycles in memory
let inMemoryUser: User | null = null;
let inMemoryAuthInitialized = false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(inMemoryUser);
  const [isLoading, setIsLoadingState] = useState<boolean>(!inMemoryAuthInitialized);

  const setUser = (newUser: User | null | ((prev: User | null) => User | null)) => {
    setUserState((prev) => {
      const resolved = typeof newUser === "function" ? newUser(prev) : newUser;
      inMemoryUser = resolved;
      return resolved;
    });
  };

  const setIsLoading = (loading: boolean) => {
    inMemoryAuthInitialized = !loading;
    setIsLoadingState(loading);
  };

  const refreshUser = async () => {
    try {
      const currentUser = await getCurrentUserApi();
      setUser(currentUser);
    } catch {
      setUser(null);
    }
  };

  useEffect(() => {
    let isMounted = true;

    // Check cached user first for instant UI
    AsyncStorage.getItem("localfarm_cached_user")
      .then((cached) => {
        if (isMounted && cached) {
          try {
            const parsed = JSON.parse(cached);
            setUser((prev) => prev || parsed);
          } catch {}
        }
      })
      .catch(() => {});

    // Check stored JWT session on app boot
    getCurrentUserApi()
      .then((currentUser) => {
        if (isMounted) {
          if (currentUser) {
            setUser((prev) => ({ ...(prev || {}), ...currentUser }));
            AsyncStorage.setItem(
              "localfarm_cached_user",
              JSON.stringify(currentUser),
            ).catch(() => {});
          } else {
            setUser(null);
            AsyncStorage.removeItem("localfarm_cached_user").catch(() => {});
          }
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<AuthResponse> => {
    setIsLoading(true);
    try {
      const response = await loginApi(email, password);
      if (response.requires2FA) {
        return response;
      }
      if (response.user) {
        setUser(response.user);
        await AsyncStorage.setItem(
          "localfarm_cached_user",
          JSON.stringify(response.user),
        );
      }
      return response;
    } finally {
      setIsLoading(false);
    }
  };

  const complete2FALogin = async (email: string, otp: string): Promise<User> => {
    setIsLoading(true);
    try {
      const response = await verify2FALoginApi(email, otp);
      setUser(response.user);
      await AsyncStorage.setItem(
        "localfarm_cached_user",
        JSON.stringify(response.user),
      );
      return response.user;
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (
    params: SignUpParams | string,
    email?: string,
    password?: string,
  ) => {
    setIsLoading(true);
    try {
      const response = await signUpApi(params, email, password);
      if (response.user) {
        setUser(response.user);
        await AsyncStorage.setItem(
          "localfarm_cached_user",
          JSON.stringify(response.user),
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateUser = async (data: Partial<User> & { fullName?: string }) => {
    try {
      const res = await updateProfileApi(data);
      const mergedUser = { ...res.user, ...data };
      setUser(mergedUser);
      await AsyncStorage.setItem(
        "localfarm_cached_user",
        JSON.stringify(mergedUser),
      );
      return mergedUser;
    } catch {
      // Fallback: update local state if backend call fails or runs offline
      let updatedUser: User | null = null;
      setUser((prev) => {
        if (!prev) return null;
        updatedUser = {
          ...prev,
          ...data,
          name: data.fullName || data.name || prev.name,
          fullName: data.fullName || data.name || prev.fullName,
          about: data.about !== undefined ? data.about : prev.about,
          bio:
            data.bio !== undefined
              ? data.bio
              : data.about !== undefined
                ? data.about
                : prev.bio,
        };
        return updatedUser;
      });
      if (updatedUser) {
        await AsyncStorage.setItem(
          "localfarm_cached_user",
          JSON.stringify(updatedUser),
        );
        return updatedUser;
      }
      return { ...data } as any;
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await logoutApi();
    } catch (err) {
      console.error("Logout error", err);
    } finally {
      try {
        await AsyncStorage.removeItem("localfarm_cached_user");
        await removeAuthToken();
      } catch {}
      if (typeof window !== "undefined" && window.localStorage) {
        try {
          window.localStorage.removeItem("localfarm_auth_token");
          window.localStorage.removeItem("localfarm_cached_user");
          window.localStorage.removeItem("localfarm_user");
        } catch {}
      }
      inMemoryUser = null;
      setUser(null);
      setIsLoading(false);
      try {
        router.replace("/auth/Login" as any);
      } catch (navErr) {
        console.warn("Navigation replace error:", navErr);
        if (typeof window !== "undefined" && window.location) {
          window.location.href = "/auth/Login";
        }
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        complete2FALogin,
        signUp,
        signOut,
        updateUser,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


