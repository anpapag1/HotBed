import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  closestCenter,
  getFirstCollision,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DropAnimation,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { Search, Plus } from 'lucide-react';
import { type PrintItem, type PrintStatus, type ItemComment, type ItemSubtask, BOARD_COLUMNS } from '../../types/database';
import {
  fetchCommentsForOrder,
  subscribeToCommentsForOrder,
  addAdminComment,
  addCustomerCommentViaRPC,
  deleteAdminComment,
  deleteCustomerCommentViaRPC,
  fetchSubtasksForOrder,
  subscribeToSubtasksForOrder,
  addSubtaskToPrint,
  toggleSubtaskCompletion,
  deleteSubtaskFromPrint,
} from '../../services/orderService';
import { KanbanColumn } from './KanbanColumn';
import { PrintCard } from './PrintCard';
import { DeliveredSidebar } from './DeliveredSidebar';
import { PrintModal } from './PrintModal';
import { CommentsDrawer } from './CommentsDrawer';
import styles from './KanbanBoard.module.css';

interface KanbanBoardProps {
  items: PrintItem[];
  orderId: string;
  orderCode: string;
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
  orderCode,
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

  const currentUserRole: 'admin' | 'customer' = isAdmin ? 'admin' : 'customer';
  const currentUserName = isAdmin ? 'Workshop Admin' : (customerName || 'Customer');

  // Threaded comments + workshop subtasks live in Supabase, shared across
  // admin and customer sessions; fetch once per order and keep in sync via
  // realtime so both sides see each other's activity live.
  const [comments, setComments] = useState<ItemComment[]>([]);
  const [subtasks, setSubtasks] = useState<ItemSubtask[]>([]);

  useEffect(() => {
    let isMounted = true;

    fetchCommentsForOrder(orderId)
      .then((data) => { if (isMounted) setComments(data); })
      .catch((err) => console.error('Failed to load comments:', err));

    fetchSubtasksForOrder(orderId)
      .then((data) => { if (isMounted) setSubtasks(data); })
      .catch((err) => console.error('Failed to load subtasks:', err));

    const unsubComments = subscribeToCommentsForOrder(orderId, () => {
      fetchCommentsForOrder(orderId)
        .then((data) => { if (isMounted) setComments(data); })
        .catch((err) => console.error('Failed to refresh comments:', err));
    });

    const unsubSubtasks = subscribeToSubtasksForOrder(orderId, () => {
      fetchSubtasksForOrder(orderId)
        .then((data) => { if (isMounted) setSubtasks(data); })
        .catch((err) => console.error('Failed to refresh subtasks:', err));
    });

    return () => {
      isMounted = false;
      unsubComments();
      unsubSubtasks();
    };
  }, [orderId]);

  const handleSendComment = async (printId: string, content: string) => {
    if (isAdmin) {
      await addAdminComment(printId, orderId, content, currentUserName);
    } else {
      await addCustomerCommentViaRPC(orderCode, printId, content, currentUserName);
    }
    const fresh = await fetchCommentsForOrder(orderId);
    setComments(fresh);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (isAdmin) {
      await deleteAdminComment(commentId);
    } else {
      await deleteCustomerCommentViaRPC(orderCode, commentId);
    }
    const fresh = await fetchCommentsForOrder(orderId);
    setComments(fresh);
  };

  const handleAddSubtask = async (printId: string, title: string) => {
    try {
      const created = await addSubtaskToPrint(printId, orderId, title);
      setSubtasks((prev) => [...prev, created]);
    } catch (err) {
      console.error('Failed to add subtask:', err);
    }
  };

  const handleToggleSubtask = async (subtaskId: string, completed: boolean) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtaskId ? { ...s, completed } : s))
    );
    try {
      await toggleSubtaskCompletion(subtaskId, completed);
    } catch (err) {
      console.error('Failed to toggle subtask:', err);
    }
  };

  const handleDeleteSubtask = async (subtaskId: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    try {
      await deleteSubtaskFromPrint(subtaskId);
    } catch (err) {
      console.error('Failed to delete subtask:', err);
    }
  };

  // Local mirror of `items` used while a drag is in progress, so a card can be
  // moved live into another column's list (same feel as same-column reordering)
  // instead of only snapping into place on drop. Kept in sync with the prop
  // whenever no drag is active.
  const [boardItems, setBoardItems] = useState<PrintItem[]>(items);
  useEffect(() => {
    if (!activeItem) setBoardItems(items);
  }, [items, activeItem]);

  // Tracks the last hover target handled during a drag so handleDragOver only
  // reorders on an actual boundary crossing, not on every pointer-move tick
  // (dnd-kit re-fires dragOver continuously while hovering the same target).
  const lastOverIdRef = useRef<string | null>(null);

  // Which column/sidebar is the current drop target, for highlighting.
  const [overContainer, setOverContainer] = useState<PrintStatus | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  // Filter items based on search
  const filteredItems = boardItems.filter((item) => {
    return (
      searchQuery === '' ||
      item.perigrafi.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.comments && item.comments.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const deliveredItems = filteredItems.filter((i) => i.status === 'Delivered');

  // Both Admin and Customer use BOARD_COLUMNS in the main panel, with Delivered always in the right sidebar
  const columnsToRender = BOARD_COLUMNS;

  const ALL_COLUMNS: string[] = [...BOARD_COLUMNS, 'Delivered'];

  // A little spring on release instead of dnd-kit's generic linear-ish
  // default -- the card settles into place with a slight overshoot. No
  // opacity/style side effects: it should still look like itself, just
  // land with some personality.
  const dropAnimation: DropAnimation = {
    duration: 280,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  };

  // Every card is itself a droppable (via useSortable), nested inside its
  // column's droppable. Plain pointer/rect hit-testing flips the "over"
  // target back and forth between the column and whatever card edge the
  // cursor happens to cross, which is what made the hover highlight (and
  // the reorder target) look inconsistent depending on exact cursor height.
  // This mirrors dnd-kit's own multi-container recipe: resolve to a single
  // stable id per hover -- if the pointer lands on a container that still
  // has cards in it, refine to the nearest card inside that same container
  // instead of trusting whichever nested rect happened to win -- and stick
  // with the last known target if the pointer briefly matches nothing.
  const lastCollisionIdRef = useRef<string | null>(null);
  const collisionDetection: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    const intersections = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
    let overId = getFirstCollision(intersections, 'id');

    if (overId != null) {
      if (ALL_COLUMNS.includes(overId as string)) {
        const containerItemIds = new Set(
          boardItems.filter((i) => i.status === overId).map((i) => i.id)
        );
        if (containerItemIds.size > 0) {
          const refined = closestCenter({
            ...args,
            droppableContainers: args.droppableContainers.filter((c) =>
              containerItemIds.has(c.id as string)
            ),
          });
          overId = getFirstCollision(refined, 'id') ?? overId;
        }
      }
      lastCollisionIdRef.current = overId as string;
      return [{ id: overId }];
    }

    return lastCollisionIdRef.current ? [{ id: lastCollisionIdRef.current }] : [];
  };

  // Resolve which column an id belongs to: either a card's own status, or,
  // if the id is a column/sidebar container itself, that column's status.
  const findContainer = (id: string): PrintStatus | undefined => {
    const item = boardItems.find((i) => i.id === id);
    if (item) return item.status;
    return ALL_COLUMNS.includes(id) ? (id as PrintStatus) : undefined;
  };

  const handleDragStart = (event: DragStartEvent) => {
    if (readOnly || !isAdmin) return;
    const { active } = event;
    const found = boardItems.find((i) => i.id === active.id);
    if (found) setActiveItem(found);
    lastOverIdRef.current = null;
    setOverContainer(found ? found.status : null);
  };

  // Live-move the dragged card into whichever column it's currently hovering
  // over, mirroring how same-column drag already re-sorts as you move.
  const handleDragOver = (event: DragOverEvent) => {
    if (readOnly || !isAdmin) return;
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Drive the column highlight from the resolved container, not each
    // column's own useDroppable().isOver -- that only lights up while the
    // pointer sits in a gap, since hovering a card resolves `over` to the
    // card itself, not the column. This keeps the highlight lit across the
    // whole column regardless of exact cursor height.
    const overContainerNow = activeId === overId ? findContainer(activeId) : findContainer(overId);
    setOverContainer((prev) => (overContainerNow && overContainerNow !== prev ? overContainerNow : prev));

    if (activeId === overId) return;
    // Same target as last tick: nothing to do. Without this guard, dnd-kit's
    // continuous dragOver firing would rebuild the array (and remount the
    // card) dozens of times a second, which is what caused the flicker.
    if (overId === lastOverIdRef.current) return;

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    lastOverIdRef.current = overId;

    setBoardItems((prev) => {
      const activeIndex = prev.findIndex((i) => i.id === activeId);
      if (activeIndex === -1) return prev;

      const next = [...prev];
      const [moved] = next.splice(activeIndex, 1);
      const updated: PrintItem = { ...moved, status: overContainer };

      const overIndex = next.findIndex((i) => i.id === overId);
      if (overIndex === -1) {
        // Dropped on the column/sidebar container itself (empty area)
        next.push(updated);
      } else {
        next.splice(overIndex, 0, updated);
      }
      return next;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (readOnly || !isAdmin) return;
    const { active, over } = event;
    const activeId = active.id as string;
    const originalItem = items.find((i) => i.id === activeId);
    setActiveItem(null);
    lastOverIdRef.current = null;
    setOverContainer(null);

    if (!over || !originalItem) return;

    const overId = over.id as string;
    const droppedOnCard = activeId !== overId && !ALL_COLUMNS.includes(overId);

    // boardItems already reflects the live column/position from handleDragOver.
    // If dropped directly on another card, refine the exact insertion index.
    let finalItems = boardItems;
    if (droppedOnCard) {
      const oldIndex = boardItems.findIndex((i) => i.id === activeId);
      const newIndex = boardItems.findIndex((i) => i.id === overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        finalItems = arrayMove(boardItems, oldIndex, newIndex);
        setBoardItems(finalItems);
      }
    }

    const finalItem = finalItems.find((i) => i.id === activeId);
    if (!finalItem) return;

    if (finalItem.status !== originalItem.status && onUpdateStatus) {
      onUpdateStatus(activeId, finalItem.status);
    }
    if (onReorder) {
      onReorder(finalItems);
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
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className={styles.boardBody}>
          <div className={styles.boardGrid}>
            {columnsToRender.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                items={filteredItems.filter((i) => i.status === status)}
                comments={comments}
                subtasks={subtasks}
                readOnly={readOnly}
                isAdmin={isAdmin}
                isOver={overContainer === status}
                onEdit={handleEditClick}
                onDelete={onDeletePrint}
                onDuplicate={handleDuplicateClick}
                onChangeStatus={isAdmin ? onUpdateStatus : undefined}
                onAddClick={isAdmin || status === 'Not Started' ? handleAddClick : undefined}
                onOpenComments={(item) => setActiveCommentItem(item)}
                onAddSubtask={handleAddSubtask}
                onToggleSubtask={handleToggleSubtask}
                onDeleteSubtask={handleDeleteSubtask}
              />
            ))}
          </div>

          {/* Delivered Sidebar is rendered for both Admin and Customer on the right */}
          <DeliveredSidebar
            items={deliveredItems}
            comments={comments}
            subtasks={subtasks}
            readOnly={readOnly}
            isAdmin={isAdmin}
            isOver={overContainer === 'Delivered'}
            onEdit={handleEditClick}
            onDelete={onDeletePrint}
            onDuplicate={handleDuplicateClick}
            onChangeStatus={isAdmin ? onUpdateStatus : undefined}
            onOpenComments={(item) => setActiveCommentItem(item)}
            onAddSubtask={handleAddSubtask}
            onToggleSubtask={handleToggleSubtask}
            onDeleteSubtask={handleDeleteSubtask}
          />
        </div>

        <DragOverlay dropAnimation={dropAnimation}>
          {activeItem ? (
            <PrintCard
              item={activeItem}
              isOverlay
              isAdmin={isAdmin}
              onEdit={handleEditClick}
              onDelete={onDeletePrint}
              onDuplicate={handleDuplicateClick}
              onChangeStatus={isAdmin ? onUpdateStatus : undefined}
              onOpenComments={(item) => setActiveCommentItem(item)}
            />
          ) : null}
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
        comments={
          activeCommentItem
            ? comments.filter((c) => c.print_id === activeCommentItem.id)
            : []
        }
        isOpen={Boolean(activeCommentItem)}
        onClose={() => setActiveCommentItem(null)}
        onSend={handleSendComment}
        onDelete={handleDeleteComment}
        isAdmin={isAdmin}
        currentUserRole={currentUserRole}
        currentUserName={currentUserName}
      />
    </div>
  );
}

