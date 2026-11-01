import { AlertCircle, Eye, EyeOff } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { z } from "zod";

import { BrandMark } from "@/components/auth/brand-mark";
import { AUTH_COPY } from "@/components/auth/copy";
import { LanguageToggle } from "@/components/auth/language-toggle";
import { Spinner } from "@/components/gluestack/spinner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { reportError } from "@/lib/api";
import { errorMessage } from "@/lib/messages";
import { usePreferences } from "@/lib/preferences";
import { useSession } from "@/lib/session";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";

/** Web portal base URL for "Register on the website" (optional env; lib/env.ts is not changed). */
const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? "").trim() || "http://localhost:3000";

const emailSchema = z.email();

type FieldErrors = { email?: string; password?: string; form?: string };

function hasFocus(el: unknown): el is { focus: () => void } {
  return typeof el === "object" && el !== null && typeof (el as { focus?: unknown }).focus === "function";
}

export default function LoginScreen() {
  const { signIn } = useSession();
  const { lang, t } = usePreferences();
  const online = useOnline();
  const c = AUTH_COPY[lang];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  // The RN Reusables Input ref type is an intersection of two TextInput typings, so the ref is
  // taken with a callback and narrowed to the one method used here.
  const passwordRef = useRef<{ focus: () => void } | null>(null);
  const setPasswordRef = useCallback((el: unknown) => {
    passwordRef.current = hasFocus(el) ? el : null;
  }, []);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    const trimmed = email.trim();
    if (!trimmed) next.email = c.emailRequired;
    else if (!emailSchema.safeParse(trimmed).success) next.email = c.emailInvalid;
    if (!password) next.password = c.passwordRequired;
    return next;
  };

  const submit = async () => {
    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (fieldErrors.email || fieldErrors.password) return;
    if (!online) {
      setErrors({ form: errorMessage("OFFLINE", lang) });
      return;
    }
    setSubmitting(true);
    try {
      const res = await signIn(email, password);
      // On success the session listener updates the gate and the root layout redirects.
      if (!res.ok) setErrors({ form: friendlyAuthError(res.message) });
    } catch (e) {
      void reportError("Login failed unexpectedly", { error: e instanceof Error ? e.message : String(e) });
      setErrors({ form: errorMessage("INTERNAL_ERROR", lang) });
    } finally {
      setSubmitting(false);
    }
  };

  const friendlyAuthError = (message: string): string => {
    const m = message.toLowerCase();
    if (m.includes("invalid login") || m.includes("invalid credentials")) return c.badCredentials;
    if (m.includes("not confirmed")) return c.emailNotConfirmed;
    if (m.includes("network") || m.includes("fetch")) return errorMessage("OFFLINE", lang);
    if (m.includes("rate") || m.includes("too many")) return errorMessage("RATE_LIMITED", lang);
    return errorMessage("INTERNAL_ERROR", lang);
  };

  const openRegister = () => {
    void Linking.openURL(`${WEB_URL.replace(/\/+$/, "")}/register`).catch(() => undefined);
  };

  return (
    <SafeAreaView className="flex-1 bg-background-subtle" edges={["top", "bottom"]}>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerClassName="flex-grow justify-center gap-6 px-4 py-8"
          keyboardShouldPersistTaps="handled"
        >
          <View className="items-end">
            <LanguageToggle />
          </View>

          <BrandMark lang={lang} />

          <Card>
            <CardContent>
              <FieldGroup className="gap-5">
                <Field invalid={Boolean(errors.email)}>
                  <FieldLabel nativeID="login-email-label">{c.email}</FieldLabel>
                  <Input
                    aria-labelledby="login-email-label"
                    aria-invalid={Boolean(errors.email)}
                    accessibilityLabel={c.email}
                    className={cn("min-h-touch", errors.email && "border-destructive")}
                    value={email}
                    onChangeText={setEmail}
                    placeholder={c.emailPlaceholder}
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    returnKeyType="next"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                    editable={!submitting}
                  />
                  <FieldError>{errors.email}</FieldError>
                </Field>

                <Field invalid={Boolean(errors.password)}>
                  <FieldLabel nativeID="login-password-label">{c.password}</FieldLabel>
                  <View className="relative justify-center">
                    <Input
                      ref={setPasswordRef}
                      aria-labelledby="login-password-label"
                      aria-invalid={Boolean(errors.password)}
                      accessibilityLabel={c.password}
                      className={cn("min-h-touch pr-12", errors.password && "border-destructive")}
                      value={password}
                      onChangeText={setPassword}
                      placeholder={c.passwordPlaceholder}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoComplete="password"
                      autoCorrect={false}
                      textContentType="password"
                      returnKeyType="go"
                      onSubmitEditing={() => void submit()}
                      editable={!submitting}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 min-h-touch min-w-touch"
                      onPress={() => setShowPassword((v) => !v)}
                      accessibilityLabel={showPassword ? c.hidePassword : c.showPassword}
                    >
                      <Icon as={showPassword ? EyeOff : Eye} size={20} className="text-muted-foreground" />
                    </Button>
                  </View>
                  <FieldError>{errors.password}</FieldError>
                </Field>

                {errors.form ? (
                  <Alert variant="destructive" icon={AlertCircle} accessibilityLiveRegion="polite">
                    <AlertDescription>{errors.form}</AlertDescription>
                  </Alert>
                ) : null}

                <Button className="min-h-touch" onPress={() => void submit()} disabled={submitting}>
                  {submitting ? <Spinner size="small" className="text-primary-foreground" /> : null}
                  <Text>{t("login")}</Text>
                </Button>
              </FieldGroup>
            </CardContent>
          </Card>

          <View className="items-center gap-1">
            <Text className="text-sm text-muted-foreground">{c.noAccount}</Text>
            <Button variant="link" className="min-h-touch" onPress={openRegister} accessibilityRole="link">
              <Text className="text-brand">{c.register}</Text>
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
