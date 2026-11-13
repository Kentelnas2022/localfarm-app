import {
  createSavedCollectionApi,
  deleteSavedCollectionApi,
  getSavedCollectionDetailsApi,
  renameSavedCollectionApi,
  SavedCollectionDetail,
} from "@/services/post-service";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export interface SaveToCollectionModalProps {
  visible: boolean;
  onClose: () => void;
  postId: string | null;
  postImageUrl?: string;
  currentCollectionName?: string;
  onSaveToCollection: (collectionName: string) => Promise<void> | void;
  onCollectionCreated?: (collectionName: string) => void;
  onShowToast?: (message: string, type?: "success" | "error" | "info") => void;
}

export default function SaveToCollectionModal({
  visible,
  onClose,
  postId,
  postImageUrl,
  currentCollectionName,
  onSaveToCollection,
  onCollectionCreated,
  onShowToast,
}: SaveToCollectionModalProps) {
  const [viewMode, setViewMode] = useState<"list" | "create">("list");
  const [collections, setCollections] = useState<SavedCollectionDetail[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Active saved collection name for current post
  const [selectedColName, setSelectedColName] = useState<string>(
    currentCollectionName || "All Saved"
  );

  // Rename modal state
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameInput, setRenameInput] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  // Context menu for a collection item
  const [optionsTarget, setOptionsTarget] = useState<SavedCollectionDetail | null>(null);

  const fetchCollections = async () => {
    if (!postId) return;
    setIsLoading(true);
    try {
      const list = await getSavedCollectionDetailsApi(postId);
      setCollections(list);
      const found = list.find((c) => c.hasCurrentPost);
      if (found) {
        setSelectedColName(found.name);
      } else if (currentCollectionName) {
        setSelectedColName(currentCollectionName);
      }
    } catch (err) {
      console.warn("[SaveToCollectionModal] fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (visible && postId) {
      setViewMode("list");
      setNewColName("");
      setOptionsTarget(null);
      setRenameTarget(null);
      fetchCollections();
    }
  }, [visible, postId]);

  const handleSelectCollection = async (colName: string) => {
    setSelectedColName(colName);
    try {
      await onSaveToCollection(colName);
      onShowToast?.(`Saved to ${colName}`, "success");
      onClose();
    } catch (err: any) {
      onShowToast?.(err?.message || "Failed to save to collection", "error");
    }
  };

  const handleCreateAndSave = async () => {
    const trimmed = newColName.trim();
    if (!trimmed || !postId) return;
    setIsCreating(true);
    try {
      await createSavedCollectionApi(trimmed, postId);
      setSelectedColName(trimmed);
      onCollectionCreated?.(trimmed);
      await onSaveToCollection(trimmed);
      onShowToast?.(`Saved to "${trimmed}"`, "success");
      onClose();
    } catch (err: any) {
      onShowToast?.(err?.message || "Failed to create collection", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartRename = (col: SavedCollectionDetail) => {
    setOptionsTarget(null);
    setRenameTarget(col.name);
    setRenameInput(col.name);
  };

  const handleConfirmRename = async () => {
    if (!renameTarget || !renameInput.trim()) return;
    const trimmed = renameInput.trim();
    if (trimmed.toLowerCase() === renameTarget.toLowerCase()) {
      setRenameTarget(null);
      return;
    }
    setIsRenaming(true);
    try {
      await renameSavedCollectionApi(renameTarget, trimmed);
      onShowToast?.(`Collection renamed to "${trimmed}"`, "success");
      if (selectedColName === renameTarget) {
        setSelectedColName(trimmed);
      }
      setRenameTarget(null);
      await fetchCollections();
    } catch (err: any) {
      onShowToast?.(err?.message || "Failed to rename collection", "error");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteCollection = (col: SavedCollectionDetail) => {
    setOptionsTarget(null);
    const executeDelete = async () => {
      try {
        await deleteSavedCollectionApi(col.name);
        onShowToast?.(`Collection "${col.name}" deleted. Posts moved to All Saved.`, "info");
        if (selectedColName === col.name) {
          setSelectedColName("All Saved");
        }
        await fetchCollections();
      } catch (err: any) {
        onShowToast?.(err?.message || "Failed to delete collection", "error");
      }
    };

    if (Platform.OS === "web") {
      if (
        window.confirm(
          `Delete "${col.name}"?\nPosts in this collection will not be deleted and will remain in All Saved.`
        )
      ) {
        executeDelete();
      }
    } else {
      Alert.alert(
        "Delete Collection?",
        `Posts in "${col.name}" will still be kept in All Saved.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: executeDelete },
        ]
      );
    }
  };

  const defaultCollection =
    collections.find((c) => c.isDefault || c.name.toLowerCase() === "all saved") || {
      name: "All Saved",
      itemCount: 0,
      isDefault: true,
      coverImageUrl: postImageUrl,
      hasCurrentPost: true,
    };

  const customCollections = collections.filter(
    (c) => !c.isDefault && c.name.toLowerCase() !== "all saved"
  );

  const { height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 bg-black/60 justify-end sm:justify-center sm:items-center sm:p-4"
      >
        <Pressable className="absolute inset-0" onPress={onClose} />

        <View
          className="w-full sm:max-w-md bg-white rounded-t-[28px] sm:rounded-3xl overflow-hidden shadow-2xl z-10 flex-col"
          style={{
            height: Math.min(560, Math.max(420, Math.round(screenHeight * 0.72))),
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 12,
          }}
        >
          {/* Top Drag Handle */}
          <View className="items-center pt-3 pb-2">
            <View className="w-10 h-1 bg-[#C7C7CC] rounded-full" />
          </View>

          {/* ============================================================ */}
          {/* VIEW 1: EXACT INSTAGRAM SAVED & COLLECTIONS LIST SCREEN */}
          {/* ============================================================ */}
          {viewMode === "list" && (
            <View className="flex-1">
              {/* Top Pinned Default "Saved" Row */}
              <TouchableOpacity
                onPress={() => handleSelectCollection("All Saved")}
                activeOpacity={0.7}
                className="flex-row items-center justify-between px-5 py-2.5"
              >
                <View className="flex-row items-center flex-1 mr-3">
                  <View className="w-[54px] h-[54px] rounded-2xl overflow-hidden bg-gray-200 mr-3.5 border border-gray-100 items-center justify-center">
                    {Boolean((postImageUrl && postImageUrl.trim()) || (defaultCollection.coverImageUrl && defaultCollection.coverImageUrl.trim())) ? (
                      <Image
                        source={{
                          uri: (postImageUrl?.trim() || defaultCollection.coverImageUrl?.trim())!,
                        }}
                        className="w-full h-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <Ionicons name="bookmark" size={26} color="#000000" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="text-[16px] font-bold text-black" numberOfLines={1}>
                      Saved
                    </Text>
                    <Text className="text-[13px] text-[#737373] mt-0.5 font-normal">
                      Private
                    </Text>
                  </View>
                </View>

                {/* Solid Black Bookmark Icon on Right */}
                <View className="p-1">
                  <Ionicons name="bookmark" size={24} color="#000000" />
                </View>
              </TouchableOpacity>

              <View className="h-[1px] bg-gray-100 my-1 mx-5" />

              {/* Collections Header Row */}
              <View className="flex-row items-center justify-between px-5 pt-3 pb-2">
                <Text className="text-[17px] font-bold text-black">
                  Collections
                </Text>
                <TouchableOpacity
                  onPress={() => setViewMode("create")}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text className="text-[15px] font-semibold text-[#34594A]">
                    New collection
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Collections Scroll List */}
              {isLoading ? (
                <View className="py-12 items-center justify-center">
                  <ActivityIndicator size="small" color="#000000" />
                  <Text className="text-xs text-gray-400 mt-2">Loading collections...</Text>
                </View>
              ) : customCollections.length === 0 ? (
                <View className="py-10 items-center justify-center px-6">
                  <Ionicons name="folder-outline" size={36} color="#D1D5DB" />
                  <Text className="text-sm font-semibold text-gray-700 mt-2">
                    No custom collections yet
                  </Text>
                  <Text className="text-xs text-gray-400 text-center mt-0.5">
                    Tap &quot;New collection&quot; above to organize your saved posts.
                  </Text>
                </View>
              ) : (
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
                  showsVerticalScrollIndicator={false}
                >
                  {customCollections.map((col) => {
                    const isSelected =
                      col.name.toLowerCase() === selectedColName.toLowerCase() ||
                      Boolean(col.hasCurrentPost);

                    return (
                      <TouchableOpacity
                        key={col.name}
                        onPress={() => handleSelectCollection(col.name)}
                        onLongPress={() => setOptionsTarget(col)}
                        delayLongPress={300}
                        activeOpacity={0.7}
                        className="flex-row items-center justify-between py-2.5"
                      >
                        {/* Left: Thumbnail & Name / Private */}
                        <View className="flex-row items-center flex-1 mr-3">
                          <View className="w-[54px] h-[54px] rounded-2xl overflow-hidden bg-gray-100 mr-3.5 border border-gray-100 items-center justify-center">
                            {Boolean(col.coverImageUrl && col.coverImageUrl.trim()) ? (
                              <Image
                                source={{ uri: col.coverImageUrl!.trim() }}
                                className="w-full h-full"
                                resizeMode="cover"
                              />
                            ) : (
                              <Ionicons name="folder" size={26} color="#9CA3AF" />
                            )}
                          </View>

                          <View className="flex-1">
                            <Text
                              className="text-[16px] font-bold text-black"
                              numberOfLines={1}
                            >
                              {col.name}
                            </Text>
                            <Text className="text-[13px] text-[#737373] mt-0.5 font-normal">
                              Private
                            </Text>
                          </View>
                        </View>

                        {/* Right: Plus Icon or Checkmark + Three-dot Options */}
                        <View className="flex-row items-center">
                          {isSelected ? (
                            <Ionicons name="checkmark-circle" size={28} color="#34594A" />
                          ) : (
                            <Ionicons name="add-circle-outline" size={28} color="#737373" />
                          )}

                          <TouchableOpacity
                            onPress={() => setOptionsTarget(col)}
                            className="p-1.5 ml-2 -mr-1 active:opacity-60"
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons
                              name="ellipsis-vertical"
                              size={16}
                              color="#9CA3AF"
                            />
                          </TouchableOpacity>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}

              {/* Bottom Home Indicator */}
              <View
                style={{ paddingBottom: Math.max(insets.bottom, 12), paddingTop: 8 }}
                className="items-center"
              >
                <View className="w-36 h-1 bg-black/25 rounded-full" />
              </View>
            </View>
          )}

          {/* ============================================================ */}
          {/* VIEW 2: INSTAGRAM NEW COLLECTION SCREEN */}
          {/* ============================================================ */}
          {viewMode === "create" && (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 20,
                paddingBottom: Math.max(insets.bottom, 24),
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Header */}
              <View className="flex-row items-center justify-between py-3 border-b border-gray-100 mb-5">
                <TouchableOpacity
                  onPress={() => setViewMode("list")}
                  className="flex-row items-center p-1 -ml-1 active:opacity-60"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="chevron-back" size={22} color="#000000" />
                </TouchableOpacity>

                <Text className="text-base font-bold text-black">
                  New collection
                </Text>

                <TouchableOpacity
                  onPress={handleCreateAndSave}
                  disabled={!newColName.trim() || isCreating}
                  className="p-1 -mr-1"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color="#34594A" />
                  ) : (
                    <Text
                      className={`text-[15px] font-bold ${
                        newColName.trim() ? "text-[#34594A]" : "text-gray-400"
                      }`}
                    >
                      Done
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Cover Preview & Name Input */}
              <View className="items-center mb-6">
                <View className="w-24 h-24 rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 shadow-sm items-center justify-center mb-2">
                  {Boolean(postImageUrl && postImageUrl.trim()) ? (
                    <Image
                      source={{ uri: postImageUrl!.trim() }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons name="images-outline" size={32} color="#9CA3AF" />
                  )}
                </View>
                <Text className="text-xs text-gray-400 font-medium">Cover preview</Text>
              </View>

              {/* Input */}
              <View className="mb-6">
                <Text className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">
                  Collection Name
                </Text>
                <TextInput
                  value={newColName}
                  onChangeText={setNewColName}
                  placeholder="e.g. random, pokemon, food"
                  placeholderTextColor="#8E8E8E"
                  autoFocus={true}
                  className="w-full bg-gray-50 border border-gray-300 rounded-2xl px-4 py-3.5 text-base text-gray-900"
                  onSubmitEditing={handleCreateAndSave}
                  returnKeyType="done"
                />
              </View>

              <TouchableOpacity
                onPress={handleCreateAndSave}
                disabled={!newColName.trim() || isCreating}
                className={`w-full py-3.5 rounded-2xl items-center justify-center ${
                  newColName.trim() && !isCreating
                    ? "bg-[#34594A] active:bg-[#2A4B3E]"
                    : "bg-gray-200 opacity-60"
                }`}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text className="text-sm font-bold text-white">
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}

          {/* Collection Options Bottom Sheet */}
          {optionsTarget && (
            <Modal
              visible={Boolean(optionsTarget)}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setOptionsTarget(null)}
            >
              <Pressable
                className="flex-1 bg-black/40 justify-end"
                onPress={() => setOptionsTarget(null)}
              >
                <Pressable
                  className="bg-white rounded-t-3xl p-5 pb-8 shadow-2xl"
                  onPress={(e) => e.stopPropagation()}
                >
                  <View className="items-center mb-3">
                    <View className="w-10 h-1 bg-gray-300 rounded-full" />
                  </View>

                  <Text className="text-base font-bold text-gray-900 mb-1 text-center">
                    {optionsTarget.name}
                  </Text>
                  <Text className="text-xs text-gray-500 text-center mb-4">
                    {optionsTarget.itemCount} items
                  </Text>

                  <TouchableOpacity
                    onPress={() => handleStartRename(optionsTarget)}
                    className="flex-row items-center py-3 px-3 rounded-xl active:bg-gray-100"
                  >
                    <Ionicons name="pencil-outline" size={20} color="#374151" />
                    <Text className="text-sm font-semibold text-gray-800 ml-3">
                      Rename Collection
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleDeleteCollection(optionsTarget)}
                    className="flex-row items-center py-3 px-3 rounded-xl active:bg-red-50 mt-1"
                  >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    <Text className="text-sm font-semibold text-red-600 ml-3">
                      Delete Collection
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setOptionsTarget(null)}
                    className="mt-4 py-3 rounded-xl bg-gray-100 items-center justify-center"
                  >
                    <Text className="text-sm font-bold text-gray-700">Cancel</Text>
                  </TouchableOpacity>
                </Pressable>
              </Pressable>
            </Modal>
          )}

          {/* Rename Collection Modal */}
          {renameTarget && (
            <Modal
              visible={Boolean(renameTarget)}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setRenameTarget(null)}
            >
              <Pressable
                className="flex-1 bg-black/50 justify-center items-center p-5"
                onPress={() => setRenameTarget(null)}
              >
                <Pressable
                  className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl"
                  onPress={(e) => e.stopPropagation()}
                >
                  <Text className="text-base font-bold text-gray-900 mb-2">
                    Rename Collection
                  </Text>
                  <TextInput
                    value={renameInput}
                    onChangeText={setRenameInput}
                    autoFocus={true}
                    className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 mb-5"
                    placeholder="Collection name"
                    placeholderTextColor="#8E8E8E"
                  />
                  <View className="flex-row justify-end gap-2">
                    <TouchableOpacity
                      onPress={() => setRenameTarget(null)}
                      className="px-4 py-2 rounded-xl bg-gray-100"
                    >
                      <Text className="text-sm font-semibold text-gray-700">Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleConfirmRename}
                      disabled={!renameInput.trim() || isRenaming}
                      className={`px-4 py-2 rounded-xl ${
                        renameInput.trim() && !isRenaming
                          ? "bg-[#34594A]"
                          : "bg-gray-200 opacity-60"
                      }`}
                    >
                      {isRenaming ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text className="text-sm font-bold text-white">Save</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </Pressable>
              </Pressable>
            </Modal>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
