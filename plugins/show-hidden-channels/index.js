import { findByName, findByProps, findByStoreName } from "@vendetta/metro";
import { constants, React, stylesheet } from "@vendetta/metro/common";
import { instead, after } from "@vendetta/patcher";
import { semanticColors } from '@vendetta/ui';
import { showToast } from "@vendetta/ui/toasts";
import { getAssetIDByName } from "@vendetta/ui/assets";

let patches = [];
let Permissions, Router, Fetcher, ChannelTypes, ChannelStore, ReadStateStore, View, Text;
let skipChannels = [];
let channelNameCache = new Map();

const MessageStyles = stylesheet.createThemedStyleSheet({
    'container': {
        'flex': 1,
        'padding': 16,
        'alignItems': 'center',
        'justifyContent': 'center',
    },
    'title': {
        'fontFamily': constants.Fonts.PRIMARY_SEMIBOLD,
        'fontSize': 24,
        'textAlign': 'center',
        'color': semanticColors.HEADER_PRIMARY,
        'paddingVertical': 25
    },
    'text': {
        'fontSize': 16,
        'textAlign': 'center',
        'color': semanticColors.HEADER_SECONDARY,
    },
});

function HiddenChannelView({channel}) {
    return React.createElement(View, { style: MessageStyles.container },
        React.createElement(Text, { style: MessageStyles.title }, `🔒 ${channel.name?.replace('🔒 ', '') || 'Hidden Channel'}`),
        React.createElement(Text, { style: MessageStyles.text }, 
            channel.topic ? `Topic: ${channel.topic}\n\n` : "",
            "You do not have access to view this channel."
        )
    );
}

function isHidden(channel) {
    if (channel == undefined) return false;
    if (typeof channel === 'string')
        channel = ChannelStore?.getChannel(channel);
    if (!channel || skipChannels.includes(channel.type)) return false;
    channel.realCheck = true;
    let res = !Permissions.can(constants.Permissions.VIEW_CHANNEL, channel);
    delete channel.realCheck;
    return res;
}

export default {
    onLoad: () => {
        try {
            // Load all modules inside onLoad
            Permissions = findByProps("getChannelPermissions", "can");
            Router = findByProps("transitionToGuild");
            Fetcher = findByProps("stores", "fetchMessages");
            const ChannelTypesModule = findByProps("ChannelTypes");
            ChannelTypes = ChannelTypesModule?.ChannelTypes;
            ChannelStore = findByStoreName("ChannelStore");
            ReadStateStore = findByStoreName("ReadStateStore");
            const ViewModule = findByProps("Button", "Text", "View");
            View = ViewModule?.View;
            Text = ViewModule?.Text;
            
            skipChannels = [
                ChannelTypes?.DM, 
                ChannelTypes?.GROUP_DM, 
                ChannelTypes?.GUILD_CATEGORY
            ].filter(Boolean);
            
            const MessagesConnected = findByName("MessagesWrapperConnected", false);
            
            if (!Permissions || !ChannelStore) {
                throw new Error("Failed to find required modules");
            }
            
            // Allow viewing hidden channels in the list
            patches.push(after("can", Permissions, ([permID, channel], res) => {
                if (!channel?.realCheck && permID === constants.Permissions.VIEW_CHANNEL) return true;
                return res;
            }));
            
            // Add lock icon to channel names in the list
            patches.push(after("getChannel", ChannelStore, (args, channel) => {
                if (!channel) return channel;
                
                // Check if this is a hidden channel
                if (isHidden(channel)) {
                    // Store original name if not already stored
                    if (!channelNameCache.has(channel.id)) {
                        channelNameCache.set(channel.id, channel.name);
                    }
                    
                    // Return modified channel with lock icon
                    const originalName = channelNameCache.get(channel.id);
                    if (!originalName?.startsWith('🔒 ')) {
                        return {
                            ...channel,
                            name: `🔒 ${originalName}`
                        };
                    }
                }
                
                return channel;
            }));

            // Prevent navigating to hidden channels
            if (Router?.transitionToGuild) {
                patches.push(instead("transitionToGuild", Router, (args, orig) => {
                    const [_, channel] = args;
                    if (!isHidden(channel) && typeof orig === "function") return orig(...args);
                }));
            }

            // Prevent fetching messages for hidden channels
            if (Fetcher?.fetchMessages) {
                patches.push(instead("fetchMessages", Fetcher, (args, orig) => {
                    const [channel] = args;
                    if (!isHidden(channel) && typeof orig === "function") return orig(...args);
                }));
            }

            // Show custom view instead of messages for hidden channels
            if (MessagesConnected) {
                patches.push(instead("default", MessagesConnected, (args, orig) => {
                    const channel = args[0]?.channel;
                    if (!isHidden(channel) && typeof orig === "function") return orig(...args);
                    else return React.createElement(HiddenChannelView, {channel});
                }));
            }

            // Clear notification badges for hidden channels
            if (ReadStateStore) {
                if (ReadStateStore.getMentionCount) {
                    patches.push(after("getMentionCount", ReadStateStore, (args, ret) => {
                        const channelId = args[0];
                        if (isHidden(channelId)) return 0;
                        return ret;
                    }));
                }
                
                if (ReadStateStore.getUnreadCount) {
                    patches.push(after("getUnreadCount", ReadStateStore, (args, ret) => {
                        const channelId = args[0];
                        if (isHidden(channelId)) return 0;
                        return ret;
                    }));
                }
                
                if (ReadStateStore.hasUnread) {
                    patches.push(after("hasUnread", ReadStateStore, (args, ret) => {
                        const channelId = args[0];
                        if (isHidden(channelId)) return false;
                        return ret;
                    }));
                }
                
                if (ReadStateStore.hasRelevantUnread) {
                    patches.push(after("hasRelevantUnread", ReadStateStore, (args, ret) => {
                        const channelId = args[0];
                        if (isHidden(channelId)) return false;
                        return ret;
                    }));
                }
            }
        } catch (error) {
            showToast("Show Hidden Channels failed: " + error.message, getAssetIDByName("ic_close_circle"));
            console.error("Show Hidden Channels error:", error);
        }
    },
    
    onUnload: () => {
        for (const unpatch of patches) {
            unpatch?.();
        }
        patches = [];
        channelNameCache.clear();
    }
};
