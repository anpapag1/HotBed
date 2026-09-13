export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export const SUBTASK_PRESETS = [
  'G-Code Sliced',
  'Bed Adhesion Check',
  'Extrusion & Flow Check',
  'Support Removal',
  'QC Inspection',
  'Post-Processing',
  'Dimensional Accuracy',
  'Packaging',
];

export function getItemSubtasks(itemId: string): SubTask[] {
  try {
    const raw = localStorage.getItem(`hotbed_subtasks_${itemId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading subtasks', err);
  }
  return []; // Empty by design
}

export function saveItemSubtasks(itemId: string, subtasks: SubTask[]): void {
  try {
    localStorage.setItem(`hotbed_subtasks_${itemId}`, JSON.stringify(subtasks));
    window.dispatchEvent(
      new CustomEvent('subtasks-updated', {
        detail: { itemId, subtasks },
      })
    );
  } catch (err) {
    console.error('Error saving subtasks', err);
  }
}

export function addSubtask(itemId: string, title: string): SubTask {
  const current = getItemSubtasks(itemId);
  const newTask: SubTask = {
    id: `st-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    title: title.trim(),
    completed: false,
  };
  const updated = [...current, newTask];
  saveItemSubtasks(itemId, updated);
  return newTask;
}

export function toggleSubtask(itemId: string, subtaskId: string): void {
  const current = getItemSubtasks(itemId);
  const updated = current.map((st) =>
    st.id === subtaskId ? { ...st, completed: !st.completed } : st
  );
  saveItemSubtasks(itemId, updated);
}

export function deleteSubtask(itemId: string, subtaskId: string): void {
  const current = getItemSubtasks(itemId);
  const updated = current.filter((st) => st.id !== subtaskId);
  saveItemSubtasks(itemId, updated);
}

