import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { ScheduleGrid } from '@/components/Schedule/ScheduleGrid';
import { CellEditor } from '@/components/Schedule/CellEditor';
import { RowEditor } from '@/components/Schedule/RowEditor';
import { useSchedule } from '@/hooks/useSchedule';
import type { Cell, Schedule } from '@/types/schedule.types';
import { Save, RefreshCw, AlertCircle } from 'lucide-react';

export function SchedulePage() {
  const { schedule, isLoading, error, save, isSaving, refetch } = useSchedule();
  
  const [editingCell, setEditingCell] = useState<{
    rowIndex: number;
    cellIndex: number;
    cell: Cell;
  } | null>(null);
  
  const [addingCellToRow, setAddingCellToRow] = useState<number | null>(null);
  const [addingRow, setAddingRow] = useState(false);
  const [localSchedule, setLocalSchedule] = useState<Schedule | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Initialize local schedule from server data
  if (schedule && !localSchedule) {
    setLocalSchedule(schedule);
  }

  // Handle cell edit
  const handleEditCell = (rowIndex: number, cellIndex: number, cell: Cell) => {
    setEditingCell({ rowIndex, cellIndex, cell });
  };

  // Handle add cell
  const handleAddCell = (rowIndex: number) => {
    setAddingCellToRow(rowIndex);
    setEditingCell({
      rowIndex,
      cellIndex: -1, // New cell
      cell: {
        time: '12:00',
        title: '',
        subtitle: '',
        badges: [],
        duration: 15,
      },
    });
  };

  // Handle add row
  const handleAddRow = () => {
    setAddingRow(true);
  };

  // Save cell changes
  const handleSaveCell = (cell: Cell) => {
    if (!localSchedule || !editingCell) return;

    const newSchedule = { ...localSchedule };
    const row = newSchedule.rows[editingCell.rowIndex];

    if (editingCell.cellIndex === -1) {
      // New cell
      row.cells.push(cell);
    } else {
      // Update existing cell
      row.cells[editingCell.cellIndex] = cell;
    }

    setLocalSchedule(newSchedule);
    setIsDirty(true);
    setEditingCell(null);
    setAddingCellToRow(null);
  };

  // Delete cell
  const handleDeleteCell = () => {
    if (!localSchedule || !editingCell || editingCell.cellIndex === -1) return;

    const newSchedule = { ...localSchedule };
    const row = newSchedule.rows[editingCell.rowIndex];
    row.cells.splice(editingCell.cellIndex, 1);

    setLocalSchedule(newSchedule);
    setIsDirty(true);
    setEditingCell(null);
  };

  // Save row
  const handleSaveRow = (sauna: string, dayOffset: number) => {
    if (!localSchedule) return;

    const newSchedule = {
      ...localSchedule,
      rows: [
        ...localSchedule.rows,
        {
          sauna,
          dayOffset,
          cells: [],
        },
      ],
    };

    setLocalSchedule(newSchedule);
    setIsDirty(true);
    setAddingRow(false);
  };

  // Save to server
  const handleSave = () => {
    if (!localSchedule) return;

    const scheduleToSave = {
      ...localSchedule,
      version: (localSchedule.version || 1) + 1,
    };

    save(scheduleToSave, {
      onSuccess: () => {
        setIsDirty(false);
        refetch();
      },
    });
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="text-spa-text-secondary">Lädt Aufgussplan...</div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900">Fehler beim Laden</h3>
            <p className="text-red-700 text-sm mt-1">
              {error instanceof Error ? error.message : 'Ein Fehler ist aufgetreten'}
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-3xl font-bold text-spa-text-primary">Aufgussplan</h2>
            <p className="text-spa-text-secondary mt-1">
              Version {localSchedule?.version || 1}
              {isDirty && (
                <span className="ml-2 text-orange-600 font-medium">• Ungespeicherte Änderungen</span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 text-spa-text-secondary hover:bg-spa-bg-secondary rounded-md transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Neu laden
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-spa-primary text-white rounded-md hover:bg-spa-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Speichert...' : 'Speichern'}
            </button>
          </div>
        </div>

        {/* Grid */}
        {localSchedule && (
          <ScheduleGrid
            schedule={localSchedule}
            onEditCell={handleEditCell}
            onAddCell={handleAddCell}
            onAddRow={handleAddRow}
          />
        )}

        {/* Cell Editor Dialog */}
        <CellEditor
          cell={editingCell?.cell || null}
          isOpen={editingCell !== null}
          onClose={() => {
            setEditingCell(null);
            setAddingCellToRow(null);
          }}
          onSave={handleSaveCell}
          onDelete={editingCell?.cellIndex !== -1 ? handleDeleteCell : undefined}
        />

        {/* Row Editor Dialog */}
        <RowEditor
          isOpen={addingRow}
          onClose={() => setAddingRow(false)}
          onSave={handleSaveRow}
        />
      </div>
    </Layout>
  );
}
