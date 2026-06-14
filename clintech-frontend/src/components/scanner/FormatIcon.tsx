'use client';

import React from 'react';
import { 
  FileText, 
  Image, 
  Camera, 
  Sparkles,
  LucideIcon
} from 'lucide-react';

interface FormatIconProps {
  iconName: string;
  size?: number;
  className?: string;
}

const iconMap: Record<string, LucideIcon> = {
  FileText,
  Image,
  Camera,
  Sparkles,
};

const FormatIcon: React.FC<FormatIconProps> = ({ iconName, size = 24, className = "" }) => {
  const IconComponent = iconMap[iconName];
  
  if (!IconComponent) {
    return <FileText size={size} className={className} />;
  }
  
  return <IconComponent size={size} className={className} />;
};

export default FormatIcon; 