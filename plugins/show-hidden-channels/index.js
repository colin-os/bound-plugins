import { after, before } from "@vendetta/patcher";
import { findByProps, findByName, findByStoreName } from "@vendetta/metro";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import { ReactNative as RN } from "@vendetta/metro/common";

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
            
            // Patch channel list item rendering to add lock icon
            try {
                const ChannelItem = findByName("ChannelItem", false) || findByName("Channel", false);
                if (ChannelItem) {
                    patches.push(after("default", ChannelItem, (args, ret) => {
                        try {
                            const channel = args?.[0]?.channel;
                            if (channel?.id && isChannelHidden(channel.id) && ret) {
                                // Try to find and modify the channel name text
                                const findTextInChildren = (children) => {
                                    if (!children) return;
                                    
                                    if (Array.isArray(children)) {
                                        for (let i = 0; i < children.length; i++) {
                                            if (typeof children[i] === 'string' && children[i] === channel.name) {
                                                children[i] = `🔒 ${children[i]}`;
                                                return true;
                                            }
                                            if (children[i]?.props?.children) {
                                                if (findTextInChildren(children[i].props.children)) return true;
                                            }
                                        }
                                    } else if (typeof children === 'string' && children === channel.name) {
                                        return `🔒 ${children}`;
                                    } else if (children?.props?.children) {
                                        return findTextInChildren(children.props.children);
                                    }
                                };
                                
                                if (ret.props?.children) {
                                    findTextInChildren(ret.props.children);
                                }
                            }
                        } catch (e) {
                            // Silently fail if we can't patch this specific render
                        }
                        return ret;
                    }));
                }
            } catch (e) {
                console.log("Could not patch channel rendering:", e);
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
                
                // Patch hasRelevantUnread to return false for hidden channels
                if (ReadStateStore.hasRelevantUnread) {
                    patches.push(after("hasRelevantUnread", ReadStateStore, (args, ret) => {
                        const channelId = args[0];
                        if (isChannelHidden(channelId)) {
                            return false;
                        }
                        return ret;
                    }));
                }
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
            
            // No startup toast - silent enable
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
        
        // No toast on unload either
    }
};
