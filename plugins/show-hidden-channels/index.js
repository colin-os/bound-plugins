import { findByName, findByProps, findByStoreName } from "@vendetta/metro";
import { constants, React, stylesheet } from "@vendetta/metro/common";
import { instead, after } from "@vendetta/patcher";
import { semanticColors } from '@vendetta/ui';
import { getAssetIDByName } from "@vendetta/ui/assets";

let patches = [];

const Permissions = findByProps("getChannelPermissions", "can");
const Router = findByProps("transitionToGuild");
const Fetcher = findByProps("stores", "fetchMessages");
const { ChannelTypes } = findByProps("ChannelTypes");
const ChannelStore = findByStoreName("ChannelStore");
const ReadStateStore = findByStoreName("ReadStateStore");
const { View, Text } = findByProps("Button", "Text", "View");

const skipChannels = [
    ChannelTypes.DM, 
    ChannelTypes.GROUP_DM, 
    ChannelTypes.GUILD_CATEGORY
];

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
        React.createElement(Text, { style: MessageStyles.title }, `🔒 ${channel.name}`),
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
        const MessagesConnected = findByName("MessagesWrapperConnected", false);
        
        // Allow viewing hidden channels in the list
        patches.push(after("can", Permissions, ([permID, channel], res) => {
            if (!channel?.realCheck && permID === constants.Permissions.VIEW_CHANNEL) return true;
            return res;
        }));

        // Prevent navigating to hidden channels
        patches.push(instead("transitionToGuild", Router, (args, orig) => {
            const [_, channel] = args;
            if (!isHidden(channel) && typeof orig === "function") orig(args);
        }));

        // Prevent fetching messages for hidden channels
        patches.push(instead("fetchMessages", Fetcher, (args, orig) => {
            const [channel] = args;
            if (!isHidden(channel) && typeof orig === "function") orig(args);
        }));

        // Show custom view instead of messages for hidden channels
        patches.push(instead("default", MessagesConnected, (args, orig) => {
            const channel = args[0]?.channel;
            if (!isHidden(channel) && typeof orig === "function") return orig(...args);
            else return React.createElement(HiddenChannelView, {channel});
        }));

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
    },
    
    onUnload: () => {
        for (const unpatch of patches) {
            unpatch?.();
        }
        patches = [];
    }
};
