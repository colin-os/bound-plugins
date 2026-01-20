import { storage } from "@vendetta/plugin";
import { findByName, findByProps, findByStoreName } from "@vendetta/metro";
import { React, stylesheet } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";
import { semanticColors } from "@vendetta/ui";
import { General } from "@vendetta/ui/components";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import { useProxy } from "@vendetta/storage";
import { showConfirmationAlert } from "@vendetta/ui/alerts";

const { View, Text, Pressable, ScrollView } = General;
const { FormRow, FormSwitch, FormRadio, FormDivider } = findByProps("FormRow");
const UserStore = findByStoreName("UserStore");

let unpatch;

// Default settings
if (!storage.avatarSize) storage.avatarSize = "medium";
if (!storage.animation) storage.animation = "pulse";
if (!storage.maxAvatars) storage.maxAvatars = 5;
if (!storage.borderStyle) storage.borderStyle = "round";
if (!storage.showNames) storage.showNames = false;

const sizeMap = {
    small: { size: 12, borderRadius: 6 },
    medium: { size: 16, borderRadius: 8 },
    large: { size: 24, borderRadius: 12 }
};

function TypingAvatars({ channel }) {
    useProxy(storage);
    
    const TypingWrapper = findByProps("TYPING_WRAPPER_HEIGHT");
    const { useTypingUserIds } = TypingWrapper || {};
    const AvatarComponent = findByProps("AvatarSizes")?.default;
    
    if (!useTypingUserIds || !AvatarComponent) return null;
    
    const typingIds = useTypingUserIds(channel.id);
    const typingUsers = typingIds.map((id) => UserStore?.getUser(id)).filter(Boolean);
    
    if (typingUsers.length === 0) return null;
    
    const { size, borderRadius } = sizeMap[storage.avatarSize];
    
    const styles = stylesheet.createThemedStyleSheet({
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingRight: 4,
        },
        avatarWrapper: {
            borderWidth: 2,
            borderRadius: storage.borderStyle === 'round' ? borderRadius : 4,
            borderColor: semanticColors.BACKGROUND_SECONDARY,
            backgroundColor: semanticColors.BACKGROUND_SECONDARY,
            marginLeft: -8,
        },
        overflow: {
            width: size,
            height: size,
            borderRadius: storage.borderStyle === 'round' ? borderRadius : 4,
            backgroundColor: semanticColors.BACKGROUND_TERTIARY,
            justifyContent: 'center',
            alignItems: 'center',
        },
        overflowText: {
            fontSize: size * 0.5,
            color: semanticColors.TEXT_NORMAL,
            fontWeight: 'bold',
        },
        nameText: {
            fontSize: 12,
            color: semanticColors.TEXT_MUTED,
            marginLeft: 4,
        }
    });
    
    const displayUsers = typingUsers.slice(0, storage.maxAvatars);
    const overflowCount = typingUsers.length - storage.maxAvatars;
    
    const getAnimationStyle = () => {
        if (storage.animation === 'none') return {};
        // Note: Actual animations would need Animated API
        return {};
    };
    
    const showDetails = () => {
        const names = typingUsers.map(u => u.username).join(', ');
        showToast(`Typing: ${names}`, getAssetIDByName("ic_message_edit"));
    };
    
    return React.createElement(Pressable, { onPress: showDetails },
        React.createElement(View, { style: styles.container },
            displayUsers.map((user, i) => 
                React.createElement(View, { 
                    key: user.id,
                    style: [styles.avatarWrapper, getAnimationStyle()]
                },
                    React.createElement(AvatarComponent.type, {
                        user,
                        size: `SIZE_${size}`,
                        guildId: channel.guild_id
                    })
                )
            ),
            overflowCount > 0 && React.createElement(View, { style: [styles.avatarWrapper, styles.overflow] },
                React.createElement(Text, { style: styles.overflowText }, `+${overflowCount}`)
            ),
            storage.showNames && typingUsers.length === 1 && React.createElement(Text, { style: styles.nameText },
                typingUsers[0].username
            )
        )
    );
}

export default {
    onLoad: () => {
        try {
            const TypingWrapper = findByProps("TYPING_WRAPPER_HEIGHT");
            if (!TypingWrapper) {
                throw new Error("Could not find TypingWrapper");
            }
            
            unpatch = after("default", TypingWrapper, ([{ channel }], res) => {
                if (!res) return;
                const Typing = res.props?.children;
                if (!Typing) return;

                const unpatchTyping = after("type", Typing, (_, res) => {
                    React.useEffect(() => () => { unpatchTyping() }, []);
                    if (res.props?.children?.[0]?.props?.children) {
                        res.props.children[0].props.children.splice(0, 1, 
                            React.createElement(TypingAvatars, { channel })
                        );
                    }
                });
            });
        } catch (error) {
            showToast("Typing Avatars failed: " + error.message, getAssetIDByName("ic_close_circle"));
            console.error("Typing Avatars error:", error);
        }
    },
    onUnload: () => {
        unpatch?.();
    },
    settings: () => {
        useProxy(storage);
        
        return React.createElement(ScrollView, {},
            React.createElement(FormRow, {
                label: "Avatar Size",
                subLabel: "Choose the size of typing avatars"
            }),
            React.createElement(FormRadio, {
                label: "Small (12px)",
                selected: storage.avatarSize === "small",
                onPress: () => storage.avatarSize = "small"
            }),
            React.createElement(FormRadio, {
                label: "Medium (16px)",
                selected: storage.avatarSize === "medium",
                onPress: () => storage.avatarSize = "medium"
            }),
            React.createElement(FormRadio, {
                label: "Large (24px)",
                selected: storage.avatarSize === "large",
                onPress: () => storage.avatarSize = "large"
            }),
            
            React.createElement(FormDivider),
            
            React.createElement(FormRow, {
                label: "Animation Style",
                subLabel: "Choose animation for typing avatars"
            }),
            React.createElement(FormRadio, {
                label: "Pulse (subtle fade)",
                selected: storage.animation === "pulse",
                onPress: () => storage.animation = "pulse"
            }),
            React.createElement(FormRadio, {
                label: "Slide in",
                selected: storage.animation === "slide",
                onPress: () => storage.animation = "slide"
            }),
            React.createElement(FormRadio, {
                label: "None",
                selected: storage.animation === "none",
                onPress: () => storage.animation = "none"
            }),
            
            React.createElement(FormDivider),
            
            React.createElement(FormRow, {
                label: "Border Style",
                subLabel: "Choose avatar border shape"
            }),
            React.createElement(FormRadio, {
                label: "Round",
                selected: storage.borderStyle === "round",
                onPress: () => storage.borderStyle = "round"
            }),
            React.createElement(FormRadio, {
                label: "Square",
                selected: storage.borderStyle === "square",
                onPress: () => storage.borderStyle = "square"
            }),
            
            React.createElement(FormDivider),
            
            React.createElement(FormRow, {
                label: "Max Avatars",
                subLabel: `Show up to ${storage.maxAvatars} avatars before showing +X`
            }),
            React.createElement(FormRadio, {
                label: "3 avatars",
                selected: storage.maxAvatars === 3,
                onPress: () => storage.maxAvatars = 3
            }),
            React.createElement(FormRadio, {
                label: "5 avatars",
                selected: storage.maxAvatars === 5,
                onPress: () => storage.maxAvatars = 5
            }),
            React.createElement(FormRadio, {
                label: "10 avatars",
                selected: storage.maxAvatars === 10,
                onPress: () => storage.maxAvatars = 10
            }),
            
            React.createElement(FormDivider),
            
            React.createElement(FormSwitch, {
                label: "Show Name",
                subLabel: "Show username when only one person is typing",
                value: storage.showNames,
                onValueChange: (v) => storage.showNames = v
            })
        );
    }
};
