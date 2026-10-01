/*
 * Metro resolves `firebase/auth` → `@firebase/auth`'s "react-native" build at runtime, which exports
 * getReactNativePersistence. The package's TypeScript entry point is the browser build, so declare it.
 */
import type { Persistence } from "firebase/auth";

declare module "firebase/auth" {
  interface ReactNativeAsyncStorage {
    setItem(key: string, value: string): Promise<void>;
    getItem(key: string): Promise<string | null>;
    removeItem(key: string): Promise<void>;
  }
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
