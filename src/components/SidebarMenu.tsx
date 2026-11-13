import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export interface SidebarMenuProps {
  isVisible: boolean;
  onClose: () => void;
  activeTab?: string;
  onSelectTab?: (tabName: string) => void;
}

const MENU_ITEMS = [
  "Request",
  "Your Friends",
  "Suggestions",
  "Nearby Users",
  "Sent Request",
];

const ROUTE_MAP: Record<string, string> = {
  Request: "/user/People",
  "Your Friends": "/user/Friends",
  Suggestions: "/user/Suggestions",
  "Nearby Users": "/user/NearbyUsers",
  "Sent Request": "/user/SentRequests",
};

export default function SidebarMenu({
  isVisible,
  onClose,
  activeTab = "Request",
  onSelectTab,
}: SidebarMenuProps) {
  const router = useRouter();

  const handlePressItem = (item: string) => {
    if (onSelectTab) onSelectTab(item);
    onClose();

    if (item === activeTab) return;

    const targetRoute = ROUTE_MAP[item];
    if (targetRoute) {
      try {
        router.push(targetRoute as any);
      } catch (e) {
        console.warn("Sidebar navigation error", e);
      }
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View className="flex-1 relative" style={{ flex: 1 }}>
        {/* Full-bleed Gradient Backdrop (Dark Gradient Black) */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill}>
            <LinearGradient
              colors={[
                "rgba(0, 0, 0, 0.78)",
                "rgba(0, 0, 0, 0.58)",
                "rgba(0, 0, 0, 0.38)",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        </TouchableWithoutFeedback>

        {/* Mobile Responsive Sidebar Drawer */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="h-full w-[78%] max-w-[320px] bg-white flex-col"
          style={{
            height: "100%",
            width: "78%",
            maxWidth: 320,
            backgroundColor: "#FFFFFF",
            elevation: 24,
            shadowColor: "#000000",
            shadowOffset: { width: 4, height: 0 },
            shadowOpacity: 0.25,
            shadowRadius: 16,
          }}
        >
          <SafeAreaView
            className="flex-1 bg-white"
            edges={["top", "bottom", "left"]}
          >
            {/* Header Section */}
            <View className="flex-row items-center justify-between px-5 pt-3 pb-3.5 border-b border-gray-100 mb-3">
              <Text className="text-2xl font-bold text-gray-900">
                Connection
              </Text>
              <TouchableOpacity
                onPress={onClose}
                className="p-1 -mr-1 active:opacity-70"
                accessibilityRole="button"
                accessibilityLabel="Close sidebar"
              >
                <Ionicons name="close" size={26} color="#34594A" />
              </TouchableOpacity>
            </View>

            {/* Navigation Menu List */}
            <ScrollView
              className="flex-1 px-3"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingBottom: 28 }}
            >
              {MENU_ITEMS.map((item) => {
                const isActive = activeTab === item;

                return (
                  <TouchableOpacity
                    key={item}
                    onPress={() => handlePressItem(item)}
                    activeOpacity={0.8}
                    className={`py-3.5 px-4 rounded-xl flex-row items-center ${
                      isActive
                        ? "bg-[#34594A]"
                        : "bg-transparent active:bg-gray-100"
                    }`}
                  >
                    <Text
                      className={`text-base pl-1 ${
                        isActive
                          ? "text-white font-bold"
                          : "text-gray-800 font-medium"
                      }`}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </SafeAreaView>
        </Pressable>
      </View>
    </Modal>
  );
}
