"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SaveIcon, UndoIcon } from "lucide-react";
import { useTransition } from "react";
import { Controller, useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { ActionResult } from "@/lib/actions";

import { applyFieldErrors, numberInputValue } from "./form-utils";
import {
  DTR_SWITCH,
  SETTINGS_DEFAULTS,
  SETTINGS_SECTIONS,
  settingsFormSchema,
  type BooleanFieldMeta,
  type NumericFieldMeta,
  type SettingsFormValues,
} from "./settings";

export type UpdateSettingsAction = (values: SettingsFormValues) => Promise<ActionResult<SettingsFormValues>>;

const FIELDS = Object.keys(SETTINGS_DEFAULTS) as (keyof SettingsFormValues)[];

export function SettingsForm({ initial, action }: { initial: SettingsFormValues; action: UpdateSettingsAction }) {
  const [pending, startTransition] = useTransition();
  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: initial,
    mode: "onTouched",
  });
  const { isDirty } = form.formState;

  const onSubmit = (values: SettingsFormValues) =>
    startTransition(async () => {
      const result = await action(values);
      if (!result.ok) {
        applyFieldErrors(form.setError, result, FIELDS);
        toast.error(result.message);
        return;
      }
      form.reset(result.data);
      toast.success(result.message ?? "Settings saved.");
    });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {SETTINGS_SECTIONS.map((section) => (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle>{section.title}</CardTitle>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="gap-5">
                {section.numbers.map((meta) => (
                  <NumberSetting key={meta.key} form={form} meta={meta} />
                ))}
                {section.switches.map((meta) => (
                  <SwitchSetting key={meta.key} form={form} meta={meta} />
                ))}
              </FieldGroup>
            </CardContent>
          </Card>
        ))}

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Office and DTR</CardTitle>
            <CardDescription>Printed on the DTR (CSC Form 48), reports and the kiosk header.</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <TextSetting
                  form={form}
                  name="office_name"
                  label="Office name"
                  help="2–150 characters. Shown as the barangay header on DTRs and reports."
                />
                <TextSetting
                  form={form}
                  name="office_address"
                  label="Office address"
                  help="2–200 characters. Printed under the office name."
                />
              </div>
              <SwitchSetting form={form} meta={DTR_SWITCH} />
            </FieldGroup>
          </CardContent>
        </Card>
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <p className="mr-auto text-sm text-muted-foreground" aria-live="polite">
          {isDirty ? "You have unsaved changes." : "All changes saved."}
        </p>
        <Button type="button" variant="outline" onClick={() => form.reset()} disabled={!isDirty || pending}>
          <UndoIcon data-icon="inline-start" aria-hidden />
          Discard
        </Button>
        <Button type="submit" disabled={!isDirty || pending}>
          <SaveIcon data-icon="inline-start" aria-hidden />
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

function NumberSetting({ form, meta }: { form: UseFormReturn<SettingsFormValues>; meta: NumericFieldMeta }) {
  const id = `setting-${meta.key}`;
  const helpId = `${id}-help`;
  return (
    <Controller
      name={meta.key}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{meta.label}</FieldLabel>
          <InputGroup className="sm:max-w-56">
            <InputGroupInput
              id={id}
              name={field.name}
              ref={field.ref}
              type="number"
              inputMode="numeric"
              min={meta.min}
              max={meta.max}
              step={1}
              value={numberInputValue(field.value)}
              onChange={(e) => {
                field.onChange(e.target.valueAsNumber);
                // refresh < lifetime depends on both fields.
                if (meta.key === "token_lifetime_seconds" && form.formState.touchedFields.token_refresh_seconds) {
                  void form.trigger("token_refresh_seconds");
                }
              }}
              onBlur={field.onBlur}
              aria-invalid={fieldState.invalid}
              aria-describedby={helpId}
              className="tabular-nums"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>{meta.unit}</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
          <FieldDescription id={helpId}>
            <span className="tabular-nums">
              Range {meta.min}–{meta.max} {meta.unit}.
            </span>{" "}
            {meta.help}
          </FieldDescription>
        </Field>
      )}
    />
  );
}

function SwitchSetting({ form, meta }: { form: UseFormReturn<SettingsFormValues>; meta: BooleanFieldMeta }) {
  const id = `setting-${meta.key}`;
  return (
    <Controller
      name={meta.key}
      control={form.control}
      render={({ field }) => (
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={id}>{meta.label}</FieldLabel>
            <FieldDescription id={`${id}-help`}>{meta.help}</FieldDescription>
          </FieldContent>
          <Switch
            id={id}
            ref={field.ref}
            checked={field.value}
            onCheckedChange={field.onChange}
            onBlur={field.onBlur}
            aria-describedby={`${id}-help`}
          />
        </Field>
      )}
    />
  );
}

function TextSetting({
  form,
  name,
  label,
  help,
}: {
  form: UseFormReturn<SettingsFormValues>;
  name: "office_name" | "office_address";
  label: string;
  help: string;
}) {
  const id = `setting-${name}`;
  return (
    <Controller
      name={name}
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input {...field} id={id} aria-invalid={fieldState.invalid} aria-describedby={`${id}-help`} />
          {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
          <FieldDescription id={`${id}-help`}>{help}</FieldDescription>
        </Field>
      )}
    />
  );
}
