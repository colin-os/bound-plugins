import { storage } from "@vendetta/plugin";
import { findByName, findByProps, findByStoreName } from "@vendetta/metro";
import { React, stylesheet } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";
import { semanticColors } from "@vendetta/ui";
import { General, Forms } from "@vendetta/ui/components";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { showToast } from "@vendetta/ui/toasts";
import { useProxy } from "@vendetta/storage";

const { View, Text, Pressable, ScrollView } = General;
const { FormRow, FormSwitch, FormRadio, FormDivider } = Forms;
const UserStore = findByStoreName("UserStore");

let unpatch;

// Default settings
storage.avatarSize ??= "medium";
storage.animation ??= "pulse";
storage.maxAvatars ??= 5;
storage.borderStyle ??= "round";
storage.showNames ??= false;

const sizeMap = {
    small: 12,
    medium: 16,
    large: 24
};

function TypingAvatars({ channel }) {
    useProxy(storage);
    
    const TypingWrapper = findByProps("TYPING_WRAPPER_HEIGHT");
    const AvatarComponent = findByProps("AvatarSizes")?.default;
    
    if (!TypingWrapper?.useTypingUserIds || !AvatarComponent) return null;
    
    const typingIds = TypingWrapper.useTypingUserIds(channel.id);
    const typingUsers = typingIds?.map((id) => UserStore?.getUser(id)).filter(Boolean) || [];
    
    if (typingUsers.length === 0) return null;
    
    const size = sizeMap[storage.avatarSize] || 16;
    const borderRadius = storage.borderStyle === "round" ? size / 2 : 4;
    
    const styles = stylesheet.createThemedStyleSheet({
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            height: size + 4,
        },
        avatarWrapper: {
            borderWidth: 2,
            borderRadius: borderRadius,
            borderColor: semanticColors.BACKGROUND_SECONDARY,
            backgroundColor: semanticColors.BACKGROUND_SECONDARY,
            marginLeft: -6,
        },
        overflow: {
            width: size,
            height: size,
            borderRadius: borderRadius,
            backgroundColor: semanticColors.BACKGROUND_TERTIARY,
            justifyContent: 'center',
            alignItems: 'center',
        },
        overflowText: {
            fontSize: size * 0.4,
            color: semanticColors.TEXT_NORMAL,
            fontWeight: 'bold',
        },
        nameText: {
            fontSize: 12,
            color: semanticColors.TEXT_MUTED,
            marginLeft: 8,
        }
    });
    
    const displayUsers = typingUsers.slice(0, storage.maxAvatars);
    const overflowCount = typingUsers.length - storage.maxAvatars;
    
    const showDetails = () => {
        const names = typingUsers.map(u => u.username).join(', ');
        showToast(`Typing: ${names}`, getAssetIDByName("ic_message_edit"));
    };
    
    return React.createElement(Pressable, { onPress: showDetails },
        React.createElement(View, { style: styles.container },
            displayUsers.map((user, i) => 
                React.createElement(View, { 
                    key: user.id,
                    style: styles.avatarWrapper
                },
                    React.createElement(AvatarComponent, {
                        user,
                        size: size === 12 ? "SIZE_12" : size === 16 ? "SIZE_16" : "SIZE_24",
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

function Settings() {
    useProxy(storage);
    
    return React.createElement(ScrollView, {},
        React.createElement(FormRow, {
            label: "Avatar Size",
            subLabel: "Choose the size of typing avatars",
            trailing: React.createElement(FormRow.Arrow)
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
            label: "Border Style",
            subLabel: "Choose avatar border shape",
            trailing: React.createElement(FormRow.Arrow)
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
            subLabel: `Show up to ${storage.maxAvatars} avatars before showing +X`,
            trailing: React.createElement(FormRow.Arrow)
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
            label: "Show Username",
            subLabel: "Show username when only one person is typing",
            value: storage.showNames,
            onValueChange: (v) => storage.showNames = v
        })
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
                if (!res?.props?.children) return res;
                
                const Typing = res.props.children;
                if (!Typing?.type) return res;

                const unpatchTyping = after("type", Typing, (args, res) => {
                    React.useEffect(() => () => unpatchTyping(), []);
                    
                    if (res?.props?.children?.[0]?.props?.children) {
                        res.props.children[0].props.children.splice(
                            0, 1,
                            React.createElement(TypingAvatars, { channel })
                        );
                    }
                    
                    return res;
                });
                
                return res;
            });
            
            showToast("Typing Avatars loaded!", getAssetIDByName("Check"));
        } catch (error) {
            showToast("Typing Avatars failed: " + error.message, getAssetIDByName("Small"));
            console.error("Typing Avatars error:", error);
        }
    },
    
    onUnload: () => {
        unpatch?.();
    },
    
    settings: Settings
};
