import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { FileText, ListChecks, LogOut, ShieldCheck, Smartphone } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { Spinner } from "@/components/gluestack/spinner";
import { formatManilaDateTime } from "@/components/history/dates";
import { L } from "@/components/history/strings";
import { BiometricToggle } from "@/components/profile/biometric-toggle";
import { InfoLine, LinkRow } from "@/components/profile/settings-parts";
import { initialsOf, useBoundDevice, useProfilePhotoUrl } from "@/components/profile/use-profile-data";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import type { Lang } from "@/lib/messages";
import { usePreferences } from "@/lib/preferences";
import { clearOfflineSnapshots } from "@/lib/queries/history";
import { useSession } from "@/lib/session";

type ThemePref = "system" | "light" | "dark";
const THEMES: readonly ThemePref[] = ["system", "light", "dark"];
const isTheme = (v: string): v is ThemePref => (THEMES as readonly string[]).includes(v);

/** Profile & Settings: identity, bound phone, theme, biometric unlock, language, links, logout. */
export default function ProfileScreen() {
  const { profile, signOut } = useSession();
  const { lang, setLang, theme, setTheme, t } = usePreferences();
  const queryClient = useQueryClient();
  const photoUrl = useProfilePhotoUrl();
  const device = useBoundDevice();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const s = L[lang];

  const logout = async () => {
    setLoggingOut(true);
    try {
      clearOfflineSnapshots();
      queryClient.clear();
      await signOut();
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  const deviceText = device.data
    ? `${device.data.model ?? device.data.platform} · ${s.boundOn} ${formatManilaDateTime(device.data.bound_at, lang)}`
    : device.isPending
      ? "…"
      : s.noPhone;

  return (
    <ScrollView className="flex-1 bg-background-subtle" contentContainerClassName="gap-4 px-4 pb-12 pt-3">
      <Card className="gap-4 py-5">
        <CardContent className="items-center gap-2 px-4">
          <Avatar alt={profile?.full_name ?? "Profile photo"} className="size-24">
            {photoUrl ? <AvatarImage source={{ uri: photoUrl }} /> : null}
            <AvatarFallback className="bg-brand">
              <Text className="text-3xl font-semibold text-brand-foreground">{initialsOf(profile?.full_name)}</Text>
            </AvatarFallback>
          </Avatar>
          <Text className="text-center text-xl font-semibold">{profile?.full_name ?? "—"}</Text>
        </CardContent>
        <CardContent className="px-4">
          <InfoLine label={s.bhwId} value={profile?.bhw_id_number ?? "—"} />
          <Separator />
          <InfoLine label={s.area} value={profile?.area ?? "—"} />
          <Separator />
          <InfoLine label={s.email} value={profile?.email ?? "—"} />
          <Separator />
          <View className="min-h-touch flex-row items-center gap-3 py-2">
            <Icon as={Smartphone} size={18} className="text-muted-foreground" />
            <View className="flex-1">
              <Text className="text-sm text-muted-foreground">{s.boundPhone}</Text>
              <Text className="text-sm font-medium">{deviceText}</Text>
            </View>
          </View>
        </CardContent>
      </Card>

      <Card className="gap-4 py-5">
        <CardHeader className="px-4">
          <CardTitle>{s.appearance}</CardTitle>
        </CardHeader>
        <CardContent className="gap-4 px-4">
          <Tabs
            value={theme}
            onValueChange={(v) => {
              if (isTheme(v)) setTheme(v);
            }}
          >
            <TabsList className="h-12 w-full">
              {THEMES.map((value) => (
                <TabsTrigger key={value} value={value} className="min-h-touch flex-1" accessibilityLabel={`${s.appearance}: ${s[value]}`}>
                  <Text>{s[value]}</Text>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <BiometricToggle lang={lang} />

          <View className="gap-2">
            <Label nativeID="language-label">{s.language}</Label>
            <Tabs value={lang} onValueChange={(v) => setLang((v === "fil" ? "fil" : "en") satisfies Lang)}>
              <TabsList className="h-12 w-full" aria-labelledby="language-label">
                <TabsTrigger value="en" className="min-h-touch flex-1" accessibilityLabel="English">
                  <Text>English</Text>
                </TabsTrigger>
                <TabsTrigger value="fil" className="min-h-touch flex-1" accessibilityLabel="Filipino">
                  <Text>Filipino</Text>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </View>
        </CardContent>
      </Card>

      <Card className="gap-0 py-2">
        <LinkRow icon={FileText} label={s.myDtr} onPress={() => router.push("/dtr")} />
        <Separator />
        <LinkRow icon={ListChecks} label={s.myRequests} onPress={() => router.push("/requests")} />
        <Separator />
        <LinkRow icon={ShieldCheck} label={s.privacy} onPress={() => router.push("/privacy")} />
      </Card>

      <Button variant="destructive" className="min-h-[48px]" onPress={() => setConfirmLogout(true)}>
        <Icon as={LogOut} size={16} className="text-white" />
        <Text>{t("logout")}</Text>
      </Button>

      <Dialog open={confirmLogout} onOpenChange={setConfirmLogout}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{s.logoutTitle}</DialogTitle>
            <DialogDescription>{s.logoutBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" className="min-h-touch" onPress={() => void logout()} disabled={loggingOut}>
              {loggingOut ? <Spinner size="small" className="text-white" /> : null}
              <Text>{t("logout")}</Text>
            </Button>
            <Button variant="outline" className="min-h-touch" onPress={() => setConfirmLogout(false)}>
              <Text>{s.stay}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScrollView>
  );
}
