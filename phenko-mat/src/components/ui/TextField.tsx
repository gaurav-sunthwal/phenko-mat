import { useState, type ReactNode, type Ref } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { colors, fonts, radius } from "@/theme";
import { Text } from "./Text";

export interface TextFieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  /** Web login uses a borderless white field that outlines in ink on focus. */
  tone?: "default" | "plain";
  labelWeight?: "bold" | "extrabold";
  prefix?: ReactNode;
  ref?: Ref<TextInput>;
}

/** Rounded input with the web's focus ring (border-line → border-honey). */
export function TextField({ label, hint, tone = "default", labelWeight = "bold", prefix, multiline, style, onFocus, onBlur, ref, ...rest }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const borderColor = tone === "plain" ? (focused ? colors.ink : "transparent") : focused ? colors.honey : colors.line;

  return (
    <View>
      {label ? (
        <Text weight={labelWeight} size={labelWeight === "bold" ? "sm" : "base"} style={styles.label}>
          {label}
        </Text>
      ) : null}
      <View style={[styles.box, { borderColor }, multiline && styles.multiline]}>
        {prefix}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.inkSoft}
          selectionColor={colors.honeyDeep}
          cursorColor={colors.ink}
          multiline={multiline}
          textAlignVertical={multiline ? "top" : "center"}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.inputMultiline, style]}
          {...rest}
        />
      </View>
      {hint ? (
        <Text size="xs" color={colors.inkSoft} style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  box: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    paddingHorizontal: 16,
  },
  multiline: { alignItems: "flex-start" },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.ink,
  },
  inputMultiline: { minHeight: 96 },
  hint: { marginTop: 4 },
});
