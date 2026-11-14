import React from 'react';
import {
  Utensils,
  Car,
  Home,
  Film,
  HeartPulse,
  GraduationCap,
  Layers,
} from 'lucide-react';

export function CategoryIcon({
  category,
  className = 'w-4 h-4',
}: {
  category: string;
  className?: string;
}) {
  switch (category) {
    case 'Alimentação':
      return <Utensils className={className} />;
    case 'Transporte':
      return <Car className={className} />;
    case 'Moradia':
      return <Home className={className} />;
    case 'Lazer':
      return <Film className={className} />;
    case 'Saúde':
      return <HeartPulse className={className} />;
    case 'Educação':
      return <GraduationCap className={className} />;
    default:
      return <Layers className={className} />;
  }
}

export function getCategoryColor(category: string): string {
  switch (category) {
    case 'Alimentação':
      return '#10B981';
    case 'Moradia':
      return '#8B5CF6';
    case 'Transporte':
      return '#3B82F6';
    case 'Lazer':
      return '#F59E0B';
    case 'Saúde':
      return '#EF4444';
    case 'Educação':
      return '#06B6D4';
    default:
      return '#64748B';
  }
}
