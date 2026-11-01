import { Redirect } from "expo-router";
import { View } from "react-native";

import { Spinner } from "@/components/gluestack/spinner";
import { useSession } from "@/lib/session";

/**
 * Entry route: sends the user wherever the auth gate says (core flow 2). While the gate is
 * loading the native splash is still up (app/_layout.tsx); the spinner only shows if the
 * session check outlasts the splash timeout on a slow network.
 */
export default function Index() {
  const { gate } = useSession();

  switch (gate.kind) {
    case "signed_out":
      return <Redirect href="/(auth)/login" />;
    case "blocked":
      return <Redirect href="/(auth)/blocked" />;
    case "needs_binding":
      return <Redirect href="/(auth)/bind-device" />;
    case "ready":
      return <Redirect href="/(tabs)" />;
    default:
      return (
        <View className="flex-1 items-center justify-center bg-background">
          <Spinner size="large" className="text-brand" accessibilityLabel="Loading" />
        </View>
      );
  }
}
