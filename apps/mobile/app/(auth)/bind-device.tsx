import * as Device from "expo-device";
import { AlertCircle, LogOut, ShieldCheck, Smartphone } from "lucide-react-native";
import { useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AUTH_COPY } from "@/components/auth/copy";
import { LanguageToggle } from "@/components/auth/language-toggle";
import { Spinner } from "@/components/gluestack/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import { reportError } from "@/lib/api";
import { errorMessage } from "@/lib/messages";
import { usePreferences } from "@/lib/preferences";
import { useSession } from "@/lib/session";

/**
 * Bind Device (core flow 2): first login on a phone. bind-device stores only HMAC(pepper, id)
 * of the installation ID (D-05). A second phone gets DEVICE_MISMATCH until the admin resets it.
 */
export default function BindDeviceScreen() {
  const { bindThisPhone, signOut, profile } = useSession();
  const { lang, t } = usePreferences();
  const c = AUTH_COPY[lang];
  const other = AUTH_COPY[lang === "en" ? "fil" : "en"];

  const [working, setWorking] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const model = [Device.manufacturer, Device.modelName].filter(Boolean).join(" ") || c.unknownModel;
  const platform = Platform.OS === "ios" ? "iOS" : "Android";

  const bind = async () => {
    setWorking(true);
    setErrorCode(null);
    try {
      const res = await bindThisPhone();
      // Success re-evaluates the session; the root gate then opens the tabs.
      if (!res.ok) setErrorCode(res.code);
    } catch (e) {
      void reportError("Device binding failed unexpectedly", { error: e instanceof Error ? e.message : String(e) });
      setErrorCode("INTERNAL_ERROR");
    } finally {
      setWorking(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background-subtle" edges={["top", "bottom"]}>
      <ScrollView contentContainerClassName="flex-grow justify-center gap-6 px-4 py-8">
        <View className="items-end">
          <LanguageToggle />
        </View>

        <View className="items-center">
          <View className="h-20 w-20 items-center justify-center rounded-full bg-brand/15">
            <Icon as={Smartphone} size={40} className="text-brand" />
          </View>
        </View>

        <Card>
          <CardHeader>
            <CardTitle className="text-center text-xl" accessibilityRole="header">
              {c.bindTitle}
            </CardTitle>
            <CardDescription className="text-center">{other.bindTitle}</CardDescription>
          </CardHeader>
          <CardContent className="gap-4">
            {profile?.full_name ? <Text className="font-semibold">{profile.full_name}</Text> : null}
            <Text>{c.bindBody}</Text>

            <View className="flex-row items-center gap-3 rounded-md bg-muted p-3">
              <Icon as={Smartphone} size={20} className="text-muted-foreground" />
              <View className="flex-1">
                <Text className="text-xs text-muted-foreground">{c.bindModel}</Text>
                <Text className="font-medium" testID="bind-model">
                  {model} · {platform}
                </Text>
              </View>
            </View>

            <View className="flex-row gap-3">
              <Icon as={ShieldCheck} size={20} className="text-brand" />
              <Text className="flex-1 text-sm text-muted-foreground">{c.bindPrivacy}</Text>
            </View>

            {errorCode ? (
              <Alert variant="destructive" icon={AlertCircle} accessibilityLiveRegion="assertive">
                <AlertDescription>{errorMessage(errorCode, lang)}</AlertDescription>
                {errorCode === "DEVICE_MISMATCH" || errorCode === "ACCOUNT_NOT_ACTIVE" ? (
                  <AlertDescription className="text-muted-foreground">{t("contactAdmin")}</AlertDescription>
                ) : null}
              </Alert>
            ) : null}

            {working ? (
              <View className="flex-row items-center justify-center gap-2" accessibilityLiveRegion="polite">
                <Spinner size="small" className="text-brand" />
                <Text className="text-sm text-muted-foreground">{c.binding}</Text>
              </View>
            ) : null}

            <Separator />
            <Text className="text-sm text-muted-foreground">{other.bindBody}</Text>
          </CardContent>
        </Card>

        <View className="gap-3">
          <Button className="min-h-touch" onPress={() => void bind()} disabled={working}>
            <Icon as={Smartphone} size={16} className="text-primary-foreground" />
            <Text>{c.bindButton}</Text>
          </Button>
          <Button variant="outline" className="min-h-touch" onPress={() => void signOut()} disabled={working}>
            <Icon as={LogOut} size={16} />
            <Text>{t("logout")}</Text>
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
