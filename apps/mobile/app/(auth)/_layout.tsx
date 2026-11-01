import { Stack } from "expo-router";

/** Login, Blocked and Bind Device: no header, the root gate decides which one is shown. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, animation: "fade" }} />;
}
