import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

interface PostImageGridProps {
  images?: string[];
  fallbackImageUrl?: string;
  onPressImage?: (imageUri: string, index: number) => void;
}

export const PostImageGrid: React.FC<PostImageGridProps> = ({
  images,
  fallbackImageUrl,
  onPressImage,
}) => {
  const photoList = React.useMemo(() => {
    if (Array.isArray(images) && images.length > 0) {
      return images.filter((img) => Boolean(img && img.trim()));
    }
    if (fallbackImageUrl && fallbackImageUrl.trim()) {
      return [fallbackImageUrl.trim()];
    }
    return [];
  }, [images, fallbackImageUrl]);

  if (photoList.length === 0) return null;

  const handlePress = (uri: string, idx: number) => {
    if (onPressImage) {
      onPressImage(uri, idx);
    }
  };

  // Case 1: Single image
  if (photoList.length === 1) {
    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => handlePress(photoList[0], 0)}
        className="w-full rounded-xl overflow-hidden mb-3.5 bg-gray-100 shadow-2xs"
      >
        <Image
          source={{ uri: photoList[0] }}
          className="w-full h-64 bg-gray-100"
          resizeMode="cover"
        />
      </TouchableOpacity>
    );
  }

  // Case 2: 2 images (side-by-side 50/50 split)
  if (photoList.length === 2) {
    return (
      <View className="w-full flex-row gap-1.5 rounded-xl overflow-hidden mb-3.5 shadow-2xs">
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handlePress(photoList[0], 0)}
          className="flex-1 h-56 bg-gray-100"
        >
          <Image
            source={{ uri: photoList[0] }}
            className="w-full h-full"
            resizeMode="cover"
          />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handlePress(photoList[1], 1)}
          className="flex-1 h-56 bg-gray-100"
        >
          <Image
            source={{ uri: photoList[1] }}
            className="w-full h-full"
            resizeMode="cover"
          />
        </TouchableOpacity>
      </View>
    );
  }

  // Case 3: 3 images (1 top banner + 2 bottom columns)
  if (photoList.length === 3) {
    return (
      <View className="w-full rounded-xl overflow-hidden mb-3.5 shadow-2xs gap-1.5">
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handlePress(photoList[0], 0)}
          className="w-full h-44 bg-gray-100"
        >
          <Image
            source={{ uri: photoList[0] }}
            className="w-full h-full"
            resizeMode="cover"
          />
        </TouchableOpacity>
        <View className="w-full flex-row gap-1.5">
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handlePress(photoList[1], 1)}
            className="flex-1 h-36 bg-gray-100"
          >
            <Image
              source={{ uri: photoList[1] }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handlePress(photoList[2], 2)}
            className="flex-1 h-36 bg-gray-100"
          >
            <Image
              source={{ uri: photoList[2] }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Case 4: 4 images (2x2 grid)
  if (photoList.length === 4) {
    return (
      <View className="w-full rounded-xl overflow-hidden mb-3.5 shadow-2xs gap-1.5">
        <View className="w-full flex-row gap-1.5">
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handlePress(photoList[0], 0)}
            className="flex-1 h-36 bg-gray-100"
          >
            <Image
              source={{ uri: photoList[0] }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handlePress(photoList[1], 1)}
            className="flex-1 h-36 bg-gray-100"
          >
            <Image
              source={{ uri: photoList[1] }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </TouchableOpacity>
        </View>
        <View className="w-full flex-row gap-1.5">
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handlePress(photoList[2], 2)}
            className="flex-1 h-36 bg-gray-100"
          >
            <Image
              source={{ uri: photoList[2] }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => handlePress(photoList[3], 3)}
            className="flex-1 h-36 bg-gray-100"
          >
            <Image
              source={{ uri: photoList[3] }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Case 5: 5+ images (2 top + 3 bottom with +N overlay on the 5th image)
  const remainingCount = photoList.length - 4;
  return (
    <View className="w-full rounded-xl overflow-hidden mb-3.5 shadow-2xs gap-1.5">
      {/* Top 2 images */}
      <View className="w-full flex-row gap-1.5">
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handlePress(photoList[0], 0)}
          className="flex-1 h-40 bg-gray-100"
        >
          <Image
            source={{ uri: photoList[0] }}
            className="w-full h-full"
            resizeMode="cover"
          />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handlePress(photoList[1], 1)}
          className="flex-1 h-40 bg-gray-100"
        >
          <Image
            source={{ uri: photoList[1] }}
            className="w-full h-full"
            resizeMode="cover"
          />
        </TouchableOpacity>
      </View>

      {/* Bottom row (image 2, 3, and 4 with +N overlay) */}
      <View className="w-full flex-row gap-1.5">
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handlePress(photoList[2], 2)}
          className="flex-1 h-28 bg-gray-100"
        >
          <Image
            source={{ uri: photoList[2] }}
            className="w-full h-full"
            resizeMode="cover"
          />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handlePress(photoList[3], 3)}
          className="flex-1 h-28 bg-gray-100"
        >
          <Image
            source={{ uri: photoList[3] }}
            className="w-full h-full"
            resizeMode="cover"
          />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => handlePress(photoList[4], 4)}
          className="flex-1 h-28 bg-gray-100 relative"
        >
          <Image
            source={{ uri: photoList[4] }}
            className="w-full h-full"
            resizeMode="cover"
          />
          {remainingCount > 0 && (
            <View className="absolute inset-0 bg-black/60 items-center justify-center">
              <Text className="text-white text-xl font-bold">
                +{remainingCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default PostImageGrid;
