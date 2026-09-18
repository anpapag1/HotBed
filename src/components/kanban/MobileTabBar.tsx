import type { PrintStatus } from '../../types/database';
import { BOARD_COLUMNS } from '../../types/database';
import { useDroppable } from '@dnd-kit/core';
import { getStatusConfig } from '../../utils/statusConfig';
import styles from './MobileTabBar.module.css';
import {
  CircleDashed,
  Zap,
  Printer,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

function getTabIcon(status: PrintStatus) {
  switch (status) {
    case 'Not Started':
      return <CircleDashed size={20} />;
    case 'Ready to print':
      return <Zap size={20} />;
    case 'Printing':
      return <Printer size={20} />;
    case 'Finished':
      return <CheckCircle2 size={20} />;
    case 'Failed':
      return <AlertCircle size={20} />;
    default:
      return <CircleDashed size={20} />;
  }
}

function getTabLabel(status: PrintStatus): string {
  switch (status) {
    case 'Not Started':
      return 'Queue';
    case 'Ready to print':
      return 'Ready';
    case 'Printing':
      return 'Printing';
    case 'Finished':
      return 'Done';
    case 'Failed':
      return 'Failed';
    default:
      return status;
  }
}

interface MobileTabBarProps {
  activeTab: PrintStatus;
  counts: Record<string, number>;
  onTabChange: (status: PrintStatus) => void;
  deliveredCount?: number;
  onOpenDelivered?: () => void;
}

interface MobileTabButtonProps {
  status: PrintStatus;
  activeTab: PrintStatus;
  count: number;
  onTabChange: (status: PrintStatus) => void;
}

function MobileTabButton({ status, activeTab, count, onTabChange }: MobileTabButtonProps) {
  const { isOver, setNodeRef } = useDroppable({ id: `mobile-tab:${status}` });
  const config = getStatusConfig(status);
  const isActive = status === activeTab;

  const handleTrigger = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    onTabChange(status);
  };

  return (
    <button
      type="button"
      ref={setNodeRef}
      className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ''} ${isOver ? styles.tabBtnDropTarget : ''}`}
      style={{ '--tab-color': config.dotColor } as React.CSSProperties}
      onPointerDown={(e) => {
        // Trigger on primary pointer/finger down so response is instantaneous (0ms lag)
        if (e.button === 0) {
          handleTrigger(e);
        }
      }}
      onClick={handleTrigger}
      aria-label={status}
      aria-pressed={isActive}
    >
      <span className={styles.tabIcon}>{getTabIcon(status)}</span>
      <span className={styles.tabLabel}>{getTabLabel(status)}</span>
      {count > 0 && (
        <span className={styles.tabCount}>
          {count}
        </span>
      )}
    </button>
  );
}

interface DeliveredFabProps {
  count: number;
  onOpen: () => void;
}

function DeliveredFab({ count, onOpen }: DeliveredFabProps) {
  const { isOver, setNodeRef } = useDroppable({ id: 'mobile-tab:Delivered' });

  const handleTrigger = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    onOpen();
  };

  return (
    <button
      type="button"
      ref={setNodeRef}
      className={`${styles.deliveredFab} ${isOver ? styles.deliveredFabDropTarget : ''}`}
      onClick={handleTrigger}
      onPointerDown={(e) => {
        if (e.button === 0) {
          handleTrigger(e);
        }
      }}
      title="View Delivered Prints"
      aria-label="View Delivered Prints"
    >
      <span className={styles.deliveredFabIcon}>
        <CheckCircle2 size={20} />
      </span>
      {count > 0 && <span className={styles.deliveredFabBadge}>{count}</span>}
    </button>
  );
}

export function MobileTabBar({
  activeTab,
  counts,
  onTabChange,
  deliveredCount = 0,
  onOpenDelivered,
}: MobileTabBarProps) {
  return (
    <div className={styles.tabBarWrapper}>
      <nav className={styles.tabBar} aria-label="Board columns">
        {BOARD_COLUMNS.map((status) => {
          const count = counts[status] ?? 0;

          return (
            <MobileTabButton
              key={status}
              status={status}
              activeTab={activeTab}
              count={count}
              onTabChange={onTabChange}
            />
          );
        })}
      </nav>

      {onOpenDelivered && (
        <DeliveredFab count={deliveredCount} onOpen={onOpenDelivered} />
      )}
    </div>
  );
}
