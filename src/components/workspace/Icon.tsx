import React from 'react';
import { Lucide } from '@react-native-vector-icons/lucide';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/constants/theme';

export type IconName =
  | 'cpu'
  | 'zap'
  | 'wifi'
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
    case 'cpu':
      return <Lucide name="cpu" size={size} color={color} />;
    case 'zap':
      return <Lucide name="zap" size={size} color={color} />;
    case 'wifi':
      return <Lucide name="wifi" size={size} color={color} />;
    case 'x':
      return <Lucide name="x" size={size} color={color} />;
    case 'user':
      return <Lucide name="user" size={size} color={color} />;
    case 'projects':
      return <Lucide name="layers" size={size} color={color} />;
    case 'agreements':
      return <Lucide name="folder-lock" size={size + 2} color={color} />;
    case 'settings':
      return <Lucide name="sliders-horizontal" size={size} color={color} />;
    case 'back':
      return <Lucide name="arrow-left" size={size} color={color} />;
    case 'plus':
      return <Lucide name="plus" size={size} color={color} />;
    case 'paperclip':
      return <Lucide name="paperclip" size={size} color={color} />;
    case 'clipboard':
      return <Lucide name="clipboard" size={size} color={color} />;
    case 'copy':
      return <Lucide name="copy" size={size} color={color} />;
    case 'printer':
      return <Lucide name="printer" size={size} color={color} />;
    case 'trash':
      return <Lucide name="trash-2" size={size} color={color} />;
    case 'image':
      return <Lucide name="image" size={size} color={color} />;
    case 'send':
      return <Lucide name="send" size={size} color={color} />;
    case 'check':
      return <Lucide name="check" size={size} color={color} />;
    case 'chevron-right':
      return <Lucide name="chevron-right" size={size} color={color} />;
    case 'lock':
      return <Lucide name="lock" size={size} color={color} />;
    case 'shield':
      return <Lucide name="shield" size={size} color={color} />;
    case 'share':
      return <Lucide name="share-2" size={size} color={color} />;
    case 'document':
      return <Lucide name="file-text" size={size} color={color} />;
    case 'clock':
      return <Lucide name="clock" size={size} color={color} />;
    case 'sparkles':
      return <Lucide name="sparkles" size={size} color={color} />;
    case 'help-circle':
      return <Lucide name="circle-help" size={size} color={color} />;
    case 'play':
      return <Lucide name="play" size={size} color={color} />;
    case 'arrow-right':
      return <Lucide name="arrow-right" size={size} color={color} />;
    case 'alert-circle':
      return <Lucide name="circle-alert" size={size} color={color} />;
    case 'pencil':
    case 'edit':
      return <Lucide name="pencil" size={size} color={color} />;
    case 'message':
      return <Lucide name="message-square-text" size={size} color={color} />;
    case 'chevron-down':
      return <Lucide name="chevron-down" size={size} color={color} />;
    case 'chevron-up':
      return <Lucide name="chevron-up" size={size} color={color} />;
    case 'info':
      return <Lucide name="info" size={size} color={color} />;
    case 'link':
      return <Lucide name="link-2" size={size} color={color} />;
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
      return <Lucide name="circle" size={size} color={color} />;
  }
}
