import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { View } from 'react-native';

/**
 * React Native port of shadcn/ui `Field` (same API as apps/web/components/ui/field.tsx).
 * RN has no `group-data-[invalid]` selectors, so `Field` shares its invalid/disabled state
 * with its children through context instead.
 */
type FieldState = { invalid: boolean; disabled: boolean };

const FieldContext = React.createContext<FieldState>({ invalid: false, disabled: false });

function FieldGroup({ className, ...props }: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return <View className={cn('flex w-full flex-col gap-7', className)} {...props} />;
}

function Field({
  className,
  orientation = 'vertical',
  invalid = false,
  disabled = false,
  ...props
}: React.ComponentProps<typeof View> &
  React.RefAttributes<View> & {
    orientation?: 'vertical' | 'horizontal';
    invalid?: boolean;
    disabled?: boolean;
  }) {
  const state = React.useMemo(() => ({ invalid, disabled }), [invalid, disabled]);
  return (
    <FieldContext.Provider value={state}>
      <View
        role="group"
        className={cn(
          'flex w-full gap-3',
          orientation === 'horizontal' ? 'flex-row items-center' : 'flex-col',
          disabled && 'opacity-50',
          className
        )}
        {...props}
      />
    </FieldContext.Provider>
  );
}

function FieldContent({ className, ...props }: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return <View className={cn('flex flex-1 flex-col gap-1.5', className)} {...props} />;
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  const { invalid, disabled } = React.useContext(FieldContext);
  return <Label disabled={disabled} className={cn(invalid && 'text-destructive', className)} {...props} />;
}

function FieldDescription({ className, ...props }: React.ComponentProps<typeof Text> & React.RefAttributes<typeof Text>) {
  return <Text className={cn('text-muted-foreground text-sm font-normal leading-normal', className)} {...props} />;
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<typeof Text> &
  React.RefAttributes<typeof Text> & {
    errors?: ({ message?: string } | undefined)[];
  }) {
  const content = React.useMemo(() => {
    if (children) return children;
    const messages = [...new Set((errors ?? []).map((e) => e?.message).filter(Boolean))];
    return messages.length > 0 ? messages.join('\n') : null;
  }, [children, errors]);

  if (!content) return null;

  return (
    <Text
      role="alert"
      accessibilityLiveRegion="polite"
      className={cn('text-destructive text-sm font-normal', className)}
      {...props}>
      {content}
    </Text>
  );
}

export { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel };
