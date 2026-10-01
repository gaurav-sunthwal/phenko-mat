import { Image } from "expo-image";
import { useState } from "react";
import { FlatList, Modal, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton, Text, XIcon } from "@/components/ui";
import { alpha, colors } from "@/theme";

/**
 * Full-screen photos to check an item's condition (web: <PhotoViewer>). Swipe between photos; on iOS
 * each photo also pinch-zooms (ScrollView zoom).
 */
export function PhotoViewer({ photos, start, alt, onClose }: { photos: string[]; start: number; alt: string; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(start);

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent supportedOrientations={["portrait"]}>
      <View style={styles.root}>
        <FlatList
          data={photos}
          horizontal
          pagingEnabled
          initialScrollIndex={start}
          getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(uri) => uri}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item: uri, index: i }) => (
            <ScrollView
              style={{ width, height }}
              contentContainerStyle={styles.center}
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
            >
              <Image
                source={{ uri }}
                style={{ width, height }}
                contentFit="contain"
                cachePolicy="memory-disk"
                accessibilityLabel={`${alt}, photo ${i + 1} of ${photos.length}`}
              />
            </ScrollView>
          )}
        />
        <View style={[styles.bar, { top: insets.top + 8 }]} pointerEvents="box-none">
          <Text weight="semibold" size="sm" color={colors.white}>
            {index + 1} / {photos.length}
          </Text>
          <IconButton
            icon={<XIcon size={22} color={colors.white} />}
            background={alpha(colors.white, 0.15)}
            accessibilityLabel="Close photos"
            onPress={onClose}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  center: { flexGrow: 1, alignItems: "center", justifyContent: "center" },
  bar: { position: "absolute", left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
});
