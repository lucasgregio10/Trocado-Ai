import React from 'react';
import {
  Utensils,
  Car,
  Home,
  PartyPopper,
  HeartPulse,
  GraduationCap,
  CircleEllipsis,
  Tag,
} from 'lucide-react';

export function CategoryIcon({
  category,
  icon,
  className = 'w-4 h-4',
}: {
  category?: string;
  icon?: string;
  className?: string;
}) {
  const key = icon || category || '';

  switch (key) {
    case 'utensils':
    case 'Alimentação':
      return <Utensils className={className} />;
    case 'car':
    case 'Transporte':
      return <Car className={className} />;
    case 'home':
    case 'Moradia':
      return <Home className={className} />;
    case 'party-popper':
    case 'Lazer':
      return <PartyPopper className={className} />;
    case 'heart-pulse':
    case 'Saúde':
      return <HeartPulse className={className} />;
    case 'graduation-cap':
    case 'Educação':
      return <GraduationCap className={className} />;
    case 'circle-ellipsis':
    case 'Outros':
      return <CircleEllipsis className={className} />;
    default:
      return <Tag className={className} />;
  }
}

export function getCategoryColor(category: string): string {
  switch (category) {
    case 'Alimentação':
      return '#F97316';
    case 'Transporte':
      return '#3B82F6';
    case 'Educação':
      return '#8B5CF6';
    case 'Lazer':
      return '#EC4899';
    case 'Saúde':
      return '#EF4444';
    case 'Moradia':
      return '#EAB308';
    default:
      return '#64748B';
  }
}
