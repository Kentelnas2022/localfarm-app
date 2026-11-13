import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface GuideArticle {
  id: string;
  category:
    | "rsbsa"
    | "pricing"
    | "harvest"
    | "safety"
    | "payments"
    | "packaging";
  categoryLabel: string;
  title: string;
  subtitle: string;
  readTime: string;
  icon: keyof typeof Ionicons.glyphMap;
  badge?: string;
  sections: {
    heading: string;
    content: string;
    points?: string[];
  }[];
  actionButton?: {
    text: string;
    route: string;
    icon: keyof typeof Ionicons.glyphMap;
  };
}

const GUIDE_ARTICLES: GuideArticle[] = [
  {
    id: "g1",
    category: "rsbsa",
    categoryLabel: "RSBSA & Badges",
    title: "How to Get RSBSA Verified & Earn the Green Badge",
    subtitle:
      "A complete guide to government agricultural registration and unlocking trust on Local Farm.",
    readTime: "4 min read",
    icon: "ribbon-outline",
    badge: "Most Important",
    sections: [
      {
        heading: "What is RSBSA?",
        content:
          "The Registry System for Basic Sectors in Agriculture (RSBSA) is an electronic database of Filipino farmers, farm workers, and fisherfolk managed by the Department of Agriculture (DA). It serves as the baseline requirement for agricultural assistance, government subsidies, and official farmer certification.",
      },
      {
        heading: "Who is Eligible to Register?",
        content:
          "Any individual actively engaged in agricultural production within the Philippines:",
        points: [
          "Farmers cultivating rice, corn, rootcrops, high-value vegetables, or fruit trees",
          "Livestock, swine, or poultry smallholder growers",
          "Agricultural laborers and farm tenants with barangay certification",
        ],
      },
      {
        heading: "Benefits of the Green Verified Badge on Local Farm",
        content:
          "Accounts with verified RSBSA certification receive prominent platform advantages:",
        points: [
          "A distinctive green badge next to your farm name across all listings, feed posts, and map pins",
          "Exclusive access to broadcast Live video streams directly from your farm to buyers",
          "3x higher search ranking in Nearby Farms and Explore Map results",
          "Higher buyer trust resulting in immediate upfront bank/GCash deposits",
          "Protection from automated listing volume caps",
        ],
      },
      {
        heading: "How to Apply on Local Farm",
        content:
          "Submit your RSBSA Certificate number or Barangay Farming Certification along with a clear photo of your ID or certificate in the Security & Verification tab.",
      },
    ],
    actionButton: {
      text: "Apply for RSBSA Verification",
      route: "/user/RSBSAVerification",
      icon: "checkmark-circle-outline",
    },
  },
  {
    id: "g2",
    category: "pricing",
    categoryLabel: "Harvest & Pricing",
    title: "Setting Fair Produce Prices & Volume Tiers",
    subtitle:
      "How to balance competitive consumer pricing with profitable farm-gate margins.",
    readTime: "3 min read",
    icon: "pricetags-outline",
    sections: [
      {
        heading: "Standardize Your Unit Pricing",
        content:
          "Buyers appreciate clarity. Always specify standardized metric units rather than ambiguous plastic bag sizes:",
        points: [
          "Per kilogram (₱/kg) for vegetables, fruits, and tubers",
          "Per crate / kaing (typically 20kg or 25kg) for bulk fruit pickers",
          "Per bundle for leafy greens (specify approximate weight, e.g., 250g/bundle)",
          "Per sack (50kg) for grains, rootcrops, or animal feeds",
        ],
      },
      {
        heading: "Wholesale & Volume Discounts",
        content:
          "Attract institutional buyers (local karinderyas, restaurants, and market vendors) by offering stepped volume tiers. For instance: ₱60/kg for 1–10kg, and ₱48/kg for orders exceeding 50kg.",
      },
      {
        heading: "Price Transparency Settings",
        content:
          "You can choose whether your pricing is publicly visible to all guests or only to verified registered buyers in Settings > Privacy Center.",
      },
    ],
  },
  {
    id: "g3",
    category: "harvest",
    categoryLabel: "Harvest Scheduling",
    title: "Pre-Orders, Harvest Dates & Typhoon Disruptions",
    subtitle:
      "Mastering harvest listings and keeping buyers informed during unexpected weather delays.",
    readTime: "3 min read",
    icon: "calendar-outline",
    sections: [
      {
        heading: "List Expected Harvests 3–5 Days Early",
        content:
          "Do not wait until the day of harvest to list perishable crops. By listing 3 to 5 days in advance, nearby consumers and businesses can pre-order, eliminating produce spoilage at the farm gate.",
      },
      {
        heading: "Handling Monsoon & Weather Delays",
        content:
          "Heavy rainfall and tropical storms frequently interrupt harvest schedules. If cutting must be postponed:",
        points: [
          "Immediately broadcast an update in Chat to all buyers holding reserved orders",
          "Adjust the expected availability date on your harvest listing",
          "Honest, prompt communication prevents order cancellations and protects your 5-star grower rating",
        ],
      },
    ],
  },
  {
    id: "g4",
    category: "safety",
    categoryLabel: "Farm-Gate Safety",
    title: "Safe Farm-Gate Pickups & Roadside Collection",
    subtitle:
      "Guidelines for protecting your personal homestead while fulfilling buyer pickups.",
    readTime: "3 min read",
    icon: "shield-checkmark-outline",
    badge: "Safety",
    sections: [
      {
        heading: "Use Approximate Map Location",
        content:
          "To safeguard personal farming equipment, machinery, and family homesteads from theft, keep your Explore Map pin set to 'Approximate Area' (a ~1km circular radius).",
      },
      {
        heading: "Designated Public Collection Points",
        content:
          "For buyers you haven't transacted with before, designate a roadside farm-gate landmark, barangay hall outpost, or cooperative warehouse as the pickup rendezvous point rather than your home residence.",
      },
      {
        heading: "Daylight Pickup Windows",
        content:
          "Only schedule order handovers between 7:00 AM and 5:00 PM. Never meet unverified buyers at secluded farm plots after dark.",
      },
    ],
  },
  {
    id: "g5",
    category: "payments",
    categoryLabel: "Payment & Scams",
    title: "Preventing Payment Fraud & Fake Deposit Slips",
    subtitle:
      "Protect your hard-earned harvest against falsified GCash or bank transfer screenshots.",
    readTime: "4 min read",
    icon: "cash-outline",
    badge: "Security",
    sections: [
      {
        heading: "The 'Screenshot Scam' Warning",
        content:
          "Scammers frequently use photo-editing software to forge GCash or online bank transfer confirmation receipts. Never release harvest crates solely because the buyer showed you a screenshot on their phone.",
      },
      {
        heading: "The Golden Rule: Check Your Own Balance",
        content:
          "Always open your own GCash, Maya, or mobile banking application and confirm that the funds have cleared into your actual account balance before loading crops onto the buyer's vehicle.",
      },
      {
        heading: "Buyer No-Shows",
        content:
          "If a buyer reserves bulk produce and fails to arrive without notice, report the incident immediately via 'Report an Issue'. Accounts that repeatedly abandon perishable pre-orders are penalized and banned to protect farmers.",
      },
    ],
    actionButton: {
      text: "Report a Payment Dispute",
      route: "/user/ReportIssue",
      icon: "warning-outline",
    },
  },
  {
    id: "g6",
    category: "packaging",
    categoryLabel: "Packaging & Quality",
    title: "Produce Sorting, Grading & Packaging Standards",
    subtitle:
      "Simple post-harvest practices that command higher prices and repeat buyers.",
    readTime: "3 min read",
    icon: "cube-outline",
    sections: [
      {
        heading: "Grading Produce Fairly (Class A vs Class B)",
        content:
          "Be transparent about cosmetic imperfections. Grade A vegetables (uniform size, zero blemishes) command premium prices. Slightly deformed produce should be offered at discounted 'Processing/Kitchen Grade' rates.",
      },
      {
        heading: "Breathable Storage Containers",
        content:
          "Avoid sealing freshly picked greens in airtight plastic bags under the sun, which induces heat buildup and rapid rotting. Use ventilated plastic harvest crates, wooden boxes, or banana leaf linings for optimal freshness.",
      },
    ],
  },
];

export default function GrowerGuides() {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGuideId, setExpandedGuideId] = useState<string | null>("g1");

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push("/user/MenuProfile" as any);
    }
  };

  const filteredArticles = useMemo(() => {
    return GUIDE_ARTICLES.filter((article) => {
      const matchesCategory =
        selectedCategory === "all" || article.category === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        query === "" ||
        article.title.toLowerCase().includes(query) ||
        article.subtitle.toLowerCase().includes(query) ||
        article.categoryLabel.toLowerCase().includes(query) ||
        article.sections.some(
          (s) =>
            s.heading.toLowerCase().includes(query) ||
            s.content.toLowerCase().includes(query)
        );
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const toggleExpand = (id: string) => {
    setExpandedGuideId((prev) => (prev === id ? null : id));
  };

  return (
    <SafeAreaView
      className="flex-1 bg-[#F8F9FA] relative h-full"
      style={{ flex: 1, backgroundColor: "#F8F9FA" }}
    >
      {/* Header */}
      <View className="relative items-center justify-center pt-3 pb-4 px-4 bg-white border-b border-gray-100">
        <TouchableOpacity
          onPress={handleBack}
          activeOpacity={0.7}
          className="absolute left-4 top-3 p-1"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-undo" size={28} color="#000000" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Grower Guides</Text>
      </View>

      <ScrollView
        className="flex-1 px-4 pt-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Hero Agricultural Handbook Card */}
        <View className="bg-[#2D4F28] rounded-2xl p-5 mb-5 shadow-xs overflow-hidden relative">
          <View className="absolute -right-4 -bottom-4 opacity-10">
            <Ionicons name="leaf" size={130} color="#FFFFFF" />
          </View>
          <View className="flex-row items-center gap-2 mb-1.5">
            <View className="w-6 h-6 rounded-full bg-emerald-500/30 items-center justify-center">
              <Ionicons name="book-outline" size={14} color="#A7F3D0" />
            </View>
            <Text className="text-xs font-bold text-emerald-200 uppercase tracking-wider">
              Grower Success & Standards Handbook
            </Text>
          </View>
          <Text className="text-lg font-bold text-white mb-1">
            Grow, Sell & Prosper Locally
          </Text>
          <Text className="text-xs text-gray-200 leading-5 pr-6">
            Essential knowledge for smallholder growers: from securing your RSBSA Green Badge to farm-gate pricing ethics, harvest logistics, and scam prevention.
          </Text>
        </View>

        {/* Search Bar */}
        <View className="bg-white rounded-2xl p-2.5 px-3.5 mb-4 border border-gray-200 flex-row items-center shadow-2xs">
          <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search guides (e.g. RSBSA, pricing, fake slips)..."
            placeholderTextColor="#9CA3AF"
            className="flex-1 ml-2 text-xs text-gray-900"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Horizontal Pill Filters */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-5"
          contentContainerStyle={{ gap: 8, paddingHorizontal: 2 }}
        >
          {[
            { id: "all", label: "All Guides", icon: "grid-outline" },
            { id: "rsbsa", label: "RSBSA & Badges", icon: "ribbon-outline" },
            { id: "pricing", label: "Pricing & Tiers", icon: "pricetags-outline" },
            { id: "harvest", label: "Harvest & Pre-orders", icon: "calendar-outline" },
            { id: "safety", label: "Farm-gate Safety", icon: "shield-outline" },
            { id: "payments", label: "Scam Prevention", icon: "cash-outline" },
            { id: "packaging", label: "Packaging & Quality", icon: "cube-outline" },
          ].map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedCategory(cat.id)}
                className={`flex-row items-center px-3 py-2 rounded-xl border ${
                  isSelected
                    ? "bg-[#77af5c] border-[#77af5c]"
                    : "bg-white border-gray-200"
                }`}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={14}
                  color={isSelected ? "#FFFFFF" : "#4B5563"}
                />
                <Text
                  className={`text-xs font-semibold ml-1.5 ${
                    isSelected ? "text-white" : "text-gray-700"
                  }`}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Guides List */}
        <View className="gap-3.5">
          {filteredArticles.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center justify-center border border-gray-100 shadow-xs">
              <Ionicons name="book-outline" size={36} color="#9CA3AF" />
              <Text className="text-sm font-bold text-gray-800 mt-2">
                No guides match your search
              </Text>
              <Text className="text-xs text-gray-500 text-center mt-1">
                Try searching for &quot;RSBSA&quot;, &quot;pricing&quot;, or browse all topics.
              </Text>
            </View>
          ) : (
            filteredArticles.map((article) => {
              const isExpanded = expandedGuideId === article.id;

              return (
                <View
                  key={article.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-2xs overflow-hidden"
                >
                  {/* Article Card Header */}
                  <TouchableOpacity
                    onPress={() => toggleExpand(article.id)}
                    activeOpacity={0.7}
                    className="p-4"
                  >
                    <View className="flex-row items-center justify-between mb-2">
                      <View className="flex-row items-center gap-2">
                        <View className="w-8 h-8 rounded-xl bg-emerald-50 items-center justify-center border border-emerald-100">
                          <Ionicons
                            name={article.icon}
                            size={18}
                            color="#059669"
                          />
                        </View>
                        <View className="bg-gray-100 px-2 py-0.5 rounded-md">
                          <Text className="text-[10px] font-bold text-gray-700">
                            {article.categoryLabel}
                          </Text>
                        </View>
                        {article.badge && (
                          <View className="bg-amber-100 px-2 py-0.5 rounded-md">
                            <Text className="text-[10px] font-bold text-amber-800">
                              {article.badge}
                            </Text>
                          </View>
                        )}
                      </View>

                      <Text className="text-[10px] text-gray-400 font-medium">
                        {article.readTime}
                      </Text>
                    </View>

                    <Text className="text-base font-bold text-gray-900 leading-snug mb-1">
                      {article.title}
                    </Text>
                    <Text className="text-xs text-gray-500 leading-4 mb-2">
                      {article.subtitle}
                    </Text>

                    <View className="flex-row items-center justify-between pt-1 border-t border-gray-50">
                      <Text className="text-xs font-semibold text-[#77af5c]">
                        {isExpanded ? "Collapse Guide" : "Read Full Guide"}
                      </Text>
                      <Ionicons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color="#77af5c"
                      />
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Guide Content */}
                  {isExpanded && (
                    <View className="px-5 pb-5 pt-3 border-t border-gray-100 bg-gray-50/50">
                      {article.sections.map((section, sIdx) => (
                        <View key={sIdx} className="mb-4">
                          <Text className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-1">
                            {section.heading}
                          </Text>
                          <Text className="text-xs text-gray-600 leading-5">
                            {section.content}
                          </Text>

                          {section.points && (
                            <View className="mt-2 space-y-1.5 pl-1">
                              {section.points.map((pt, pIdx) => (
                                <View
                                  key={pIdx}
                                  className="flex-row items-start gap-2 mb-1"
                                >
                                  <View className="w-1.5 h-1.5 rounded-full bg-[#77af5c] mt-1.5" />
                                  <Text className="text-xs text-gray-700 leading-4.5 flex-1">
                                    {pt}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      ))}

                      {/* Optional Action Callout Button */}
                      {article.actionButton && (
                        <TouchableOpacity
                          onPress={() =>
                            router.push(article.actionButton!.route as any)
                          }
                          activeOpacity={0.8}
                          className="mt-2 bg-[#77af5c] py-3 px-4 rounded-xl flex-row items-center justify-center gap-2 active:bg-[#689d50]"
                        >
                          <Ionicons
                            name={article.actionButton.icon}
                            size={16}
                            color="#FFFFFF"
                          />
                          <Text className="text-xs font-bold text-white">
                            {article.actionButton.text}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Footer Support Desk Card */}
        <View className="mt-6 p-4 rounded-2xl bg-white border border-gray-100 shadow-2xs items-center">
          <Ionicons name="help-buoy-outline" size={30} color="#77af5c" />
          <Text className="text-sm font-bold text-gray-900 mt-2">
            Have a question not covered here?
          </Text>
          <Text className="text-xs text-gray-500 text-center mt-1 mb-3 leading-4">
            Our agricultural team is available to assist with verification and dispute resolution.
          </Text>
          <TouchableOpacity
            onPress={() => router.push("/user/ReportIssue" as any)}
            className="bg-[#2D4F28] px-4 py-2 rounded-xl flex-row items-center gap-1.5 active:bg-[#233f20]"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={14} color="#FFFFFF" />
            <Text className="text-xs font-bold text-white">
              Contact Support Desk
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
