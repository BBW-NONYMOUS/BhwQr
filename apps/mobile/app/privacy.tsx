import { Stack } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";

import { L } from "@/components/history/strings";
import { PRIVACY_NOTICE } from "@/components/profile/privacy-notice";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Text } from "@/components/ui/text";
import type { Lang } from "@/lib/messages";
import { usePreferences } from "@/lib/preferences";

function Notice({ lang }: { lang: Lang }) {
  const notice = PRIVACY_NOTICE[lang];
  return (
    <View className="gap-4">
      <View className="gap-1">
        <Text className="text-xl font-bold" role="heading">
          {notice.title}
        </Text>
        <Text className="text-sm font-medium text-muted-foreground">{notice.subtitle}</Text>
      </View>
      {notice.sections.map((section) => (
        <View key={section.heading} className="gap-1.5">
          <Text className="text-base font-semibold" role="heading">
            {section.heading}
          </Text>
          {section.body ? <Text className="text-sm leading-6">{section.body}</Text> : null}
          {section.bullets?.map((bullet) => (
            <View key={bullet} className="flex-row gap-2 pl-1">
              <Text className="text-sm leading-6">•</Text>
              <Text className="flex-1 text-sm leading-6">{bullet}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** Data Privacy Notice (RA 10173), English / Filipino tabs (05-privacy-and-consent.md §2–3). */
export default function PrivacyScreen() {
  const { lang } = usePreferences();
  const [tab, setTab] = useState<Lang>(lang);

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-4 pb-12 pt-4">
      <Stack.Screen options={{ headerShown: true, title: L[lang].privacyTitle }} />
      <Tabs value={tab} onValueChange={(v) => setTab(v === "fil" ? "fil" : "en")} className="gap-4">
        <TabsList className="h-12 w-full">
          <TabsTrigger value="en" className="min-h-touch flex-1" accessibilityLabel="English">
            <Text>English</Text>
          </TabsTrigger>
          <TabsTrigger value="fil" className="min-h-touch flex-1" accessibilityLabel="Filipino">
            <Text>Filipino</Text>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="en">
          <Notice lang="en" />
        </TabsContent>
        <TabsContent value="fil">
          <Notice lang="fil" />
        </TabsContent>
      </Tabs>
    </ScrollView>
  );
}
