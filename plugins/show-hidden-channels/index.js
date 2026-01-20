import { after, before } from "@vendetta/patcher";
import { findByProps, findByStoreName } from "@vendetta/metro";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";

let patches = [];
let hiddenChannelIds = new Set();

const VIEW_CHANNEL = 1024n;
const CONNECT = 1048576n;

// Track which channels are actually hidden
function isChannelHidden(channelId) {
    return hiddenChannelIds.has(channelId);
}

export default {
    onLoad: () => {
        try {
            const PermissionStore = findByStoreName("PermissionStore");
            const ChannelStore = findByStoreName("ChannelStore");
            const ReadStateStore = findByStoreName("ReadStateStore");
            
            // Track original permissions to identify hidden channels
            if (PermissionStore?.can) {
                patches.push(before("can", PermissionStore, (args) => {
                    const [permission, channel] = args;
                    
                    // Check if this channel is actually hidden
                    if ((permission === VIEW_CHANNEL || permission === 1024) && channel?.id) {
                        // Store the original permission check result
                        const originalCan = PermissionStore.can.__original || PermissionStore.can;
                        try {
                            const hasRealAccess = originalCan.call(PermissionStore, permission, channel);
                            if (!hasRealAccess) {
                                hiddenChannelIds.add(channel.id);
                            }
                        } catch (e) {
                            // If we can't check, assume it's hidden
                            hiddenChannelIds.add(channel.id);
                        }
                    }
                }));
                
                // Override permission check to allow viewing
                patches.push(after("can", PermissionStore, (args, ret) => {
                    const [permission, channel] = args;
                    
                    // Force VIEW_CHANNEL to always return true
                    if (permission === VIEW_CHANNEL || permission === 1024) {
                        return true;
                    }
                    
                    return ret;
                }));
            }
            
            // Clear notification badges for hidden channels
            if (ReadStateStore) {
                // Patch getMentionCount to return 0 for hidden channels
                if (ReadStateStore.getMentionCount) {
                    patches.push(after("getMentionCount", ReadStateStore, (args, ret) => {
                        const channelId = args[0];
                        if (isChannelHidden(channelId)) {
                            return 0;
                        }
                        return ret;
                    }));
                }
                
                // Patch getUnreadCount to return 0 for hidden channels
                if (ReadStateStore.getUnreadCount) {
                    patches.push(after("getUnreadCount", ReadStateStore, (args, ret) => {
                        const channelId = args[0];
                        if (isChannelHidden(channelId)) {
                            return 0;
                        }
                        return ret;
                    }));
                }
                
                // Patch hasUnread to return false for hidden channels
                if (ReadStateStore.hasUnread) {
                    patches.push(after("hasUnread", ReadStateStore, (args, ret) => {
                        const channelId = args[0];
                        if (isChannelHidden(channelId)) {
                            return false;
                        }
                        return ret;
                    }));
                }
            }
            
            // Add lock icon to hidden channels
            const Channel = findByProps("ChannelRecordBase") || findByProps("Channel");
            if (Channel) {
                // Patch channel icon to show lock for hidden channels
                patches.push(after("getChannelIconURL", Channel, (args, ret) => {
                    const channel = args[0];
                    if (channel?.id && isChannelHidden(channel.id)) {
                        return "lock"; // This will display a lock icon
                    }
                    return ret;
                }));
            }
            
            // Patch channel rendering to add lock indicator
            const ChannelItem = findByProps("ChannelItem");
            if (ChannelItem) {
                patches.push(after("ChannelItem", ChannelItem, (args, ret) => {
                    const channel = args[0]?.channel;
                    if (channel?.id && isChannelHidden(channel.id)) {
                        // Add visual indicator that this is a hidden channel
                        if (ret?.props) {
                            ret.props.locked = true;
                        }
                    }
                    return ret;
                }));
            }
            
            // Patch canBasicChannel to allow viewing
            const PermissionUtils = findByProps("canBasicChannel");
            if (PermissionUtils?.canBasicChannel) {
                patches.push(after("canBasicChannel", PermissionUtils, (args, ret) => {
                    const [permission] = args;
                    
                    if (permission === VIEW_CHANNEL || permission === 1024) {
                        return true;
                    }
                    
                    return ret;
                }));
            }
            
            // Patch computePermissions to add VIEW_CHANNEL
            const PermissionComputeUtils = findByProps("computePermissions");
            if (PermissionComputeUtils?.computePermissions) {
                patches.push(after("computePermissions", PermissionComputeUtils, (args, ret) => {
                    return ret | VIEW_CHANNEL;
                }));
            }
            
            showToast("Show Hidden Channels enabled!", getAssetIDByName("ic_eye_show"));
        } catch (error) {
            showToast("Failed to load Show Hidden Channels: " + error.message, getAssetIDByName("ic_close_circle"));
            console.error("Show Hidden Channels error:", error);
        }
    },
    
    onUnload: () => {
        // Remove all patches
        for (const unpatch of patches) {
            unpatch?.();
        }
        patches = [];
        hiddenChannelIds.clear();
        
        showToast("Show Hidden Channels disabled", getAssetIDByName("ic_eye_hide"));
    }
};
