import { useState, useEffect, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  PointerSensor,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragCancelEvent,
  type DragEndEvent,
  type CollisionDetection,
  type DropAnimation,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Search, Plus, CheckCircle2, SlidersHorizontal } from 'lucide-react';
import {
  type PrintItem,
  type PrintStatus,
  type ItemComment,
  type ItemSubtask,
  BOARD_COLUMNS,
} from '../../types/database';
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
  updateSubtaskTitle,
  deleteSubtaskFromPrint,
} from '../../services/orderService';
import { parseColors } from '../../utils/statusConfig';
import { FilterPopover, type FilterState, INITIAL_FILTERS } from './FilterPopover';
import { KanbanColumn } from './KanbanColumn';
import { PrintCard } from './PrintCard';
import { DeliveredSidebar } from './DeliveredSidebar';
import { PrintModal } from './PrintModal';
import { CommentsDrawer } from './CommentsDrawer';
import { MobileTabBar } from './MobileTabBar';
import styles from './KanbanBoard.module.css';

interface KanbanBoardProps {
  items: PrintItem[];
  orderId: string;
  orderCode?: string;
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

const ALL_COLUMNS: string[] = [...BOARD_COLUMNS, 'Delivered'];

const dropAnimation: DropAnimation = {
  duration: 280,
  easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
};

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
  const [clonedItems, setClonedItems] = useState<PrintItem[] | null>(null);
  const [overContainer, setOverContainer] = useState<PrintStatus | null>(null);
  const [isOverMobileTab, setIsOverMobileTab] = useState(false);
  const [activeCommentItem, setActiveCommentItem] = useState<PrintItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PrintItem | null>(null);
  const [targetStatus, setTargetStatus] = useState<PrintStatus>('Not Started');

  useEffect(() => {
    if (!activeItem) {
      setClonedItems(null);
    }
  }, [items, activeItem]);

  const currentUserRole: 'admin' | 'customer' = isAdmin ? 'admin' : 'customer';
  const currentUserName = isAdmin ? 'Workshop Admin' : (customerName || 'Customer');

  // Threaded comments + workshop subtasks from Supabase
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
    } else if (orderCode) {
      await addCustomerCommentViaRPC(orderCode, printId, content, currentUserName);
    }
    const fresh = await fetchCommentsForOrder(orderId);
    setComments(fresh);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (isAdmin) {
      await deleteAdminComment(commentId);
    } else if (orderCode) {
      await deleteCustomerCommentViaRPC(orderCode, commentId);
    }
    const fresh = await fetchCommentsForOrder(orderId);
    setComments(fresh);
  };

  const handleCommentsSeen = (printId: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.print_id === printId ? { ...c, has_been_seen: true } : c
      )
    );
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

  const handleUpdateSubtaskTitle = async (subtaskId: string, title: string) => {
    setSubtasks((prev) =>
      prev.map((s) => (s.id === subtaskId ? { ...s, title } : s))
    );
    try {
      await updateSubtaskTitle(subtaskId, title);
    } catch (err) {
      console.error('Failed to rename subtask:', err);
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

  // Filter & sort state
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Dynamic available filament colors from all items
  const availableColors = Array.from(
    new Set(
      items
        .flatMap((item) => parseColors(item.xroma))
        .filter(Boolean)
    )
  ).sort();

  const activeFilterCount =
    filters.colors.length +
    (filters.urgentOnly ? 1 : 0) +
    (filters.hasLinkOnly ? 1 : 0) +
    (filters.hasCommentsOnly ? 1 : 0) +
    (filters.sortBy !== 'default' ? 1 : 0);

  // Mobile responsive state
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 768 : false
  );
  const [activeMobileTab, setActiveMobileTab] = useState<PrintStatus>('Not Started');
  const [showDeliveredSheet, setShowDeliveredSheet] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    setIsMobile(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const itemsRef = useRef<PrintItem[]>(items);
  itemsRef.current = items;
  const clonedItemsRef = useRef<PrintItem[] | null>(clonedItems);
  clonedItemsRef.current = clonedItems;

  const lastOverIdRef = useRef<string | null>(null);
  const lastCollisionIdRef = useRef<string | null>(null);

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  });
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: { distance: 5 },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 250, tolerance: 5 },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });

  const sensors = useSensors(
    ...(isMobile ? [mouseSensor, touchSensor] : [pointerSensor]),
    keyboardSensor
  );

  const findContainer = (id: string, currentList: PrintItem[]): PrintStatus | undefined => {
    if (id.startsWith('mobile-tab:')) {
      const tab = id.slice('mobile-tab:'.length);
      if (ALL_COLUMNS.includes(tab)) return tab as PrintStatus;
    }
    const item = currentList.find((i) => i.id === id) ?? itemsRef.current.find((i) => i.id === id);
    if (item) return item.status;
    return ALL_COLUMNS.includes(id) ? (id as PrintStatus) : undefined;
  };

  const collisionDetectionStrategy: CollisionDetection = (args) => {
    const pointerCollisions = pointerWithin(args);
    const tabCollision = pointerCollisions.find((collision) =>
      String(collision.id).startsWith('mobile-tab:')
    );
    if (tabCollision) {
      return [tabCollision];
    }

    const intersections = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(args);
    let overId = getFirstCollision(intersections, 'id');

    if (overId != null) {
      if (ALL_COLUMNS.includes(overId as string)) {
        const currentList = clonedItemsRef.current ?? itemsRef.current;
        const containerItemIds = new Set(
          currentList.filter((i) => i.status === overId).map((i) => i.id)
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

  // Filter items based on search + active filters + sort
  const displayItems = clonedItems ?? items;
  const filteredItems = displayItems
    .filter((item) => {
      // 1. Text search
      if (searchQuery !== '') {
        const matchesSearch =
          item.perigrafi.toLowerCase().includes(searchQuery.toLowerCase()) ||
          Boolean(item.comments && item.comments.toLowerCase().includes(searchQuery.toLowerCase()));
        if (!matchesSearch) return false;
      }

      // 2. Color / Filament filter
      if (filters.colors.length > 0) {
        const itemColors = parseColors(item.xroma).map((c) => c.toLowerCase());
        const hasMatchingColor = filters.colors.some((fc) =>
          itemColors.includes(fc.toLowerCase())
        );
        if (!hasMatchingColor) return false;
      }

      // 3. Urgent / Priority filter
      if (filters.urgentOnly) {
        const isUrgent = Boolean(
          item.comments &&
            (item.comments.includes('[PRIORITY:HIGH]') ||
              item.comments.toLowerCase().includes('urgent') ||
              item.comments.toLowerCase().includes('priority'))
        );
        if (!isUrgent) return false;
      }

      // 4. Has Model Link / STL
      if (filters.hasLinkOnly) {
        if (!item.link || !item.link.trim()) return false;
      }

      // 5. Has Comments / Notes
      if (filters.hasCommentsOnly) {
        if (!item.comments || !item.comments.trim()) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (filters.sortBy === 'name-asc') {
        return (a.perigrafi || '').localeCompare(b.perigrafi || '');
      }
      if (filters.sortBy === 'date-desc') {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return timeB - timeA;
      }
      return 0; // Default board order
    });

  const deliveredItems = filteredItems.filter((i) => i.status === 'Delivered');

  // Tab counts for mobile tab bar (BOARD_COLUMNS only)
  const tabCounts = BOARD_COLUMNS.reduce<Record<string, number>>((acc, status) => {
    acc[status] = filteredItems.filter((i) => i.status === status).length;
    return acc;
  }, {});

  // Both Admin and Customer use BOARD_COLUMNS in the main panel, with Delivered always in the right sidebar
  const columnsToRender = BOARD_COLUMNS;


  // Track dragging state to prevent swipe gesture and tab clicks from firing
  const isDraggingRef = useRef<boolean>(false);
  const dragEndedAtRef = useRef<number>(0);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleDragStart = (event: DragStartEvent) => {
    isDraggingRef.current = true;
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    lastOverIdRef.current = null;
    lastCollisionIdRef.current = null;

    if (readOnly || !isAdmin) return;
    setIsOverMobileTab(false);
    const { active } = event;
    const found = items.find((i) => i.id === active.id);
    if (found) {
      setActiveItem(found);
      let initialCloned = [...items];
      if (isMobile && found.status === 'Delivered') {
        initialCloned = initialCloned.map((item) =>
          item.id === found.id ? { ...item, status: activeMobileTab } : item
        );
      }
      setClonedItems(initialCloned);
      setOverContainer(found.status);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (readOnly || !isAdmin) return;
    const { active, over } = event;
    if (!over) {
      setIsOverMobileTab(false);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const isTab = overId.startsWith('mobile-tab:');
    setIsOverMobileTab(isTab);

    if (activeId === overId) return;

    const currentItems = clonedItemsRef.current ?? itemsRef.current;
    const activeContainer = findContainer(activeId, currentItems);
    const overContainerNow = findContainer(overId, currentItems);

    if (overContainerNow && overContainerNow !== overContainer) {
      setOverContainer(overContainerNow);
    }

    // Same target as last tick: nothing to do.
    if (overId === lastOverIdRef.current) return;
    if (!activeContainer || !overContainerNow) return;

    // Within same container: SortableContext animates card sorting visually.
    // Do not rebuild array on every mousemove tick!
    if (activeContainer === overContainerNow) {
      lastOverIdRef.current = overId;
      return;
    }

    lastOverIdRef.current = overId;

    setClonedItems((prev) => {
      const list = prev ? [...prev] : [...itemsRef.current];
      const activeIndex = list.findIndex((i) => i.id === activeId);
      if (activeIndex === -1) return prev;

      const [moved] = list.splice(activeIndex, 1);
      const updated: PrintItem = { ...moved, status: overContainerNow };

      const overIndex = list.findIndex((i) => i.id === overId);
      if (overIndex === -1) {
        // Dropped on empty column, column container, sidebar container, or mobile tab
        let lastTargetIndex = -1;
        for (let i = 0; i < list.length; i++) {
          if (list[i].status === overContainerNow) {
            lastTargetIndex = i;
          }
        }
        const insertAt = lastTargetIndex !== -1 ? lastTargetIndex + 1 : list.length;
        list.splice(insertAt, 0, updated);
      } else {
        list.splice(overIndex, 0, updated);
      }
      return list;
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    isDraggingRef.current = false;
    dragEndedAtRef.current = Date.now();
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    if (readOnly || !isAdmin) return;
    const { active, over } = event;
    const activeId = active.id as string;

    const originalItem = items.find((i) => i.id === activeId);
    const currentCloned = clonedItems;
    let finalItems = currentCloned ?? items;

    setActiveItem(null);
    setIsOverMobileTab(false);
    setClonedItems(null);
    lastOverIdRef.current = null;
    lastCollisionIdRef.current = null;
    setOverContainer(null);

    if (!over || !originalItem) return;

    const overId = over.id as string;
    const isTab = overId.startsWith('mobile-tab:');
    const droppedOnCard = activeId !== overId && !ALL_COLUMNS.includes(overId) && !isTab;

    if (droppedOnCard) {
      const oldIndex = finalItems.findIndex((i) => i.id === activeId);
      const newIndex = finalItems.findIndex((i) => i.id === overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        finalItems = arrayMove(finalItems, oldIndex, newIndex);
      }
    }

    const finalItem = finalItems.find((i) => i.id === activeId);
    if (!finalItem) return;

    const wasFromDelivered = originalItem.status === 'Delivered';

    // If status changed:
    if (finalItem.status !== originalItem.status) {
      if (onUpdateStatus) {
        onUpdateStatus(activeId, finalItem.status);
      }
    }

    // If order or status changed:
    if (onReorder && (currentCloned !== null || droppedOnCard)) {
      onReorder(finalItems);
    }

    if (wasFromDelivered) {
      if (finalItem.status === 'Delivered') {
        setShowDeliveredSheet(true);
      } else {
        setShowDeliveredSheet(false);
      }
    }
  };

  const handleDragCancel = (_event: DragCancelEvent) => {
    isDraggingRef.current = false;
    dragEndedAtRef.current = Date.now();
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    setActiveItem(null);
    setIsOverMobileTab(false);
    setClonedItems(null);
    lastOverIdRef.current = null;
    lastCollisionIdRef.current = null;
    setOverContainer(null);
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

  // Swipe gesture support to switch between tabs on mobile (disabled while dragging or interacting with cards)
  const handleMobileTouchStart = (e: React.TouchEvent) => {
    // If currently dragging, or drag just completed, do not track swipe
    if (activeItem || isDraggingRef.current || Date.now() - dragEndedAtRef.current < 600) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      return;
    }

    // Never track swipe if touch starts on a card or interactive element (cards are for dragging/editing)
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-card="true"], button, a, input, textarea')) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      return;
    }

    // Only track single-finger gestures on empty column/board background
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleMobileTouchEnd = (e: React.TouchEvent) => {
    if (
      touchStartXRef.current === null ||
      touchStartYRef.current === null ||
      activeItem ||
      isDraggingRef.current ||
      Date.now() - dragEndedAtRef.current < 600
    ) {
      touchStartXRef.current = null;
      touchStartYRef.current = null;
      return;
    }
    const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
    const endY = e.changedTouches[0]?.clientY ?? touchStartYRef.current;
    const diffX = endX - touchStartXRef.current;
    const diffY = endY - touchStartYRef.current;

    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // Minimum 50px horizontal delta and mostly horizontal
    if (Math.abs(diffX) > 50 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
      const currentIndex = BOARD_COLUMNS.indexOf(activeMobileTab);
      if (diffX < 0 && currentIndex < BOARD_COLUMNS.length - 1) {
        // Swiped left -> Next tab
        setActiveMobileTab(BOARD_COLUMNS[currentIndex + 1]);
      } else if (diffX > 0 && currentIndex > 0) {
        // Swiped right -> Previous tab
        setActiveMobileTab(BOARD_COLUMNS[currentIndex - 1]);
      }
    }
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

          {/* Filter Button & Popover */}
          <div className={styles.filterWrapper}>
            <button
              type="button"
              className={`${styles.btnFilter} ${activeFilterCount > 0 ? styles.btnFilterActive : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setIsFilterOpen((v) => !v);
              }}
              title="Filter and sort tasks"
              aria-label="Filter tasks"
              aria-expanded={isFilterOpen}
            >
              <SlidersHorizontal size={14} />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span className={styles.filterBadge}>{activeFilterCount}</span>
              )}
            </button>

            <FilterPopover
              isOpen={isFilterOpen}
              onClose={() => setIsFilterOpen(false)}
              filters={filters}
              onChangeFilters={setFilters}
              availableColors={availableColors}
              activeFilterCount={activeFilterCount}
              onReset={() => setFilters(INITIAL_FILTERS)}
            />
          </div>

          {/* New Print Button */}
          {!readOnly && onAddPrint && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAddClick(isMobile ? activeMobileTab : 'Not Started');
              }}
              className={styles.btnPrimary}
            >
              <Plus size={16} />
              <span>Add Part</span>
            </button>
          )}
        </div>
      </div>

      {/* Board Body with Horizontal Columns & Delivered Drawer wrapped in DndContext */}
      {/* Board Body — DndContext wraps both mobile and desktop */}
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {isMobile ? (
          /* ── MOBILE VIEW: single column at a time with swipe & tab support ── */
          <div
            className={styles.mobileBoard}
            onTouchStart={handleMobileTouchStart}
            onTouchEnd={handleMobileTouchEnd}
          >
            {/* Active column — full natural height, parent scrolls, remounts smoothly on tab change */}
            <KanbanColumn
              key={activeMobileTab}
              status={activeMobileTab}
              items={filteredItems.filter((i) => i.status === activeMobileTab)}
              comments={comments}
              subtasks={subtasks}
              readOnly={readOnly}
              isAdmin={isAdmin}
              fullScroll
              isOver={overContainer === activeMobileTab}
              onEdit={handleEditClick}
              onDelete={onDeletePrint}
              onDuplicate={handleDuplicateClick}
              onChangeStatus={isAdmin ? onUpdateStatus : undefined}
              onAddClick={
                isAdmin || activeMobileTab === 'Not Started'
                  ? handleAddClick
                  : undefined
              }
              onOpenComments={(item) => setActiveCommentItem(item)}
              onAddSubtask={handleAddSubtask}
              onToggleSubtask={handleToggleSubtask}
              onUpdateSubtaskTitle={handleUpdateSubtaskTitle}
              onDeleteSubtask={handleDeleteSubtask}
            />
          </div>
        ) : (
          /* ── DESKTOP VIEW: horizontal multi-column layout ── */
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
                  onUpdateSubtaskTitle={handleUpdateSubtaskTitle}
                  onDeleteSubtask={handleDeleteSubtask}
                />
              ))}
            </div>

            {/* Delivered Sidebar — desktop only */}
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
              onUpdateSubtaskTitle={handleUpdateSubtaskTitle}
              onDeleteSubtask={handleDeleteSubtask}
            />
          </div>
        )}


        {/* Mobile Floating Tab Bar stays inside DndContext so tabs can receive drops */}
        {isMobile && !activeCommentItem && (
          <MobileTabBar
            activeTab={activeMobileTab}
            counts={tabCounts}
            onTabChange={setActiveMobileTab}
            deliveredCount={deliveredItems.length}
            onOpenDelivered={() => setShowDeliveredSheet(true)}
            isDragging={Boolean(activeItem)}
          />
        )}

        {/* Delivered bottom sheet — mobile only, inside DndContext so cards can be dragged out */}
        {isMobile && showDeliveredSheet && (
          <>
            <div
              className={`${styles.deliveredSheetBackdrop} ${activeItem?.status === 'Delivered' ? styles.deliveredSheetBackdropDragging : ''}`}
              onClick={() => setShowDeliveredSheet(false)}
            />
            <div
              className={`${styles.deliveredSheet} ${activeItem?.status === 'Delivered' ? styles.deliveredSheetDragging : ''}`}
            >
              <div className={styles.deliveredSheetHeader}>
                <CheckCircle2 size={16} />
                <span>Delivered</span>
                {deliveredItems.length > 0 && (
                  <span className={styles.deliveredSheetBadge}>{deliveredItems.length}</span>
                )}
                <button
                  type="button"
                  className={styles.deliveredSheetClose}
                  onClick={() => setShowDeliveredSheet(false)}
                >
                  ✕
                </button>
              </div>
              <div className={styles.deliveredSheetBody}>
                {deliveredItems.length === 0 ? (
                  <p className={styles.deliveredSheetEmpty}>No delivered prints yet.</p>
                ) : (
                  <SortableContext
                    items={deliveredItems.map((i) => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {deliveredItems.map((item) => {
                      const canEdit = !readOnly && isAdmin;
                      return (
                        <PrintCard
                          key={item.id}
                          item={item}
                          readOnly={!canEdit}
                          isAdmin={isAdmin}
                          onEdit={canEdit ? handleEditClick : undefined}
                          onDelete={canEdit ? onDeletePrint : undefined}
                          onDuplicate={canEdit ? handleDuplicateClick : undefined}
                          onChangeStatus={isAdmin ? onUpdateStatus : undefined}
                          onOpenComments={(item) => setActiveCommentItem(item)}
                        />
                      );
                    })}
                  </SortableContext>
                )}
              </div>
            </div>
          </>
        )}

        <DragOverlay dropAnimation={dropAnimation}>
          {activeItem ? (
            <div
              className={`${styles.dragOverlayWrapper} ${isOverMobileTab ? styles.dragOverlayOverTab : ''}`}
            >
              <PrintCard item={activeItem} isOverlay isAdmin={isAdmin} readOnly />
            </div>
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
        onCommentsSeen={handleCommentsSeen}
        isAdmin={isAdmin}
        currentUserRole={currentUserRole}
        currentUserName={currentUserName}
      />
    </div>
  );
}
