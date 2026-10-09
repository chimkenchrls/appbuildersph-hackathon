import React from 'react';
import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/constants/theme';

export type IconName =
  | 'projects'
  | 'agreements'
  | 'settings'
  | 'back'
  | 'plus'
  | 'paperclip'
  | 'image'
  | 'send'
  | 'check'
  | 'chevron-right'
  | 'lock'
  | 'shield'
  | 'share'
  | 'document'
  | 'clock'
  | 'sparkles'
  | 'help-circle'
  | 'play'
  | 'arrow-right'
  | 'alert-circle'
  | 'pencil'
  | 'edit'
  | 'message'
  | 'chevron-down'
  | 'chevron-up'
  | 'info'
  | 'link'
  | 'scan-text'
  | 'clipboard'
  | 'copy'
  | 'printer'
  | 'trash'
  | 'user'
  | 'x';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function AppIcon({ name, size = 20, color = colors.textPrimary }: IconProps) {
  switch (name) {
    case 'x':
      return <Feather name="x" size={size} color={color} />;
    case 'user':
      return <Feather name="user" size={size} color={color} />;
    case 'projects':
      return <Feather name="layers" size={size} color={color} />;
    case 'agreements':
      return <MaterialCommunityIcons name="folder-lock-outline" size={size + 2} color={color} />;
    case 'settings':
      return <Feather name="sliders" size={size} color={color} />;
    case 'back':
      return <Feather name="arrow-left" size={size} color={color} />;
    case 'plus':
      return <Feather name="plus" size={size} color={color} />;
    case 'paperclip':
      return <Feather name="paperclip" size={size} color={color} />;
    case 'clipboard':
      return <Feather name="clipboard" size={size} color={color} />;
    case 'copy':
      return <Feather name="copy" size={size} color={color} />;
    case 'printer':
      return <Feather name="printer" size={size} color={color} />;
    case 'trash':
      return <Feather name="trash-2" size={size} color={color} />;
    case 'image':
      return <Feather name="image" size={size} color={color} />;
    case 'send':
      return <Feather name="send" size={size} color={color} />;
    case 'check':
      return <Feather name="check" size={size} color={color} />;
    case 'chevron-right':
      return <Feather name="chevron-right" size={size} color={color} />;
    case 'lock':
      return <Feather name="lock" size={size} color={color} />;
    case 'shield':
      return <Feather name="shield" size={size} color={color} />;
    case 'share':
      return <Feather name="share-2" size={size} color={color} />;
    case 'document':
      return <Ionicons name="document-text-outline" size={size} color={color} />;
    case 'clock':
      return <Feather name="clock" size={size} color={color} />;
    case 'sparkles':
      return <Ionicons name="sparkles" size={size} color={color} />;
    case 'help-circle':
      return <Feather name="help-circle" size={size} color={color} />;
    case 'play':
      return <Ionicons name="play" size={size} color={color} />;
    case 'arrow-right':
      return <Feather name="arrow-right" size={size} color={color} />;
    case 'alert-circle':
      return <Feather name="alert-circle" size={size} color={color} />;
    case 'pencil':
    case 'edit':
      return <Feather name="edit-2" size={size} color={color} />;
    case 'message':
      return <MaterialCommunityIcons name="message-text-outline" size={size} color={color} />;
    case 'chevron-down':
      return <Feather name="chevron-down" size={size} color={color} />;
    case 'chevron-up':
      return <Feather name="chevron-up" size={size} color={color} />;
    case 'info':
      return <Feather name="info" size={size} color={color} />;
    case 'link':
      return <Feather name="link-2" size={size} color={color} />;
    case 'scan-text':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 7V5a2 2 0 0 1 2-2h2"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M17 3h2a2 2 0 0 1 2 2v2"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M21 17v2a2 2 0 0 1-2 2h-2"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M7 21H5a2 2 0 0 1-2-2v-2"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M7 8h8"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M7 12h10"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M7 16h6"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    default:
      return <Feather name="circle" size={size} color={color} />;
  }
}
