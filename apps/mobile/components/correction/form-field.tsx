import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

/** One form row built on the shadcn Field primitives: label, control, error, then helper text. */
export function FormField({
  id,
  label,
  helper,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  helper?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Field invalid={Boolean(error)}>
      <FieldLabel nativeID={`${id}-label`}>
        {label}
        {required ? " *" : ""}
      </FieldLabel>
      {children}
      <FieldError>{error}</FieldError>
      {helper ? <FieldDescription>{helper}</FieldDescription> : null}
    </Field>
  );
}
