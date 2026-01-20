import { storage } from "@vendetta/plugin";
import { findByProps, findByName } from "@vendetta/metro";
import { after } from "@vendetta/patcher";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import { React, ReactNative } from "@vendetta/metro/common";

const { View, Text, TouchableOpacity, TextInput, ScrollView } = ReactNative;
let patches = [];

// Webhook API helper
const WebhookAPI = {
    async createWebhook(channelId, name, avatar) {
        const API = findByProps("post", "get", "patch");
        try {
            const response = await API.post({
                url: `/channels/${channelId}/webhooks`,
                body: {
                    name: name || "New Webhook",
                    avatar: avatar || null
                }
            });
            return response.body;
        } catch (error) {
            showToast("Failed to create webhook: " + error.message, getAssetIDByName("ic_close_circle"));
            throw error;
        }
    },
    
    async getChannelWebhooks(channelId) {
        const API = findByProps("post", "get", "patch");
        try {
            const response = await API.get({
                url: `/channels/${channelId}/webhooks`
            });
            return response.body;
        } catch (error) {
            showToast("Failed to fetch webhooks: " + error.message, getAssetIDByName("ic_close_circle"));
            return [];
        }
    },
    
    async deleteWebhook(webhookId) {
        const API = findByProps("post", "get", "patch");
        try {
            await API.delete({
                url: `/webhooks/${webhookId}`
            });
            showToast("Webhook deleted successfully", getAssetIDByName("ic_check"));
        } catch (error) {
            showToast("Failed to delete webhook: " + error.message, getAssetIDByName("ic_close_circle"));
            throw error;
        }
    }
};

// Webhook UI Component
function WebhookCreator({ channelId, onClose }) {
    const [name, setName] = React.useState("New Webhook");
    const [webhooks, setWebhooks] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    
    React.useEffect(() => {
        loadWebhooks();
    }, []);
    
    const loadWebhooks = async () => {
        const hooks = await WebhookAPI.getChannelWebhooks(channelId);
        setWebhooks(hooks);
    };
    
    const handleCreate = async () => {
        setLoading(true);
        try {
            await WebhookAPI.createWebhook(channelId, name);
            showToast("Webhook created successfully!", getAssetIDByName("ic_check"));
            await loadWebhooks();
            setName("New Webhook");
        } catch (error) {
            // Error already shown in API
        } finally {
            setLoading(false);
        }
    };
    
    const handleDelete = async (webhookId) => {
        try {
            await WebhookAPI.deleteWebhook(webhookId);
            await loadWebhooks();
        } catch (error) {
            // Error already shown in API
        }
    };
    
    return (
        <ScrollView style={{ flex: 1, padding: 16 }}>
            <Text style={{ fontSize: 20, fontWeight: "bold", marginBottom: 16, color: "white" }}>
                Webhook Manager
            </Text>
            
            <Text style={{ fontSize: 14, marginBottom: 8, color: "#b9bbbe" }}>
                Webhook Name:
            </Text>
            <TextInput
                value={name}
                onChangeText={setName}
                style={{
                    backgroundColor: "#40444b",
                    color: "white",
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 12
                }}
                placeholder="Enter webhook name"
                placeholderTextColor="#72767d"
            />
            
            <TouchableOpacity
                onPress={handleCreate}
                disabled={loading}
                style={{
                    backgroundColor: loading ? "#43b581" : "#5865f2",
                    padding: 12,
                    borderRadius: 8,
                    alignItems: "center",
                    marginBottom: 24,
                    opacity: loading ? 0.5 : 1
                }}
            >
                <Text style={{ color: "white", fontWeight: "bold" }}>
                    {loading ? "Creating..." : "Create Webhook"}
                </Text>
            </TouchableOpacity>
            
            <Text style={{ fontSize: 18, fontWeight: "bold", marginBottom: 12, color: "white" }}>
                Existing Webhooks ({webhooks.length})
            </Text>
            
            {webhooks.map((webhook) => (
                <View
                    key={webhook.id}
                    style={{
                        backgroundColor: "#2f3136",
                        padding: 12,
                        borderRadius: 8,
                        marginBottom: 8,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center"
                    }}
                >
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: "white", fontWeight: "bold", marginBottom: 4 }}>
                            {webhook.name}
                        </Text>
                        <Text style={{ color: "#72767d", fontSize: 12 }}>
                            {webhook.id}
                        </Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => handleDelete(webhook.id)}
                        style={{
                            backgroundColor: "#ed4245",
                            padding: 8,
                            borderRadius: 6
                        }}
                    >
                        <Text style={{ color: "white", fontWeight: "bold" }}>Delete</Text>
                    </TouchableOpacity>
                </View>
            ))}
        </ScrollView>
    );
}

export default {
    onLoad: () => {
        storage.webhookCreator = WebhookCreator;
        showToast("Mobile Webhooks loaded! Long press a channel to access webhook options.", getAssetIDByName("ic_check"));
    },
    onUnload: () => {
        for (const unpatch of patches) {
            unpatch();
        }
        patches = [];
        delete storage.webhookCreator;
    },
    WebhookAPI,
    WebhookCreator
};
