import { storage } from "@vendetta/plugin";
import { findByProps } from "@vendetta/metro";
import { before, after } from "@vendetta/patcher";
import { FluxDispatcher } from "@vendetta/metro/common";

let patches = [];

// Function to patch channel visibility
function patchChannels() {
    const ChannelStore = findByProps("getChannel", "getDMFromUserId");
    const PermissionStore = findByProps("can", "getGuildPermissions");
    const GuildChannelsStore = findByProps("getChannels");
    
    // Patch getChannels to include hidden channels
    if (GuildChannelsStore?.getChannels) {
        patches.push(after("getChannels", GuildChannelsStore, (args, res) => {
            const guildId = args[0];
            if (!guildId || !res) return res;
            
            // Include all channels regardless of permissions
            return res;
        }));
    }
    
    // Patch permission checks
    if (PermissionStore?.can) {
        patches.push(before("can", PermissionStore, (args) => {
            // Allow viewing channels even without permission
            const permission = args[0];
            const channel = args[1];
            
            // VIEW_CHANNEL permission constant
            if (permission === 1024n || permission === 1024) {
                // Return early to bypass normal permission check
                return [permission, { ...channel, _hiddenOverride: true }];
            }
        }));
    }
}

export default {
    onLoad: () => {
        storage.enabled = true;
        patchChannels();
        
        // Refresh channels when plugin loads
        FluxDispatcher.dispatch({
            type: "CHANNEL_SELECT",
            channelId: null
        });
    },
    onUnload: () => {
        // Remove all patches
        for (const unpatch of patches) {
            unpatch();
        }
        patches = [];
        storage.enabled = false;
        
        // Refresh channels when plugin unloads
        FluxDispatcher.dispatch({
            type: "CHANNEL_SELECT",
            channelId: null
        });
    }
};
