import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { Search, Plus } from 'lucide-react';
import { type PrintItem, type PrintStatus, BOARD_COLUMNS } from '../../types/database';
import { KanbanColumn } from './KanbanColumn';
import { PrintCard } from './PrintCard';
import { DeliveredSidebar } from './DeliveredSidebar';
import { PrintModal } from './PrintModal';
import { CommentsDrawer } from './CommentsDrawer';
import styles from './KanbanBoard.module.css';

interface KanbanBoardProps {
  items: PrintItem[];
  orderId: string;
  customerName?: string | null;
  readOnly?: boolean;
  isAdmin?: boolean;
  onUpdateStatus?: (id: string, newStatus: PrintStatus) => Promise<void>;
  onReorder?: (items: PrintItem[]) => Promise<void>;
  onAddPrint?: (orderId: string, item: {
    perigrafi: string;
    xroma?: string;
    megethos?: number;
    link?: string | null;
    comments?: string | null;
    status?: PrintStatus;
  }) => Promise<void>;
  onUpdatePrint?: (id: string, updates: Partial<PrintItem>) => Promise<void>;
  onDeletePrint?: (id: string) => Promise<void>;
  pageTitle?: string;
  pageSubtitle?: string;
  customerScroll?: boolean;
}

export function KanbanBoard({
  items,
  orderId,
  customerName,
  readOnly = false,
  isAdmin = false,
  onUpdateStatus,
  onReorder,
  onAddPrint,
  onUpdatePrint,
  onDeletePrint,
  pageTitle = 'Your tasks',
  pageSubtitle,
  customerScroll = false,
}: KanbanBoardProps) {
  const [activeItem, setActiveItem] = useState<PrintItem | null>(null);
  const [activeCommentItem, setActiveCommentItem] = useState<PrintItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PrintItem | null>(null);
  const [targetStatus, setTargetStatus] = useState<PrintStatus>('Not Started');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter items based on search
  const filteredItems = items.filter((item) => {
    return (
      searchQuery === '' ||
      item.perigrafi.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.comments && item.comments.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const deliveredItems = filteredItems.filter((i) => i.status === 'Delivered');

  // Both Admin and Customer use BOARD_COLUMNS in the main panel, with Delivered always in the right sidebar
  const columnsToRender = BOARD_COLUMNS;

  const handleDragStart = (event: DragStartEvent) => {
    if (readOnly || !isAdmin) return;
    const { active } = event;
    const found = items.find((i) => i.id === active.id);
    if (found) setActiveItem(found);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (readOnly || !isAdmin) return;
    const { active, over } = event;
    setActiveItem(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeItemObj = items.find((i) => i.id === activeId);
    if (!activeItemObj) return;

    const ALL_COLUMNS: string[] = [...BOARD_COLUMNS, 'Delivered'];
    const isOverColumn = ALL_COLUMNS.includes(overId);

    // Dropped on a column container or Delivered sidebar
    if (isOverColumn) {
      if (activeItemObj.status !== overId && onUpdateStatus) {
        onUpdateStatus(activeId, overId as PrintStatus);
      }
      return;
    }

    // Dropped over another card
    if (activeId !== overId) {
      const oldIndex = items.findIndex((i) => i.id === activeId);
      const newIndex = items.findIndex((i) => i.id === overId);
      if (oldIndex !== -1 && newIndex !== -1) {
        const targetCard = items[newIndex];
        if (activeItemObj.status !== targetCard.status) {
          if (onUpdateStatus) {
            onUpdateStatus(activeId, targetCard.status);
          }
        }
        const newItems = arrayMove(items, oldIndex, newIndex);
        if (onReorder) {
          onReorder(newItems);
        }
      }
    }
  };

  const handleAddClick = (status: PrintStatus) => {
    setTargetStatus(isAdmin ? status : 'Not Started');
    setEditingItem(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (item: PrintItem) => {
    // Customers can only edit items in 'Not Started'
    if (!isAdmin && item.status !== 'Not Started') {
      return;
    }
    setEditingItem(item);
    setTargetStatus(item.status);
    setIsModalOpen(true);
  };

  const handleDuplicateClick = (item: PrintItem) => {
    if (!onAddPrint) return;
    if (!isAdmin && item.status !== 'Not Started') return;
    onAddPrint(orderId, {
      perigrafi: `${item.perigrafi} (Copy)`,
      link: item.link,
      xroma: item.xroma,
      megethos: item.megethos,
      status: isAdmin ? item.status : 'Not Started',
      comments: item.comments,
    });
  };

  const handleSaveModal = async (data: {
    perigrafi: string;
    xroma: string;
    megethos: number;
    link: string | null;
    comments: string | null;
    status?: PrintStatus;
  }) => {
    if (editingItem && onUpdatePrint) {
      if (!isAdmin && editingItem.status !== 'Not Started') {
        alert('Only items in Not Started can be edited.');
        return;
      }
      await onUpdatePrint(editingItem.id, data);
    } else if (onAddPrint) {
      await onAddPrint(orderId, {
        perigrafi: data.perigrafi,
        link: data.link,
        xroma: data.xroma,
        megethos: data.megethos,
        status: isAdmin ? (data.status || targetStatus) : 'Not Started',
        comments: data.comments,
      });
    }
    setIsModalOpen(false);
  };

  return (
    <div className={`${styles.boardContainer} ${customerScroll ? styles.customerScroll : ''}`}>
      {/* Workspace Title & Toolbar (Figma Aligned) */}
      <div className={styles.workspaceHeader}>
        <div className={styles.titleBlock}>
          <h1 className={styles.pageTitle}>{pageTitle}</h1>
          {pageSubtitle && <p className={styles.pageSubtitle}>{pageSubtitle}</p>}
        </div>

        {/* Toolbar Actions */}
        <div className={styles.toolbar}>
          {/* Search Box */}
          <div className={styles.searchWrapper}>
            <Search size={15} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search tasks or files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {/* New Print Button */}
          {!readOnly && onAddPrint && (
            <button
              onClick={() => handleAddClick('Not Started')}
              className={styles.btnPrimary}
            >
              <Plus size={16} />
              <span>Add Part</span>
            </button>
          )}
        </div>
      </div>

      {/* Board Body with Horizontal Columns & Delivered Drawer wrapped in DndContext */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={styles.boardBody}>
          <div className={styles.boardGrid}>
            {columnsToRender.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                items={filteredItems.filter((i) => i.status === status)}
                readOnly={readOnly}
                isAdmin={isAdmin}
                onEdit={handleEditClick}
                onDelete={onDeletePrint}
                onDuplicate={handleDuplicateClick}
                onChangeStatus={isAdmin ? onUpdateStatus : undefined}
                onAddClick={isAdmin || status === 'Not Started' ? handleAddClick : undefined}
                onOpenComments={(item) => setActiveCommentItem(item)}
              />
            ))}
          </div>

          {/* Delivered Sidebar is rendered for both Admin and Customer on the right */}
          <DeliveredSidebar
            items={deliveredItems}
            readOnly={readOnly}
            isAdmin={isAdmin}
            onEdit={handleEditClick}
            onDelete={onDeletePrint}
            onDuplicate={handleDuplicateClick}
            onChangeStatus={isAdmin ? onUpdateStatus : undefined}
            onOpenComments={(item) => setActiveCommentItem(item)}
          />
        </div>

        <DragOverlay>
          {activeItem ? <PrintCard item={activeItem} isOverlay readOnly /> : null}
        </DragOverlay>
      </DndContext>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <PrintModal
          isOpen={isModalOpen}
          initialItem={editingItem}
          defaultStatus={targetStatus}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleSaveModal}
          isAdmin={isAdmin}
        />
      )}

      {/* Threaded Comments Drawer */}
      <CommentsDrawer
        item={activeCommentItem}
        isOpen={Boolean(activeCommentItem)}
        onClose={() => setActiveCommentItem(null)}
        isAdmin={isAdmin}
        currentUserRole={isAdmin ? 'admin' : 'customer'}
        currentUserName={isAdmin ? 'Workshop Admin' : (customerName || 'Customer')}
      />
    </div>
  );
}

