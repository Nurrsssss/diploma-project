'use client'
import React, { useState, useCallback } from 'react';
import { Edit3, Save, X } from 'lucide-react';

interface Segment {
    type: 'text' | 'table';
    content: string[];
}

interface TableData {
    headers: string[];
    rows: string[][];
}

interface EditingCell {
    segmentIndex: number;
    rowIndex: number;
    cellIndex: number;
}

interface HealthPassportAnalysisTableProps {
    content: string;
    onChange: (newContent: string) => void;
}

const HealthPassportAnalysisTable: React.FC<HealthPassportAnalysisTableProps> = ({ content, onChange }) => {
    const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
    const [cellValue, setCellValue] = useState<string>('');

    // Parse markdown content into segments
    const parseContent = useCallback((text: string): Segment[] => {
        const segments: Segment[] = [];
        const lines: string[] = text.split('\n');
        let currentSegment: Segment = { type: 'text', content: [] };
        let inTable: boolean = false;

        for (let i = 0; i < lines.length; i++) {
            const line: string = lines[i];
            const isTableRow: boolean = line.trim().startsWith('|') && line.trim().endsWith('|');
            const isSeparator: boolean = Boolean(line.trim().match(/^\|[\s\-\|]+\|$/));

            if (isTableRow && !inTable) {
                // Start of table - save current text segment if not empty
                if (currentSegment.content.length > 0) {
                    segments.push({ ...currentSegment });
                    currentSegment = { type: 'text', content: [] };
                }
                inTable = true;
                currentSegment = { type: 'table', content: [line] };
            } else if (isTableRow && inTable) {
                // Continue table
                currentSegment.content.push(line);
            } else if (inTable && !isTableRow && !isSeparator) {
                // End of table
                segments.push({ ...currentSegment });
                inTable = false;
                currentSegment = { type: 'text', content: [line] };
            } else if (!isSeparator) {
                // Regular text or empty line
                currentSegment.content.push(line);
            }
        }

        // Add final segment
        if (currentSegment.content.length > 0) {
            segments.push(currentSegment);
        }

        return segments;
    }, []);

    // Parse table rows into structured data
    const parseTable = useCallback((tableLines: string[]): TableData => {
        if (tableLines.length < 2) return { headers: [], rows: [] };

        const parseRow = (line: string): string[] => {
            return line.split('|')
                .slice(1, -1) // Remove empty first and last elements
                .map((cell: string) => cell.trim());
        };

        const headers: string[] = parseRow(tableLines[0]);
        const rows: string[][] = tableLines.slice(1)
            .filter((line: string) => !line.match(/^\|[\s\-\|]+\|$/)) // Skip separator lines
            .map(parseRow);

        return { headers, rows };
    }, []);

    // Convert table data back to markdown
    const tableToMarkdown = useCallback((headers: string[], rows: string[][]): string => {
        const headerRow: string = `| ${headers.join(' | ')} |`;
        const separatorRow: string = `| ${headers.map(() => '----').join(' | ')} |`;
        const dataRows: string[] = rows.map((row: string[]) => `| ${row.join(' | ')} |`);

        return [headerRow, separatorRow, ...dataRows].join('\n');
    }, []);

    // Handle cell editing
    const startEditing = (segmentIndex: number, rowIndex: number, cellIndex: number, currentValue: string): void => {
        setEditingCell({ segmentIndex, rowIndex, cellIndex });
        setCellValue(currentValue);
    };

    const saveCell = (): void => {
        if (!editingCell) return;
        const segments: Segment[] = parseContent(content);
        const { segmentIndex, rowIndex, cellIndex } = editingCell;
        const segment: Segment = segments[segmentIndex];

        if (segment.type === 'table') {
            const { headers, rows }: TableData = parseTable(segment.content);
            rows[rowIndex][cellIndex] = cellValue;

            const newTableMarkdown: string = tableToMarkdown(headers, rows);
            const newSegments: Segment[] = [...segments];
            newSegments[segmentIndex] = { type: 'table', content: newTableMarkdown.split('\n') };

            // Reconstruct content
            const newContent: string = newSegments.map((seg: Segment) => seg.content.join('\n')).join('\n');
            onChange(newContent);
        }

        setEditingCell(null);
        setCellValue('');
    };

    const cancelEdit = (): void => {
        setEditingCell(null);
        setCellValue('');
    };

    const segments: Segment[] = parseContent(content);

    return (
        <div className="space-y-6">
            {segments.map((segment: Segment, segmentIndex: number) => {
                if (segment.type === 'text') {
                    return (
                        <div key={segmentIndex} className="bg-gray-50 rounded-lg p-4">
                            <textarea
                                value={segment.content.join('\n')}
                                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                                    const newSegments: Segment[] = [...segments];
                                    newSegments[segmentIndex] = {
                                        type: 'text',
                                        content: e.target.value.split('\n')
                                    };
                                    const newContent: string = newSegments.map((seg: Segment) => seg.content.join('\n')).join('\n');
                                    onChange(newContent);
                                }}
                                className="w-full md:min-h-[300px] p-3 border border-gray-200 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="Введите текст..."
                            />
                        </div>
                    );
                } else {
                    // Table segment
                    const { headers, rows }: TableData = parseTable(segment.content);

                    return (
                        <div key={segmentIndex} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                            <div className="bg-blue-50 px-4 py-2 border-b border-gray-200">
                                <h3 className="text-sm font-medium text-blue-900 flex items-center gap-2">
                                    <Edit3 size={16} />
                                    Редактируемая таблица
                                </h3>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            {headers.map((header: string, cellIndex: number) => (
                                                <th key={cellIndex} className="px-4 py-3 text-left text-sm font-semibold text-gray-700 border-r border-gray-200 last:border-r-0">
                                                    {header}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {rows.map((row: string[], rowIndex: number) => (
                                            <tr key={rowIndex} className="border-t border-gray-200 hover:bg-gray-50">
                                                {row.map((cell: string, cellIndex: number) => (
                                                    <td key={cellIndex} className="px-4 py-3 border-r border-gray-200 last:border-r-0 relative group">
                                                        {editingCell?.segmentIndex === segmentIndex &&
                                                            editingCell?.rowIndex === rowIndex &&
                                                            editingCell?.cellIndex === cellIndex ? (
                                                            <div className="flex items-center gap-2">
                                                                <input
                                                                    type="text"
                                                                    value={cellValue}
                                                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCellValue(e.target.value)}
                                                                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                                                        if (e.key === 'Enter') saveCell();
                                                                        if (e.key === 'Escape') cancelEdit();
                                                                    }}
                                                                    className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:ring-2 focus:ring-blue-500"
                                                                    autoFocus
                                                                />
                                                                <button
                                                                    onClick={saveCell}
                                                                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                                                                >
                                                                    <Save size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={cancelEdit}
                                                                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div
                                                                className="cursor-pointer hover:bg-blue-50 -mx-2 -my-1 px-2 py-1 rounded min-h-6 flex items-center"
                                                                onClick={() => startEditing(segmentIndex, rowIndex, cellIndex, cell)}
                                                            >
                                                                <span className="text-sm text-gray-800">{cell || '\u00A0'}</span>
                                                                <Edit3 size={12} className="ml-2 opacity-0 group-hover:opacity-50 text-blue-500" />
                                                            </div>
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    );
                }
            })}

            {/* Если нет сегментов или последний сегмент - таблица, добавляем пустое текстовое поле */}
            {(segments.length === 0 || segments[segments.length - 1].type === 'table') && (
                <div className="bg-gray-50 rounded-lg p-4">
                    <textarea
                        value=""
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                            const newSegments: Segment[] = [...segments, {
                                type: 'text',
                                content: e.target.value.split('\n')
                            }];
                            const newContent: string = newSegments.map((seg: Segment) => seg.content.join('\n')).join('\n');
                            onChange(newContent);
                        }}
                        className="w-full min-h-[200px] p-3 border border-gray-200 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Введите текст..."
                    />
                </div>
            )}
        </div>
    );
};

export default HealthPassportAnalysisTable;