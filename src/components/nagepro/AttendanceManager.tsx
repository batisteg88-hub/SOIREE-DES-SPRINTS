"use client";

import type { Athlete, Presence } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Eye, UserX } from 'lucide-react';
import { cn } from '@/lib/utils';

type AttendanceManagerProps = {
  swimmers: Athlete[];
  swimmerPresence: Record<string, Presence>;
  onCyclePresence: (swimmerId: string) => void;
};

export default function AttendanceManager({ swimmers, swimmerPresence, onCyclePresence }: AttendanceManagerProps) {
  if (swimmers.length === 0) return null;

  const sortedSwimmers = [...swimmers].sort((a, b) => a.name.localeCompare(b.name));

  const getPresenceDetails = (presence: Presence | undefined) => {
    switch (presence) {
      case 'absent':
        return {
          Icon: UserX,
          variant: 'ghost',
          className: 'text-muted-foreground opacity-60 line-through',
          label: "Absent(e)"
        };
      case 'present':
      default:
        return {
          Icon: Eye,
          variant: 'secondary',
          className: 'font-semibold',
          label: "Présent(e)"
        };
    }
  };

  return (
    <div className="card p-4 mb-6">
      <div className="flex flex-wrap gap-2">
        {sortedSwimmers.map((swimmer) => {
          const presence = swimmerPresence[swimmer.id!];
          const { Icon, variant, className, label } = getPresenceDetails(presence);

          return (
            <Button
              key={swimmer.id}
              variant={variant as any}
              size="sm"
              onClick={() => onCyclePresence(swimmer.id!)}
              className={cn('transition-all h-auto py-1.5', className)}
              title={`Statut: ${label}. Cliquer pour changer.`}
            >
              <Icon className="mr-2 h-4 w-4" />
              {swimmer.name}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
