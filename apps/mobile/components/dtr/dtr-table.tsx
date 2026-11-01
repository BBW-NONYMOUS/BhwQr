import { View } from "react-native";

import { L } from "@/components/history/strings";
import { Separator } from "@/components/ui/separator";
import { Text } from "@/components/ui/text";
import type { Lang } from "@/lib/messages";
import { cn } from "@/lib/utils";

import { toDtrDisplayRow, type DtrRowData } from "./format";

const NUM = { fontVariant: ["tabular-nums" as const] };

function Cell({ children, className, header }: { children: React.ReactNode; className?: string; header?: boolean }) {
  return (
    <Text
      className={cn(
        "text-center text-xs",
        header ? "font-semibold text-muted-foreground" : "text-foreground",
        className,
      )}
      style={NUM}
      numberOfLines={1}
    >
      {children}
    </Text>
  );
}

/**
 * Compact 31-line CSC Form No. 48 table (Day, AM arrival/departure, PM arrival/departure,
 * undertime hours/minutes). Lines without times show their remark across the four time columns.
 */
export function DtrTable({ rows, lang }: { rows: DtrRowData[]; lang: Lang }) {
  const s = L[lang];
  return (
    <View className="overflow-hidden rounded-2xl border border-border bg-card" accessibilityRole="list" accessibilityLabel={s.dtrSubtitle}>
      <View className="flex-row items-center bg-muted px-1 py-2">
        <Cell header className="w-8">
          {s.day}
        </Cell>
        <Cell header className="flex-1">
          {s.amIn}
        </Cell>
        <Cell header className="flex-1">
          {s.amOut}
        </Cell>
        <Cell header className="flex-1">
          {s.pmIn}
        </Cell>
        <Cell header className="flex-1">
          {s.pmOut}
        </Cell>
        <Cell header className="w-10">
          {s.utH}
        </Cell>
        <Cell header className="w-10">
          {s.utM}
        </Cell>
      </View>
      {rows.map((raw, index) => {
        const row = toDtrDisplayRow(raw, lang);
        const label =
          row.kind === "blank"
            ? `${s.day} ${row.day}: —`
            : row.kind === "remark"
              ? `${s.day} ${row.day}: ${row.remark ?? ""}`
              : `${s.day} ${row.day}: ${s.amIn} ${row.cells[0] || "—"}, ${s.amOut} ${row.cells[1] || "—"}, ${s.pmIn} ${row.cells[2] || "—"}, ${s.pmOut} ${row.cells[3] || "—"}${row.remark ? `, ${row.remark}` : ""}`;
        return (
          <View key={row.day} accessible accessibilityLabel={label} testID={`dtr-row-${row.day}`}>
            {index > 0 ? <Separator /> : null}
            <View className={cn("min-h-[30px] justify-center px-1 py-1.5", row.muted && "bg-muted/50")}>
              <View className="flex-row items-center">
                <Cell className="w-8 font-medium">{row.day}</Cell>
                {row.kind === "remark" ? (
                  <Text className="flex-[4] text-center text-xs italic text-muted-foreground" numberOfLines={1}>
                    {row.remark}
                  </Text>
                ) : (
                  row.cells.map((cell, i) => (
                    <Cell key={i} className="flex-1">
                      {cell}
                    </Cell>
                  ))
                )}
                <Cell className="w-10">{row.utHours}</Cell>
                <Cell className="w-10">{row.utMinutes}</Cell>
              </View>
              {row.kind === "times" && row.remark ? (
                <Text className="ml-8 text-[11px] text-muted-foreground" numberOfLines={1}>
                  {row.remark}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}
