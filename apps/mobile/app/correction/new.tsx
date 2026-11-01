import type { CorrectionType } from "@bhw/types";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { AlertCircle, CloudOff, Send } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

import { AttachmentField } from "@/components/correction/attachment-field";
import { correctionRuleText, isCorrectionType, normalizeHhmm, timeFieldsFor } from "@/components/correction/eligibility";
import { FormField } from "@/components/correction/form-field";
import { CorrectionTypePicker } from "@/components/correction/type-picker";
import { validateCorrection, type CorrectionField, type PickedAttachment } from "@/components/correction/validate";
import { Spinner } from "@/components/gluestack/spinner";
import { Toast, ToastDescription, ToastTitle, useToast } from "@/components/gluestack/toast";
import { manilaNowHhmm, manilaToday } from "@/components/history/dates";
import { L, friendlyError } from "@/components/history/strings";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { usePreferences } from "@/lib/preferences";
import { errorCodeOf } from "@/lib/queries/history";
import { useCorrectionWindowDays, useFileCorrection } from "@/lib/queries/requests";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";

/** Correction Request form (core flow 6, FR-68..FR-70). Params: date (YYYY-MM-DD), type. */
export default function NewCorrectionScreen() {
  const params = useLocalSearchParams<{ date?: string; type?: string }>();
  const { lang } = usePreferences();
  const s = L[lang];
  const online = useOnline();
  const toast = useToast();
  const windowDays = useCorrectionWindowDays();
  const fileCorrection = useFileCorrection();

  const [workDate, setWorkDate] = useState(typeof params.date === "string" ? params.date : manilaToday());
  const [type, setType] = useState<CorrectionType | null>(isCorrectionType(params.type) ? params.type : null);
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState<PickedAttachment | null>(null);
  const [errors, setErrors] = useState<Partial<Record<CorrectionField, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const shown = timeFieldsFor(type);
  const submitting = fileCorrection.isPending;

  const clearError = (field: CorrectionField) => setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const submit = () => {
    setSubmitError(null);
    const now = new Date();
    const result = validateCorrection(
      { workDate, type, timeIn, timeOut, reason },
      { today: manilaToday(now), nowHhmm: manilaNowHhmm(now), windowDays, lang },
    );
    if (!result.ok) {
      setErrors((prev) => ({ attachment: prev.attachment, ...result.errors }));
      return;
    }
    setErrors({});
    fileCorrection.mutate(
      { input: result.value, attachment },
      {
        onSuccess: () => {
          toast.show({
            placement: "top",
            duration: 4000,
            render: ({ id }) => (
              <Toast nativeID={`toast-${id}`} action="success" variant="solid">
                <ToastTitle>{s.submitted}</ToastTitle>
                <ToastDescription className="text-primary-foreground">{s.submittedBody}</ToastDescription>
              </Toast>
            ),
          });
          router.replace("/requests");
        },
        onError: (error) => setSubmitError(friendlyError(errorCodeOf(error), lang)),
      },
    );
  };

  return (
    <KeyboardAvoidingView className="flex-1 bg-background-subtle" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ headerShown: true, title: s.newRequestTitle }} />
      <ScrollView contentContainerClassName="gap-5 px-4 pb-12 pt-4" keyboardShouldPersistTaps="handled">
        {!online ? (
          <Alert icon={CloudOff} accessibilityLiveRegion="polite">
            <AlertDescription>{s.offlineSubmit}</AlertDescription>
          </Alert>
        ) : null}

        <FormField id="work-date" label={s.workDate} helper={correctionRuleText(windowDays, lang)} error={errors.workDate} required>
          <Input
            value={workDate}
            onChangeText={(v) => {
              setWorkDate(v);
              clearError("workDate");
            }}
            placeholder="YYYY-MM-DD"
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={10}
            aria-labelledby="work-date-label"
            aria-invalid={Boolean(errors.workDate)}
            className={cn("min-h-touch", errors.workDate && "border-destructive")}
          />
        </FormField>

        <FormField id="type" label={s.correctionType} error={errors.type} required>
          <CorrectionTypePicker
            value={type}
            onChange={(t) => {
              setType(t);
              clearError("type");
              clearError("requestedTimeIn");
              clearError("requestedTimeOut");
            }}
            lang={lang}
            invalid={Boolean(errors.type)}
            labelledBy="type-label"
          />
        </FormField>

        {shown.timeIn ? (
          <FormField
            id="time-in"
            label={s.timeIn}
            helper={type === "official_business" ? s.obHint : s.timeHint}
            error={errors.requestedTimeIn}
            required={type === "missing_time_in"}
          >
            <Input
              value={timeIn}
              onChangeText={(v) => {
                setTimeIn(v);
                clearError("requestedTimeIn");
              }}
              onBlur={() => setTimeIn((v) => (v ? normalizeHhmm(v) : v))}
              placeholder="HH:mm"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              aria-labelledby="time-in-label"
              aria-invalid={Boolean(errors.requestedTimeIn)}
              className={cn("min-h-touch", errors.requestedTimeIn && "border-destructive")}
            />
          </FormField>
        ) : null}

        {shown.timeOut ? (
          <FormField
            id="time-out"
            label={s.timeOut}
            helper={s.timeHint}
            error={errors.requestedTimeOut}
            required={type === "missing_time_out"}
          >
            <Input
              value={timeOut}
              onChangeText={(v) => {
                setTimeOut(v);
                clearError("requestedTimeOut");
              }}
              onBlur={() => setTimeOut((v) => (v ? normalizeHhmm(v) : v))}
              placeholder="HH:mm"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              aria-labelledby="time-out-label"
              aria-invalid={Boolean(errors.requestedTimeOut)}
              className={cn("min-h-touch", errors.requestedTimeOut && "border-destructive")}
            />
          </FormField>
        ) : null}

        <FormField id="reason" label={s.reason} helper={`${s.reasonHint} (${reason.trim().length}/500)`} error={errors.reason} required>
          <Textarea
            value={reason}
            onChangeText={(v) => {
              setReason(v);
              clearError("reason");
            }}
            placeholder={s.reasonPlaceholder}
            numberOfLines={4}
            maxLength={500}
            aria-labelledby="reason-label"
            aria-invalid={Boolean(errors.reason)}
            className={cn("min-h-[112px]", errors.reason && "border-destructive")}
          />
        </FormField>

        <FormField id="attachment" label={s.attachment} helper={s.attachmentHint} error={errors.attachment}>
          <AttachmentField
            value={attachment}
            onChange={setAttachment}
            onError={(message) => setErrors((prev) => ({ ...prev, attachment: message ?? undefined }))}
            lang={lang}
            disabled={submitting}
          />
        </FormField>

        {submitError ? (
          <Alert variant="destructive" icon={AlertCircle} accessibilityLiveRegion="assertive">
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <Button className="min-h-touch" onPress={submit} disabled={submitting || !online} accessibilityLabel={s.submit}>
          {submitting ? <Spinner size="small" className="text-primary-foreground" /> : <Icon as={Send} size={16} className="text-primary-foreground" />}
          <Text>{submitting ? s.submitting : s.submit}</Text>
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
