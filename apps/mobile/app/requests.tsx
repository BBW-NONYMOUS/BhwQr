import { router, Stack } from "expo-router";
import { FilePlus2, Inbox } from "lucide-react-native";
import { useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";

import { RequestCard } from "@/components/correction/request-card";
import { Toast, ToastTitle, useToast } from "@/components/gluestack/toast";
import { EmptyState, ErrorState, ListSkeleton, SavedCopyNote } from "@/components/history/list-states";
import { L, friendlyError } from "@/components/history/strings";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Text } from "@/components/ui/text";
import { colors } from "@bhw/design-tokens";
import { useAppTheme } from "@/lib/app-theme";
import { usePreferences } from "@/lib/preferences";
import { errorCodeOf } from "@/lib/queries/history";
import { useCancelCorrection, useMyRequests, type CorrectionRequestRow } from "@/lib/queries/requests";
import { useOnline } from "@/lib/use-online";

/** My Requests: own correction requests, newest first, with cancel for pending ones (FR-71, D-27). */
export default function RequestsScreen() {
  const { lang } = usePreferences();
  const { scheme } = useAppTheme();
  const s = L[lang];
  const online = useOnline();
  const toast = useToast();
  const query = useMyRequests();
  const cancel = useCancelCorrection();
  const [confirming, setConfirming] = useState<CorrectionRequestRow | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const snapshot = query.data;
  const rows = snapshot?.data ?? [];

  const confirmCancel = () => {
    if (!confirming) return;
    setCancelError(null);
    cancel.mutate(confirming.id, {
      onSuccess: () => {
        setConfirming(null);
        toast.show({
          placement: "top",
          duration: 3000,
          render: ({ id }) => (
            <Toast nativeID={`toast-${id}`} action="info" variant="solid">
              <ToastTitle>{s.cancelled}</ToastTitle>
            </Toast>
          ),
        });
      },
      onError: (error) => setCancelError(friendlyError(errorCodeOf(error), lang)),
    });
  };

  const newRequest = (
    <Button className="mt-2 min-h-touch px-6" onPress={() => router.push("/correction/new")}>
      <Icon as={FilePlus2} size={16} className="text-primary-foreground" />
      <Text>{s.newRequest}</Text>
    </Button>
  );

  return (
    <View className="flex-1 bg-background-subtle">
      <Stack.Screen options={{ headerShown: true, title: s.myRequests }} />

      {snapshot?.fromCache ? (
        <View className="pt-3">
          <SavedCopyNote savedAt={snapshot.savedAt} lang={lang} />
        </View>
      ) : null}

      {query.isPending ? (
        <View className="pt-3">
          <ListSkeleton rows={4} height={140} />
        </View>
      ) : query.isError && rows.length === 0 ? (
        <ErrorState message={friendlyError(errorCodeOf(query.error), lang)} lang={lang} onRetry={() => void query.refetch()} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <RequestCard
              request={item}
              lang={lang}
              cancelDisabled={!online || cancel.isPending}
              onCancel={(r) => {
                setCancelError(null);
                setConfirming(r);
              }}
            />
          )}
          ItemSeparatorComponent={() => <View className="h-3" />}
          contentContainerClassName="pb-8 pt-3"
          ListHeaderComponent={
            rows.length > 0 ? (
              <View className="mb-3 px-4">
                <Button variant="outline" className="min-h-touch" onPress={() => router.push("/correction/new")}>
                  <Icon as={FilePlus2} size={16} />
                  <Text>{s.newRequest}</Text>
                </Button>
              </View>
            ) : undefined
          }
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => void query.refetch()}
              colors={[colors[scheme].brand]}
              tintColor={colors[scheme].brand}
            />
          }
          ListEmptyComponent={<EmptyState icon={Inbox} title={s.noRequests} action={newRequest} />}
        />
      )}

      <Dialog open={confirming !== null} onOpenChange={(open) => {
          if (!open) setConfirming(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{s.cancelTitle}</DialogTitle>
            <DialogDescription>{s.cancelBody}</DialogDescription>
          </DialogHeader>
          {cancelError ? <Text className="text-sm text-destructive">{cancelError}</Text> : null}
          <DialogFooter>
            <Button variant="destructive" className="min-h-touch" onPress={confirmCancel} disabled={cancel.isPending}>
              <Text>{s.confirmCancel}</Text>
            </Button>
            <Button variant="outline" className="min-h-touch" onPress={() => setConfirming(null)}>
              <Text>{s.keepRequest}</Text>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
}
