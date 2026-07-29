'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface ArchitectureCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  tags: string[];
  details: string[];
  color?: string;
}

export function ArchitectureCard({
  title,
  description,
  icon: Icon,
  tags,
  details,
  color = 'blue'
}: ArchitectureCardProps) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
    emerald: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20',
    amber: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20',
    purple: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20',
  };

  return (
    <Card className="overflow-hidden border-none shadow-lg bg-white/80 backdrop-blur-sm dark:bg-slate-900/80 hover:shadow-xl transition-all duration-300">
      <CardHeader className="flex flex-row items-center gap-4 pb-2">
        <div className={`p-3 rounded-xl flex-shrink-0 ${colorMap[color] || colorMap.blue}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex flex-col min-w-0">
          <CardTitle className="text-xl font-bold tracking-tight break-words whitespace-normal leading-tight">{title}</CardTitle>
          <div className="flex flex-wrap gap-1 mt-1">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] uppercase font-bold py-0 h-4">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
          {description}
        </p>
        <div className="space-y-2">
          {details.map((detail, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700 mt-1.5 flex-shrink-0" />
              <span>{detail}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
