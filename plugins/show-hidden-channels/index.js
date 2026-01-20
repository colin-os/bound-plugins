import { after, before } from "@vendetta/patcher";
import { findByProps, findByName, findByStoreName, findByDisplayName } from "@vendetta/metro";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import { React } from "@vendetta/metro/common";

let patches = [];
let hiddenChannelIds = new Set();

const VIEW_CHANNEL = 1024n;
const CONNECT = 1048576n;

// Track which channels are actually hidden
function isChannelHidden(channelId) {
    return hiddenChannelIds.has(channelId);
}

// Deep search for text to modify
function patchTextInElement(element, channelName) {
    if (!element) return element;
    
    try {
        // Direct string check
        if (typeof element === 'string') {
            if (element === channelName || element.includes(channelName)) {
                return `🔒 ${element}`;
            }
            return element;
        }
        
        // Check if it's a React element
        if (element?.props) {
            const newProps = { ...element.props };
            
            // Check children
            if (newProps.children) {
                if (typeof newProps.children === 'string') {
                    if (newProps.children === channelName || newProps.children.includes(channelName)) {
                        newProps.children = `🔒 ${newProps.children}`;
                    }
                } else if (Array.isArray(newProps.children)) {
                    newProps.children = newProps.children.map(child => patchTextInElement(child, channelName));
                } else {
                    newProps.children = patchTextInElement(newProps.children, channelName);
                }
            }
            
            // Check text prop specifically
            if (typeof newProps.text === 'string' && newProps.text === channelName) {
                newProps.text = `🔒 ${newProps.text}`;
            }
            
            return React.cloneElement(element, newProps);
        }
        
        // Array of elements
        if (Array.isArray(element)) {
            return element.map(el => patchTextInElement(el, channelName));
        }
    } catch (e) {
        // Return original if patching fails
    }
    
    return element;
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
            
            // Try multiple component patching strategies
            const componentNames = [
                "ChannelItem",
                "Channel", 
                "ChannelListItem",
                "GuildChannel",
                "VoiceChannel",
                "TextChannel"
            ];
            
            for (const componentName of componentNames) {
                try {
                    const Component = findByDisplayName(componentName, false) || findByName(componentName, false);
                    if (Component?.default || Component?.type || Component) {
                        const target = Component.default || Component.type || Component;
                        
                        patches.push(after("render", target.prototype || target, function(args, ret) {
                            try {
                                const channel = this?.props?.channel || args?.[0]?.channel;
                                if (channel?.id && channel?.name && isChannelHidden(channel.id)) {
                                    return patchTextInElement(ret, channel.name);
                                }
                            } catch (e) {}
                            return ret;
                        }));
                        
                        // Also try patching default export
                        if (target.default) {
                            patches.push(after("default", Component, (args, ret) => {
                                try {
                                    const channel = args?.[0]?.channel;
                                    if (channel?.id && channel?.name && isChannelHidden(channel.id)) {
                                        return patchTextInElement(ret, channel.name);
                                    }
                                } catch (e) {}
                                return ret;
                            }));
                        }
                    }
                } catch (e) {
                    // Continue to next component
                }
            }
            
            // Try patching Text component directly
            try {
                const Text = findByDisplayName("Text", false);
                if (Text) {
                    patches.push(after("render", Text.prototype, function(args, ret) {
                        try {
                            const text = this?.props?.children || this?.props?.text;
                            if (typeof text === 'string') {
                                // Check if this text matches any hidden channel
                                for (const channelId of hiddenChannelIds) {
                                    const channel = ChannelStore?.getChannel(channelId);
                                    if (channel?.name === text && !text.startsWith('🔒')) {
                                        if (ret?.props) {
                                            ret.props.children = `🔒 ${text}`;
                                        }
                                        return ret;
                                    }
                                }
                            }
                        } catch (e) {}
                        return ret;
                    }));
                }
            } catch (e) {}
            
            // Clear notification badges for hidden channels
            if (ReadStateStore) {
                if (ReadStateStore.getMentionCount) {
                    patches.push(after("getMentionCount", ReadStateStore, (args, ret) => {
                        const channelId = args[0];
                        if (isChannelHidden(channelId)) {
                            return 0;
                        }
                        return ret;
                    }));
                }
                
                if (ReadStateStore.getUnreadCount) {
                    patches.push(after("getUnreadCount", ReadStateStore, (args, ret) => {
                        const channelId = args[0];
                        if (isChannelHidden(channelId)) {
                            return 0;
                        }
                        return ret;
                    }));
                }
                
                if (ReadStateStore.hasUnread) {
                    patches.push(after("hasUnread", ReadStateStore, (args, ret) => {
                        const channelId = args[0];
                        if (isChannelHidden(channelId)) {
                            return false;
                        }
                        return ret;
                    }));
                }
                
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
            
        } catch (error) {
            showToast("Failed to load Show Hidden Channels: " + error.message, getAssetIDByName("ic_close_circle"));
            console.error("Show Hidden Channels error:", error);
        }
    },
    
    onUnload: () => {
        for (const unpatch of patches) {
            unpatch?.();
        }
        patches = [];
        hiddenChannelIds.clear();
    }
};
