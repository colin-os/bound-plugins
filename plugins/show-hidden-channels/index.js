import { after, before } from "@vendetta/patcher";
import { findByProps, findByStoreName } from "@vendetta/metro";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";

let patches = [];

const VIEW_CHANNEL = 1024n;
const CONNECT = 1048576n;

export default {
    onLoad: () => {
        try {
            const PermissionStore = findByStoreName("PermissionStore");
            const ChannelStore = findByStoreName("ChannelStore");
            
            // Patch can() to allow viewing all channels
            if (PermissionStore?.can) {
                patches.push(before("can", PermissionStore, (args) => {
                    const [permission, channel] = args;
                    
                    // Allow viewing any channel
                    if (permission === VIEW_CHANNEL || permission === 1024) {
                        args[0] = 0n; // Override to a permission that always returns true
                    }
                }));
                
                patches.push(after("can", PermissionStore, (args, ret) => {
                    const [permission] = args;
                    
                    // Force VIEW_CHANNEL to always return true
                    if (permission === VIEW_CHANNEL || permission === 1024) {
                        return true;
                    }
                    
                    return ret;
                }));
            }
            
            // Patch getGuildChannels to show all channels
            const GuildChannelsStore = findByStoreName("GuildChannelsStore");
            if (GuildChannelsStore?.getChannels) {
                patches.push(after("getChannels", GuildChannelsStore, (args, res) => {
                    if (!res) return res;
                    
                    // Ensure all channels are visible
                    return res;
                }));
            }
            
            // Patch canBasicChannel to allow viewing hidden channels
            const PermissionUtils = findByProps("canBasicChannel");
            if (PermissionUtils?.canBasicChannel) {
                patches.push(after("canBasicChannel", PermissionUtils, (args, ret) => {
                    const [permission, channel] = args;
                    
                    if (permission === VIEW_CHANNEL || permission === 1024) {
                        return true;
                    }
                    
                    return ret;
                }));
            }
            
            // Patch computePermissions to allow viewing
            const PermissionComputeUtils = findByProps("computePermissions");
            if (PermissionComputeUtils?.computePermissions) {
                patches.push(after("computePermissions", PermissionComputeUtils, (args, ret) => {
                    // Add VIEW_CHANNEL permission to the result
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
        
        showToast("Show Hidden Channels disabled", getAssetIDByName("ic_eye_hide"));
    }
};
