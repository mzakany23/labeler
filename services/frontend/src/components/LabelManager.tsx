'use client';

import { useState } from 'react';
import { Label, LabelGroup } from '@/types';
import { Plus, Edit3, Trash2, Palette, Tag } from 'lucide-react';
import { LABEL_COLORS, generateId } from '@/lib/labelingUtils';

interface LabelManagerProps {
  labels: Label[];
  labelGroups: LabelGroup[];
  onCreateLabel: (label: Omit<Label, 'id' | 'createdAt' | 'usageCount'>) => void;
  onUpdateLabel: (labelId: string, updates: Partial<Label>) => void;
  onDeleteLabel: (labelId: string) => void;
  onCreateGroup: (group: Omit<LabelGroup, 'id'>) => void;
  onUpdateGroup: (groupId: string, updates: Partial<LabelGroup>) => void;
  onDeleteGroup: (groupId: string) => void;
}

export default function LabelManager({
  labels,
  labelGroups,
  onCreateLabel,
  onUpdateLabel,
  onDeleteLabel,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
}: LabelManagerProps) {
  const [showCreateLabel, setShowCreateLabel] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [editingGroup, setEditingGroup] = useState<LabelGroup | null>(null);

  const [newLabel, setNewLabel] = useState({
    name: '',
    color: LABEL_COLORS[0],
    description: '',
    group: '',
  });

  const [newGroup, setNewGroup] = useState({
    name: '',
    color: LABEL_COLORS[0],
    description: '',
    labels: [] as string[],
  });

  const handleCreateLabel = () => {
    if (newLabel.name.trim()) {
      onCreateLabel({
        name: newLabel.name.trim(),
        color: newLabel.color,
        description: newLabel.description.trim() || undefined,
        group: newLabel.group || undefined,
      });
      setNewLabel({ name: '', color: LABEL_COLORS[0], description: '', group: '' });
      setShowCreateLabel(false);
    }
  };

  const handleCreateGroup = () => {
    if (newGroup.name.trim()) {
      onCreateGroup({
        name: newGroup.name.trim(),
        color: newGroup.color,
        description: newGroup.description.trim() || undefined,
        labels: newGroup.labels,
      });
      setNewGroup({ name: '', color: LABEL_COLORS[0], description: '', labels: [] });
      setShowCreateGroup(false);
    }
  };

  const handleUpdateLabel = () => {
    if (editingLabel && editingLabel.name.trim()) {
      onUpdateLabel(editingLabel.id, {
        name: editingLabel.name.trim(),
        color: editingLabel.color,
        description: editingLabel.description?.trim() || undefined,
        group: editingLabel.group || undefined,
      });
      setEditingLabel(null);
    }
  };

  const handleUpdateGroup = () => {
    if (editingGroup && editingGroup.name.trim()) {
      onUpdateGroup(editingGroup.id, {
        name: editingGroup.name.trim(),
        color: editingGroup.color,
        description: editingGroup.description?.trim() || undefined,
        labels: editingGroup.labels,
      });
      setEditingGroup(null);
    }
  };

  const groupedLabels = labels.reduce((acc, label) => {
    const group = label.group || 'ungrouped';
    if (!acc[group]) acc[group] = [];
    acc[group].push(label);
    return acc;
  }, {} as Record<string, Label[]>);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 flex items-center space-x-2">
          <Tag className="h-5 w-5" />
          <span>Label Management</span>
        </h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowCreateLabel(true)}
            className="flex items-center space-x-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            <span>Add Label</span>
          </button>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="flex items-center space-x-2 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" />
            <span>Add Group</span>
          </button>
        </div>
      </div>

      {/* Create Group Form */}
      {showCreateGroup && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 space-y-3 mb-4">
          <h4 className="font-medium text-blue-900 dark:text-blue-100">Create New Group</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Group name"
              value={newGroup.name}
              onChange={(e) => setNewGroup(prev => ({ ...prev, name: e.target.value }))}
              className="px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
            />
            <select
              value={newGroup.color}
              onChange={(e) => setNewGroup(prev => ({ ...prev, color: e.target.value }))}
              className="px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
            >
              {LABEL_COLORS.map(color => (
                <option key={color} value={color}>
                  <div className="flex items-center space-x-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {color}
                  </div>
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            placeholder="Description (optional)"
            value={newGroup.description}
            onChange={(e) => setNewGroup(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
          />
          <div className="flex space-x-3">
            <button
              onClick={handleCreateGroup}
              disabled={!newGroup.name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              Create Group
            </button>
            <button
              onClick={() => setShowCreateGroup(false)}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Create Label Form */}
      {showCreateLabel && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">Create New Label</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Label name"
              value={newLabel.name}
              onChange={(e) => setNewLabel(prev => ({ ...prev, name: e.target.value }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
            />
            <select
              value={newLabel.group}
              onChange={(e) => setNewLabel(prev => ({ ...prev, group: e.target.value }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
            >
              <option value="">No group</option>
              {labelGroups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            placeholder="Description (optional)"
            value={newLabel.description}
            onChange={(e) => setNewLabel(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
          />
          <div className="flex items-center space-x-2">
            <Palette className="h-4 w-4 text-gray-500" />
            <div className="flex space-x-2">
              {LABEL_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setNewLabel(prev => ({ ...prev, color }))}
                  className={`w-6 h-6 rounded-full border-2 ${
                    newLabel.color === color ? 'border-gray-900 dark:border-gray-100' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleCreateLabel}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create
            </button>
            <button
              onClick={() => setShowCreateLabel(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Labels List */}
      <div className="space-y-3">
        {Object.entries(groupedLabels).map(([groupId, groupLabels]) => (
          <div key={groupId} className="space-y-2">
            {groupId !== 'ungrouped' && (
              <div className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: labelGroups.find(g => g.id === groupId)?.color || '#64748b' }}
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {labelGroups.find(g => g.id === groupId)?.name || 'Unknown Group'}
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {groupLabels.map(label => (
                <div
                  key={label.id}
                  className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: label.color }}
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{label.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {label.usageCount} uses
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-1">
                    <button
                      onClick={() => setEditingLabel(label)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDeleteLabel(label.id)}
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Label Modal */}
      {editingLabel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-md space-y-4">
            <h4 className="text-lg font-medium text-gray-900 dark:text-gray-100">Edit Label</h4>
            <input
              type="text"
              value={editingLabel.name}
              onChange={(e) => setEditingLabel(prev => prev ? { ...prev, name: e.target.value } : null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
            />
            <input
              type="text"
              placeholder="Description"
              value={editingLabel.description || ''}
              onChange={(e) => setEditingLabel(prev => prev ? { ...prev, description: e.target.value } : null)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-100"
            />
            <div className="flex items-center space-x-2">
              <Palette className="h-4 w-4 text-gray-500" />
              <div className="flex space-x-2">
                {LABEL_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setEditingLabel(prev => prev ? { ...prev, color } : null)}
                    className={`w-6 h-6 rounded-full border-2 ${
                      editingLabel.color === color ? 'border-gray-900 dark:border-gray-100' : 'border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={handleUpdateLabel}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => setEditingLabel(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
